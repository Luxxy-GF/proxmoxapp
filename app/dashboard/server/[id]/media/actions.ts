"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { configQemuDisk, getQemuConfig } from "@/lib/proxmox"
import { revalidatePath } from "next/cache"

export async function attachIso(serverId: string, isoId: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: { node: true }
    })

    if (!server) return { error: "Server not found" }
    if (server.userId !== session.user.id && session.user.role !== "ADMIN") return { error: "Unauthorized" }

    const iso = await prisma.iso.findUnique({
        where: { id: isoId }
    })

    if (!iso) return { error: "ISO not found" }

    try {
        // Construct ISO path: volumeId is usually like "local:iso/filename.iso"
        // But our schema stores just filename? No, we store filename. storage is separate.
        // Wait, schema has `storage`. Filename is `filename`.
        // Proxmox expects `storage:iso/filename`.

        // Wait, `Iso` model has `filename` (e.g., `proxmox-ve_8.1-1.iso`) and `storage` (e.g. `local`).
        // The path should be `storage:iso/filename`. 
        // NOTE: Proxmox usually stores ISOs in `iso` content type dirs. 
        // If storage is `local`, path is `local:iso/filename`.
        // If storage is `local-lvm`, it might not support iso? Usually directory storage supports iso.

        const isoPath = `${iso.storage}:iso/${iso.filename}`

        await configQemuDisk(server.node, server.vmid!, {
            ide2: `${isoPath},media=cdrom`,
            boot: `order=ide2;scsi0` // prioritize CD-ROM
        })

        // Update DB
        await prisma.server.update({
            where: { id: serverId },
            data: { isoId: iso.id }
        })

        revalidatePath(`/dashboard/server/${serverId}/media`)
        return { success: true }
    } catch (e: any) {
        console.error("Failed to attach ISO:", e)
        return { error: e.message || "Failed to attach ISO" }
    }
}

export async function detachIso(serverId: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: { node: true }
    })

    if (!server) return { error: "Server not found" }
    if (server.userId !== session.user.id && session.user.role !== "ADMIN") return { error: "Unauthorized" }

    try {
        await configQemuDisk(server.node, server.vmid!, {
            ide2: "none,media=cdrom",
            boot: `order=scsi0;ide2` // prioritize Disk
        })

        // Update DB
        await prisma.server.update({
            where: { id: serverId },
            data: { isoId: null }
        })

        revalidatePath(`/dashboard/server/${serverId}/media`)
        return { success: true }
    } catch (e: any) {
        console.error("Failed to detach ISO:", e)
        return { error: e.message || "Failed to detach ISO" }
    }
}

export async function getBootOrder(serverId: string) {
    // Only fetch current boot order if needed, but we mostly just overwrite it.
    // This action might not be needed if we set it in attach/detach.
    return { success: true }
}
