"use server"

import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/db"
import { encrypt } from "@/lib/encryption"
import { FeatureKey, setFeatureFlag } from "@/lib/settings"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const productSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    price: z.coerce.number().min(0, "Price must be positive"),
    billingCycle: z.enum(["MONTHLY", "YEARLY"]),
    cpuCores: z.coerce.number().int().min(1, "CPU Cores must be at least 1"),
    memoryMB: z.coerce.number().int().min(128, "Memory must be at least 128MB"),
    diskGB: z.coerce.number().int().min(1, "Disk must be at least 1GB"),
    type: z.enum(["lxc", "qemu"]),
    templateId: z.preprocess((val) => (val === "" || val === null ? null : Number(val)), z.number().int().optional().nullable()),
})

export async function createProduct(prevState: any, formData: FormData) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    const rawData = {
        name: formData.get("name"),
        description: formData.get("description"),
        price: formData.get("price"),
        billingCycle: formData.get("billingCycle"),
        cpuCores: formData.get("cpuCores"),
        memoryMB: formData.get("memoryMB"),
        diskGB: formData.get("diskGB"),
        type: formData.get("type"),
        templateId: formData.get("templateId"),
    }

    const validatedFields = productSchema.safeParse(rawData)

    if (!validatedFields.success) {
        return { error: "Invalid Data", errors: validatedFields.error.flatten().fieldErrors }
    }

    const data = validatedFields.data

    try {
        await prisma.product.create({
            data: {
                name: data.name,
                description: data.description,
                price: data.price,
                billingCycle: data.billingCycle,
                cpuCores: data.cpuCores,
                memoryMB: data.memoryMB,
                diskGB: data.diskGB,
                type: data.type,
                templateId: data.templateId,
            },
        })
        revalidatePath("/dashboard/admin/products")
        return { success: true }
    } catch (error) {
        console.error("Failed to create product:", error)
        return { error: "Failed to create product" }
    }
}

export async function deleteProduct(id: string) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    try {
        await prisma.product.delete({ where: { id } })
        revalidatePath("/dashboard/admin/plans")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete product:", error)
        return { error: "Failed to delete product (likely in use)" }
    }
}

export async function adminServerAction(serverId: string, action: "start" | "stop" | "suspend" | "resume" | "delete") {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    try {
        const server = await prisma.server.findUnique({
            where: { id: serverId },
            include: { node: true }
        })

        if (!server || !server.node) {
            return { error: "Server or Node not found" }
        }

        if (server.vmid === null) {
            return { error: "Server has no VMID allocated (Provisioning?)" }
        }

        // Proxmox API Logic
        // Type is lxc or qemu
        const typePath = server.type === 'lxc' ? 'lxc' : 'qemu'
        const basePath = `/nodes/${server.node.proxmoxId}/${typePath}/${server.vmid}/status`

        let endpoint = ""
        let method: "POST" | "GET" | "DELETE" = "POST"

        switch (action) {
            case "start":
                endpoint = `${basePath}/start`
                break
            case "stop":
                endpoint = `${basePath}/stop`
                break
            case "suspend":
                endpoint = `${basePath}/suspend`
                break
            case "resume":
                endpoint = `${basePath}/resume`
                break
            case "delete":
                // Delete is special
                // Stop it first? Proxmox requires stop for delete usually.
                // For now assuming force stop then delete.
                endpoint = `/nodes/${server.node.proxmoxId}/${typePath}/${server.vmid}`
                method = "DELETE" // Wait, actually standard delete is usually DELETE method on resource
                break
        }

        const { callProxmoxApi } = await import("@/lib/proxmox")

        // Execute Proxmox Action
        if (action === 'delete') {
            // Try to stop first just in case
            try {
                await callProxmoxApi(server.node, `${basePath}/stop`, "POST")
                // wait a bit?
            } catch (e) {
                // Ignore error if already stopped
            }
            await callProxmoxApi(server.node, endpoint, "DELETE")

            // Cleanup DB
            await prisma.server.delete({ where: { id: serverId } })
        } else {
            await callProxmoxApi(server.node, endpoint, method)

            // Update DB Status if needed (might be async, but we can set expected status)
            let newStatus = server.status
            if (action === 'start' || action === 'resume') newStatus = 'RUNNING'
            if (action === 'stop') newStatus = 'STOPPED'
            if (action === 'suspend') newStatus = 'SUSPENDED'

            await prisma.server.update({
                where: { id: serverId },
                data: { status: newStatus }
            })
        }

        revalidatePath("/dashboard/admin/servers")
        return { success: true }
    } catch (error) {
        console.error(`Failed to ${action} server:`, error)
        return { error: `Failed to ${action} server: ${error}` }
    }
}

export async function updateInvoiceStatus(id: string, status: "PAID" | "CANCELLED" | "UNPAID") {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    try {
        await prisma.invoice.update({
            where: { id },
            data: {
                status,
                paidAt: status === 'PAID' ? new Date() : null
            }
        })
        revalidatePath("/dashboard/admin/billing")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update invoice" }
    }
}

export async function updateUserBalance(userId: string, amount: number) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { balance: amount }
        })
        revalidatePath("/dashboard/admin/users")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update balance" }
    }
}

const optionalUrlField = z.union([z.string().url("Invalid URL"), z.literal(""), z.null()]).optional()
const optionalStringField = z.union([z.string().min(1, "This field cannot be empty"), z.literal(""), z.null()]).optional()

const nodeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    address: z.string().min(1, "Address is required"),
    proxmoxId: z.string().min(1, "Proxmox Node ID is required"),
    endpoint: z.string().url("Invalid URL"),
    tokenId: z.string().min(1, "Token ID is required"),
    tokenSecret: z.string().min(1, "Token Secret is required"),
    cotermEndpoint: optionalUrlField,
    cotermSecret: optionalStringField,
})

const normalizeNullable = (value?: string | null) => {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
}

export async function createNode(prevState: any, formData: FormData) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    const rawData = {
        name: formData.get("name"),
        address: formData.get("address"),
        proxmoxId: formData.get("proxmoxId"),
        endpoint: formData.get("endpoint"),
        tokenId: formData.get("tokenId"),
        tokenSecret: formData.get("tokenSecret"),
        cotermEndpoint: formData.get("cotermEndpoint"),
        cotermSecret: formData.get("cotermSecret"),
    }

    const validatedFields = nodeSchema.safeParse(rawData)

    if (!validatedFields.success) {
        return { error: "Invalid Data", errors: validatedFields.error.flatten().fieldErrors }
    }

    const {
        name,
        address,
        proxmoxId,
        endpoint,
        tokenId,
        tokenSecret,
        cotermEndpoint,
        cotermSecret,
    } = validatedFields.data

    try {
        await prisma.node.create({
            data: {
                name,
                address,
                proxmoxId,
                endpoint,
                tokenId: encrypt(tokenId),
                tokenSecret: encrypt(tokenSecret),
                cotermEndpoint: normalizeNullable(cotermEndpoint),
                cotermSecret: normalizeNullable(cotermSecret),
                status: "Offline", // Default status
            },
        })
        revalidatePath("/dashboard/admin/nodes")
        return { success: true }
    } catch (error) {
        console.error("Failed to create node:", error)
        return { error: "Failed to create node" }
    }
}

export async function deleteNode(id: string) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    try {
        // Check if node has servers
        const serverCount = await prisma.server.count({
            where: { nodeId: id },
        })

        if (serverCount > 0) {
            return { error: `Cannot delete node with ${serverCount} active servers.` }
        }

        await prisma.node.delete({
            where: { id },
        })
        revalidatePath("/dashboard/admin/nodes")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete node:", error)
    }
}

export async function updateNode(prevState: any, formData: FormData) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    const id = formData.get("id") as string

    const rawData = {
        name: formData.get("name"),
        address: formData.get("address"),
        proxmoxId: formData.get("proxmoxId"),
        endpoint: formData.get("endpoint"),
        tokenId: formData.get("tokenId"),
        tokenSecret: formData.get("tokenSecret"),
        cotermEndpoint: formData.get("cotermEndpoint"),
        cotermSecret: formData.get("cotermSecret"),
    }

    // Schema matches create but secrets are optional
    const updateSchema = nodeSchema.extend({
        tokenId: optionalStringField,
        tokenSecret: optionalStringField,
    })

    const validatedFields = updateSchema.safeParse(rawData)

    if (!validatedFields.success) {
        return { error: "Invalid Data", errors: validatedFields.error.flatten().fieldErrors }
    }

    const {
        name,
        address,
        proxmoxId,
        endpoint,
        tokenId,
        tokenSecret,
        cotermEndpoint,
        cotermSecret,
    } = validatedFields.data

    try {
        const data: Record<string, any> = {
            name,
            address,
            proxmoxId,
            endpoint,
        }

        if (cotermEndpoint !== undefined) {
            data.cotermEndpoint = normalizeNullable(cotermEndpoint)
        }

        // Only update secrets if they are provided (non-empty strings)
        if (tokenId && tokenId.trim() !== "") data.tokenId = encrypt(tokenId)
        if (tokenSecret && tokenSecret.trim() !== "") data.tokenSecret = encrypt(tokenSecret)
        if (cotermSecret !== undefined) {
            if (typeof cotermSecret === "string") {
                const trimmed = cotermSecret.trim()
                data.cotermSecret = trimmed.length ? trimmed : null
            } else {
                data.cotermSecret = null
            }
        }

        const updatedNode = await prisma.node.update({

            where: { id },
            data
        })

        // Try to test connection and update status
        try {
            const { callProxmoxApi, getNodeStatus } = await import("@/lib/proxmox")
            // Get full stats instead of just version
            const stats = await getNodeStatus(updatedNode)

            if (stats.online) {
                await prisma.node.update({
                    where: { id },
                    data: {
                        status: 'Online',
                        cpuUsage: stats.cpu,
                        ramUsage: stats.ram,
                        diskUsage: stats.disk
                    }
                })
            } else {
                throw new Error("Node reported offline during status check")
            }
        } catch (e) {
            await prisma.node.update({
                where: { id },
                data: { status: 'Offline' }
            })
            console.error("Node connection test failed:", e)
        }

        revalidatePath("/dashboard/admin/nodes")
        return { success: true }
    } catch (error) {
        console.error("Failed to update node:", error)
        return { error: "Failed to update node" }
    }
}

export async function refreshNode(id: string) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    try {
        const node = await prisma.node.findUnique({ where: { id } })
        if (!node) return { error: "Node not found" }

        const { getNodeStatus } = await import("@/lib/proxmox")
        const stats = await getNodeStatus(node)

        if (stats.online) {
            await prisma.node.update({
                where: { id },
                data: {
                    status: 'Online',
                    cpuUsage: stats.cpu,
                    ramUsage: stats.ram,
                    diskUsage: stats.disk
                }
            })
        } else {
            await prisma.node.update({
                where: { id },
                data: { status: 'Offline' }
            })
        }

        revalidatePath("/dashboard/admin/nodes")
        return { success: true, stats: { ...stats, online: stats.online } }
    } catch (error) {
        return { error: "Failed to refresh node" }
    }
}

const featureFlagSchema = z.object({
    key: z.enum(["store_enabled", "deploy_enabled"]) as z.ZodType<FeatureKey>,
    enabled: z.coerce.boolean(),
})

export async function updateFeatureFlag(prevState: any, formData: FormData) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    const validated = featureFlagSchema.safeParse({
        key: formData.get("key"),
        enabled: formData.get("enabled"),
    })

    if (!validated.success) {
        return { error: "Invalid flag payload" }
    }

    const { key, enabled } = validated.data

    await setFeatureFlag(key, enabled)
    revalidatePath("/dashboard/admin/settings")
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/deploy")
    revalidatePath("/dashboard/store")

    return { success: true }
}
