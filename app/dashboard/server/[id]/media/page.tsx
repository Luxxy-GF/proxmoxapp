import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { ServerMedia } from "@/components/server/server-media"
import { ServerHeader } from "@/components/server/server-header"

export default async function MediaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const session = await auth()
    if (!session?.user?.id) redirect("/api/auth/signin")

    const server = await prisma.server.findUnique({
        where: { id },
        include: {
            node: true,
            iso: true // include currently attached iso info
        }
    })

    if (!server) return <div>Server not found</div>

    // Check permissions
    if (server.userId !== session.user.id && session.user.role !== "ADMIN") return <div>Unauthorized</div>

    // Fetch available ISOs for this user + Admin ISOs
    // (Similar logic to deploy page, or just all user's ISOs)
    const isos = await prisma.iso.findMany({
        where: {
            OR: [
                { userId: session.user.id },
                { userId: 'admin' }, // Assuming admin ISOs are public? Need to verify requirement
                // Or maybe userId: server.userId? 
                // Actually, if I'm the owner, I see my ISOs.
            ]
        },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="flex flex-col min-h-screen w-full bg-[#09090b]">
            <ServerHeader server={server} currentPage="Media" />
            <div className="p-6 max-w-6xl">
                <ServerMedia server={server} isos={isos} />
            </div>
        </div>
    )
}
