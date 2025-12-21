import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
        return new NextResponse("Unauthorized", { status: 401 })
    }
    try {
        await prisma.node.delete({
            where: { id: id }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return new NextResponse("Error deleting node", { status: 500 })
    }
}
