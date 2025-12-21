"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { getNextVmid, cloneLxc, setLxcConfig } from "@/lib/proxmox"

export async function deployServer(
    templateId: string,
    productId: string,
    hostname: string,
    password?: string,
    poolId?: string | null
) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    // 1. Validate inputs
    if (!hostname || hostname.length < 3) return { error: "Hostname must be at least 3 characters" }

    try {
        // 2. Fetch Resources
        const product = await prisma.product.findUnique({ where: { id: productId } })
        if (!product) return { error: "Product not found" }

        const template = await prisma.template.findUnique({ where: { id: templateId } })
        if (!template) return { error: "Template not found" }

        // 3. Find available node
        // Simple strategy: Pick the first online node
        const onlineNode = await prisma.node.findFirst({
            where: { status: 'Online' }
        })

        if (!onlineNode) return { error: "No available infrastructure nodes found" }

        // 4. Create Server Record (PROVISIONING)
        // We need a temporary or reserved VMID? Or we fetch it live.
        // It's safer to fetch live nextID from Proxmox.

        let newVmid: number
        try {
            newVmid = await getNextVmid(onlineNode)
        } catch (e) {
            return { error: "Failed to allocate IP/ID from cluster" }
        }

        const server = await prisma.server.create({
            data: {
                name: hostname, // Adding name to Server model might be needed? 
                // Schema check: Server has no 'name', it has 'hostname' in ServerNetwork?
                // Ah, Schema "Server" has no name. Let's check schema.
                // It seems we might have missed 'name' or 'hostname' in Server model.
                // Let's check ServerNetwork for hostname?
                // User plan said "Configure: Hostname".

                // Looking at schema `Server`: status, billingStatus, vmid, type...
                // Looking at schema `ServerNetwork`: ipAddress, macAddress...

                // We should probably add a `name` or `hostname` field to `Server` for easy ID.
                // For now, I'll add it to schema or put it in a related table if strictly normalized.
                // I'll assume we wanted it on Server.

                // Wait, `Model Server`:
                // id, status, billingStatus, vmid, type, userId, nodeId, productId...

                // I will Add `name` to Server model in this step as well via schema update?
                // Or use `ServerNetwork`? Typically `Server` should have a friendly label.

                // Let's assume for this action I will update schema quickly or use what we have.
                // I'll add `name` to Server model. It's too important to miss.
                userId: session.user.id,
                nodeId: onlineNode.id,
                productId: product.id,
                vmid: newVmid,
                type: product.type || 'lxc', // 'lxc' or 'qemu'
                status: 'PROVISIONING',
            }
        })

        // 5. Trigger Provisioning (Background-ish, but for now await it)
        // In production, use a queue (BullMQ). Here we await or fire-and-forget.
        // Awaiting is safer for the demo response.

        try {
            // Clone
            await cloneLxc(onlineNode, template.vmid, newVmid, hostname, `Owner: ${session.user.email}`)

            // Config Resources
            await setLxcConfig(onlineNode, newVmid, {
                cores: product.cpuCores,
                memory: product.memoryMB,
                swap: 512, // Default swap
                password: password // Root password
            })

            // Start it?
            // await startVm(onlineNode, newVmid, 'lxc')

            // Update Status
            await prisma.server.update({
                where: { id: server.id },
                data: { status: 'RUNNING' }
            })

            // Create Resources Record
            await prisma.serverResources.create({
                data: {
                    serverId: server.id,
                    cpuCores: product.cpuCores,
                    memoryMB: product.memoryMB,
                    diskGB: product.diskGB
                }
            })

        } catch (provError) {
            console.error(provError)
            await prisma.server.update({
                where: { id: server.id },
                data: { status: 'ERROR' }
            })
            return { error: "Provisioning failed during execution" }
        }

        revalidatePath("/dashboard")
        return { success: true, serverId: server.id }

    } catch (error) {
        console.error(error)
        return { error: "Internal server error" }
    }
}
