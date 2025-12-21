"use server"

import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/db"
import { validateIPPoolRange } from "@/lib/networking"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const poolSchema = z.object({
    name: z.string().min(1, "Name is required"),
    nodeId: z.string().min(1, "Node is required"),
    ipVersion: z.enum(["v4", "v6"]),
    startIP: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, "Invalid IPv4 format"),
    endIP: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, "Invalid IPv4 format"),
    gateway: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, "Invalid IPv4 format"),
    netmask: z.string().min(1, "Netmask is required"),
    bridge: z.string().min(1, "Bridge is required"),
    vlan: z.coerce.number().int().optional().nullable(),
    dns: z.string().optional().nullable(),
    mtu: z.coerce.number().int().optional().nullable(),
    notes: z.string().optional().nullable(),
})

export async function createIPPool(prevState: any, formData: FormData) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    const rawData = {
        name: formData.get("name"),
        nodeId: formData.get("nodeId"),
        ipVersion: formData.get("ipVersion"),
        startIP: formData.get("startIP"),
        endIP: formData.get("endIP"),
        gateway: formData.get("gateway"),
        netmask: formData.get("netmask"),
        bridge: formData.get("bridge"),
        vlan: formData.get("vlan") || null,
        dns: formData.get("dns") || null,
        mtu: formData.get("mtu") || null,
        notes: formData.get("notes") || null,
    }

    const validatedFields = poolSchema.safeParse(rawData)

    if (!validatedFields.success) {
        return { error: "Invalid Data", errors: validatedFields.error.flatten().fieldErrors }
    }

    const data = validatedFields.data

    try {
        await validateIPPoolRange(data.nodeId, data.startIP, data.endIP)

        await prisma.iPPool.create({
            data: {
                name: data.name,
                nodeId: data.nodeId,
                ipVersion: data.ipVersion,
                startIP: data.startIP,
                endIP: data.endIP,
                gateway: data.gateway,
                netmask: data.netmask,
                bridge: data.bridge,
                vlan: data.vlan,
                dns: data.dns,
                mtu: data.mtu,
                notes: data.notes,
            }
        })
        revalidatePath("/dashboard/admin/networking")
        return { success: true }
    } catch (error: any) {
        return { error: error.message || "Failed to create pool" }
    }
}

export async function updateIPPool(id: string, prevState: any, formData: FormData) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    const rawData = {
        name: formData.get("name"),
        nodeId: formData.get("nodeId"),
        ipVersion: formData.get("ipVersion"),
        startIP: formData.get("startIP"),
        endIP: formData.get("endIP"),
        gateway: formData.get("gateway"),
        netmask: formData.get("netmask"),
        bridge: formData.get("bridge"),
        vlan: formData.get("vlan") || null,
        dns: formData.get("dns") || null,
        mtu: formData.get("mtu") || null,
        notes: formData.get("notes") || null,
    }

    const validatedFields = poolSchema.safeParse(rawData)

    if (!validatedFields.success) {
        return { error: "Invalid Data", errors: validatedFields.error.flatten().fieldErrors }
    }

    const data = validatedFields.data

    try {
        // Validate range, excluding self from overlap check
        await validateIPPoolRange(data.nodeId, data.startIP, data.endIP, id)

        await prisma.iPPool.update({
            where: { id },
            data: {
                name: data.name,
                nodeId: data.nodeId,
                ipVersion: data.ipVersion,
                startIP: data.startIP,
                endIP: data.endIP,
                gateway: data.gateway,
                netmask: data.netmask,
                bridge: data.bridge,
                vlan: data.vlan,
                dns: data.dns,
                mtu: data.mtu,
                notes: data.notes,
            }
        })
        revalidatePath("/dashboard/admin/networking")
        return { success: true }
    } catch (error: any) {
        return { error: error.message || "Failed to update pool" }
    }
}

export async function deleteIPPool(id: string) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    try {
        const pool = await prisma.iPPool.findUnique({
            where: { id },
            include: { _count: { select: { allocations: true } } }
        })

        if (!pool) return { error: "Pool not found" }
        if (pool._count.allocations > 0) return { error: "Cannot delete pool with active allocations" }

        await prisma.iPPool.delete({ where: { id } })
        revalidatePath("/dashboard/admin/networking")
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete pool" }
    }
}

export async function toggleIPPool(id: string, enabled: boolean) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    try {
        await prisma.iPPool.update({ where: { id }, data: { enabled } })
        revalidatePath("/dashboard/admin/networking")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update pool" }
    }
}
