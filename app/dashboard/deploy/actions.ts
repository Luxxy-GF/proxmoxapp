"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { getNextVmid, createQemuVm, startVm, getStorage, waitForTask, cloneQemu, setQemuConfig, resizeQemuDisk, getQemuConfig, getTaskStatus } from "@/lib/proxmox"
import { allocateIP, releaseIPs } from "@/lib/networking"

export async function getDefaultNodeStorage() {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const onlineNode = await prisma.node.findFirst({
        where: { status: 'Online' }
    })

    if (!onlineNode) return []

    try {
        const storageList = await getStorage(onlineNode)
        return storageList.filter((s: any) => s.content.includes('images'))
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function initDeploy(
    templateId: string | null,
    productId: string,
    hostname: string,
    poolId?: string | null,
    isoId?: string | null,
    storage?: string
) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    if (!hostname || hostname.length < 3) return { error: "Hostname must be at least 3 characters" }
    if (!templateId && !isoId) return { error: "Must select an OS Template or Custom ISO" }

    try {
        const product = await prisma.product.findUnique({ where: { id: productId } })
        if (!product) return { error: "Product not found" }

        const onlineNode = await prisma.node.findFirst({ where: { status: 'Online' } })
        if (!onlineNode) return { error: "No available infrastructure nodes found" }

        let targetStorage = storage
        // Only force strict storage discovery for ISOs (new VM)
        if (!targetStorage && isoId) {
            const storageList = await getStorage(onlineNode)
            const allImageStorage = storageList.filter((s: any) => s.content.includes('images'))
            if (allImageStorage.length === 0) return { error: "No storage available for VM disks on node" }
            const preferredStorage = allImageStorage.find((s: any) => s.storage === 'local-lvm' || s.storage === 'local-zfs' || s.storage === 'ceph')
            targetStorage = preferredStorage ? preferredStorage.storage : allImageStorage[0].storage
            console.log(`[Deploy] Storage Selection: Found [${allImageStorage.map((s: any) => s.storage).join(', ')}], Selected: ${targetStorage}`)
        }

        let newVmid: number
        try {
            newVmid = await getNextVmid(onlineNode)
            let attempts = 0
            while (attempts < 5) {
                const collision = await prisma.server.findFirst({ where: { vmid: newVmid, nodeId: onlineNode.id } })
                if (!collision) break
                newVmid++
                attempts++
            }
        } catch (e) {
            return { error: "Failed to allocate VMID" }
        }

        let template: any = null
        if (templateId) {
            template = await prisma.template.findUnique({ where: { id: templateId } })
            if (!template) return { error: "Template not found" }
        }

        const server = await prisma.server.create({
            data: {
                name: hostname,
                userId: session.user.id,
                nodeId: onlineNode.id,
                productId: product.id,
                vmid: newVmid,
                type: 'qemu',
                status: 'PROVISIONING',
                templateId: templateId || undefined,
                isoId: isoId || undefined
            }
        })

        // IP Allocation
        if (poolId) {
            try {
                await allocateIP(poolId, server.id)
            } catch (e: any) {
                await prisma.server.delete({ where: { id: server.id } })
                return { error: `IP Allocation Failed: ${e.message}` }
            }
        }

        await prisma.serverResources.create({
            data: {
                serverId: server.id,
                cpuCores: product.cpuCores,
                memoryMB: product.memoryMB,
                diskGB: product.diskGB
            }
        })

        return {
            success: true,
            serverId: server.id,
            vmid: newVmid,
            nodeId: onlineNode.id,
            targetStorage, // Can be undefined for templates
            templateVmid: template ? template.vmid : null
        }

    } catch (error: any) {
        console.error(error)
        return { error: error.message || "Initialization failed" }
    }
}

export async function startDeploy(
    serverId: string,
    nodeId: string,
    vmid: number,
    targetStorage: string | undefined,
    config: {
        templateVmid?: number,
        isoId?: string,
        hostname: string,
        cpuCores: number,
        memoryMB: number,
        diskGB: number
    }
) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    try {
        const node = await prisma.node.findUnique({ where: { id: nodeId } })
        if (!node) return { error: "Node not found" }

        let upid: string

        if (config.isoId) {
            if (!targetStorage) return { error: "Target storage is required for ISO deployment" }

            const iso = await prisma.iso.findUnique({ where: { id: config.isoId } })
            if (!iso) return { error: "ISO not found" }

            upid = await createQemuVm(node, vmid, config.hostname, {
                cores: config.cpuCores,
                memory: config.memoryMB,
                scsi0: `${targetStorage}:${config.diskGB}`,
                ide2: `${iso.storage}:iso/${iso.filename},media=cdrom`,
                boot: "order=ide2;scsi0"
            })

        } else if (config.templateVmid) {
            // If targetStorage is undefined, Proxmox clones to source storage
            upid = await cloneQemu(node, config.templateVmid, vmid, config.hostname, `Owner: ${session.user.email}`, targetStorage)
        } else {
            return { error: "Invalid configuration" }
        }

        return { success: true, upid }
    } catch (e: any) {
        console.error(e)
        return { error: e.message || "Failed to start provisioning task" }
    }
}

export async function pollDeploy(nodeId: string, upid: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    try {
        const node = await prisma.node.findUnique({ where: { id: nodeId } })
        if (!node) return { error: "Node not found" }

        const status = await getTaskStatus(node, upid)
        return { success: true, status: status.status, exitstatus: status.exitstatus }
    } catch (e) {
        return { error: "Failed to poll task" }
    }
}

export async function finalizeDeploy(
    serverId: string,
    nodeId: string,
    vmid: number,
    config: {
        cpuCores: number,
        memoryMB: number,
        diskGB: number,
        password?: string
    }
) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    try {
        const node = await prisma.node.findUnique({ where: { id: nodeId } })
        if (!node) return { error: "Node not found" }

        // 1. Resize Disk
        try {
            const currentConfig = await getQemuConfig(node, vmid)
            let bootDisk = 'scsi0'
            const diskKeys = ['scsi0', 'virtio0', 'ide0', 'sata0']

            for (const k of diskKeys) {
                if (currentConfig[k]) {
                    bootDisk = k
                    break
                }
            }

            await resizeQemuDisk(node, vmid, bootDisk, `${config.diskGB}G`)
        } catch (resizeError) {
            console.error("Disk resize failed:", resizeError)
        }

        // 2. Configure Network & Cloud-Init
        let ipconfig0 = "ip=dhcp"
        let net0Update: string | undefined = undefined

        // Check for allocation
        const allocation = await prisma.iPAllocation.findFirst({
            where: { serverId: serverId },
            include: { pool: true }
        })

        if (allocation) {
            const pool = allocation.pool
            const cidr = pool.netmask.split('.').map(Number).reduce((a: number, b: number) => a + (b >>> 0).toString(2).split('1').length - 1, 0)

            // Cloud-Init IP Config
            ipconfig0 = `ip=${allocation.ipAddress}/${cidr},gw=${pool.gateway}`

            // Network Device Config (Bridge/VLAN)
            try {
                const currentConfig = await getQemuConfig(node, vmid)
                const net0Current = currentConfig.net0 as string
                if (net0Current) {
                    const parts = net0Current.split(',')
                    const modelMac = parts[0]
                    let net0Parts = [modelMac]
                    net0Parts.push(`bridge=${pool.bridge || 'vmbr0'}`)
                    if (pool.vlan) net0Parts.push(`tag=${pool.vlan}`)
                    net0Parts.push('firewall=1')
                    net0Update = net0Parts.join(',')
                }
            } catch (e) { console.warn("Failed to update net0 config", e) }
        }

        await setQemuConfig(node, vmid, {
            cores: config.cpuCores,
            memory: config.memoryMB,
            cipassword: config.password,
            ciuser: "root",
            ipconfig0: ipconfig0,
            net0: net0Update
        })

        // Start VM
        await startVm(node, vmid, 'qemu')

        await prisma.server.update({
            where: { id: serverId },
            data: { status: 'RUNNING', consoleType: 'novnc' }
        })

        revalidatePath("/dashboard")
        return { success: true }
    } catch (e: any) {
        console.error(e)
        // Cleanup IP if failed? Probably safer.
        await releaseIPs(serverId)

        await prisma.server.update({
            where: { id: serverId },
            data: { status: 'ERROR' }
        })
        return { error: e.message || "Finalization failed" }
    }
}
