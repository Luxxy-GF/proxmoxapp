"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { getNextVmid, cloneLxc, setLxcConfig, createQemuVm, configQemuDisk, startVm, createVncProxy, getStorage } from "@/lib/proxmox"

export async function getDefaultNodeStorage() {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const onlineNode = await prisma.node.findFirst({
        where: { status: 'Online' }
    })

    if (!onlineNode) return []

    try {
        const storageList = await getStorage(onlineNode)
        // Return only storage capable of modifying/storing images (disk images)
        // Usually 'images' content.
        return storageList.filter((s: any) => s.content.includes('images'))
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function deployServer(
    templateId: string | null,
    productId: string,
    hostname: string,
    password?: string,
    poolId?: string | null,
    isoId?: string | null,
    storage?: string // Optional storage selection
) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    // 1. Validate inputs
    if (!hostname || hostname.length < 3) return { error: "Hostname must be at least 3 characters" }

    // Either template OR iso must be selected
    if (!templateId && !isoId) return { error: "Must select an OS Template or Custom ISO" }

    try {
        // 2. Fetch Resources
        const product = await prisma.product.findUnique({ where: { id: productId } })
        if (!product) return { error: "Product not found" }

        // 3. Find available node
        // Simple strategy: Pick the first online node
        const onlineNode = await prisma.node.findFirst({
            where: { status: 'Online' }
        })

        if (!onlineNode) return { error: "No available infrastructure nodes found" }

        // 3a. Resolve Storage
        // If storage provided, use it. Else auto-detect.
        let targetStorage = storage

        if (!targetStorage) {
            const storageList = await getStorage(onlineNode)
            const allImageStorage = storageList.filter((s: any) => s.content.includes('images'))
            if (allImageStorage.length === 0) return { error: "No storage available for VM disks on node" }

            // Prioritize known high-performance/standard names
            const preferredStorage = allImageStorage.find((s: any) => s.storage === 'local-lvm' || s.storage === 'local-zfs' || s.storage === 'ceph')
            targetStorage = preferredStorage ? preferredStorage.storage : allImageStorage[0].storage
        }

        // 4. Create Server Record (PROVISIONING)
        let newVmid: number
        try {
            newVmid = await getNextVmid(onlineNode)

            // Check for collision in DB
            let attempts = 0
            let isUnique = false
            while (!isUnique && attempts < 10) {
                const collision = await prisma.server.findFirst({
                    where: {
                        vmid: newVmid,
                        nodeId: onlineNode.id
                    }
                })

                if (!collision) {
                    isUnique = true
                } else {
                    console.log(`VMID collision for ${newVmid}, retrying...`)
                    // Try next ID manually first
                    newVmid++
                    // Or fetch fresh from cluster if preferred, but incrementing is safer against cluster lag
                    // Validate with cluster? 
                    // Ideally we check next free ID from cluster again, passing the collision ID as hint if API supports it,
                    // or just trust our increment. Proxmox `nextid` API doesn't take "min" param easily.
                    // The Admin wizard re-checks `getNextVmid(node, newVmid)`
                    try {
                        const next = await getNextVmid(onlineNode, newVmid)
                        newVmid = next
                    } catch {
                        // Fallback to simple increment if API check fails
                    }
                    attempts++
                }
            }

            if (!isUnique) throw new Error("Failed to find unique VMID after retries")

        } catch (e) {
            console.error(e)
            return { error: "Failed to allocate IP/ID from cluster" }
        }

        // Define Type
        // If ISO, it's QEMU. If template, check template type.
        let type = 'lxc'
        let template: any = null

        if (isoId) {
            type = 'qemu'
        } else if (templateId) {
            template = await prisma.template.findUnique({ where: { id: templateId } })
            if (!template) return { error: "Template not found" }
            type = template.type || 'lxc' // Default to LXC if not specified, or checks product?
            // Product type is often fallback.
            if (template.type === 'qemu') type = 'qemu'
        }

        const server = await prisma.server.create({
            data: {
                name: hostname,
                userId: session.user.id,
                nodeId: onlineNode.id,
                productId: product.id,
                vmid: newVmid,
                type: type,
                status: 'PROVISIONING',
                templateId: templateId || undefined, // Optional
                isoId: isoId || undefined // Optional
            }
        })

        // 5. Trigger Provisioning
        try {
            if (isoId) {
                // === Custom ISO Flow ===
                const iso = await prisma.iso.findUnique({ where: { id: isoId } })
                if (!iso) throw new Error("ISO not found")

                // 1. Create Empty VM
                // Disk Size: Product diskGB
                // We create a scsi0 disk on 'local-lvm' (default) or 'local-zfs' etc.
                // We need to know storage. "local-lvm" is standard for PVE.
                // For robustness, we should find storage, but hardcoding 'local-lvm' or 'local' is common in simple scripts.
                // Better: find a storage that supports 'images' (VM disks).
                // We'll stick to 'local-lvm' for now or 'local'.

                // Use resolved targetStorage

                await createQemuVm(onlineNode, newVmid, hostname, {
                    cores: product.cpuCores,
                    memory: product.memoryMB,
                    scsi0: `${targetStorage}:${product.diskGB}`, // Use resolved storage
                    ide2: `${iso.storage}:iso/${iso.filename},media=cdrom`, // Attach ISO
                    boot: "order=ide2;scsi0" // Boot from CD first
                })

                // 2. Enable VNC/Start
                // QEMU starts in paused state or running? createQemuVm doesn't start it manually unless specified?
                // `qm create` doesn't start.
                await startVm(onlineNode, newVmid, 'qemu')

                // 3. Mark Running
                await prisma.server.update({
                    where: { id: server.id },
                    data: { status: 'RUNNING', consoleType: 'novnc' }
                })

            } else if (type === 'lxc') {
                // === LXC Flow ===
                await cloneLxc(onlineNode, template.vmid, newVmid, hostname, `Owner: ${session.user.email}`)
                await setLxcConfig(onlineNode, newVmid, {
                    cores: product.cpuCores,
                    memory: product.memoryMB,
                    swap: 512,
                    password: password
                })
                // Start not strictly required for LXC to be "Ready" but usually user wants it on.
                await startVm(onlineNode, newVmid, 'lxc')

                await prisma.server.update({
                    where: { id: server.id },
                    data: { status: 'RUNNING' }
                })
            } else {
                // === QEMU Template Flow (if supported) ===
                // Not fully implemented in original code but similar to LXC clone
                // For now, assuming only LXC templates or ISOs for this task scope unless logic exists.
                // The task is specific to Custom ISO.
                throw new Error("Template-based QEMU deployment not yet fully implemented in this wizard")
            }

            // Create Resources Record
            await prisma.serverResources.create({
                data: {
                    serverId: server.id,
                    cpuCores: product.cpuCores,
                    memoryMB: product.memoryMB,
                    diskGB: product.diskGB
                }
            })

        } catch (provError: any) {
            console.error(provError)
            await prisma.server.update({
                where: { id: server.id },
                data: { status: 'ERROR' }
            })
            return { error: `Provisioning failed: ${provError.message || provError}` }
        }

        revalidatePath("/dashboard")
        return { success: true, serverId: server.id }

    } catch (error) {
        console.error(error)
        return { error: "Internal server error" }
    }
}
