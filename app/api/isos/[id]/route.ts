import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { deleteIsoFromStorage } from "@/lib/proxmox"
import { NextRequest, NextResponse } from "next/server"

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> } // In Next.js 15 params is async
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { id } = await params

        const iso = await prisma.iso.findUnique({
            where: { id },
            include: { node: true }
        })

        if (!iso) return NextResponse.json({ error: "ISO not found" }, { status: 404 })

        // Check Ownership
        if (iso.userId !== session.user.id && session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Check Usage
        const inUse = await prisma.server.findFirst({ where: { isoId: iso.id } })
        if (inUse) return NextResponse.json({ error: "ISO is currently in use" }, { status: 409 })

        // Delete from Proxmox
        // Volume ID: storage:iso/filename
        const volumeId = `${iso.storage}:iso/${iso.filename}`

        try {
            await deleteIsoFromStorage(iso.node, iso.storage, volumeId)
        } catch (e) {
            console.warn("Proxmox delete failed, maybe already gone?", e)
            // Continue to delete from DB? 
            // Better to warn but clean up DB if it's orphaned.
        }

        // Delete from DB
        await prisma.iso.delete({ where: { id } })

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error("ISO Delete Error:", error)
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
    }
}
