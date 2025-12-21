import ServerOverviewPage from "@/components/server/server-overview"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"

export default async function Page({ params }: { params: { id: string } }) {
    // Await params if Next.js 15+, but this is 16? Next 15+ params are promises.
    // The previous code had `params: { id: string }` so we assume synchronous or handled.
    // If Next.js 15, `params` is a Promise. Let's assume standard app directory behavior.
    // However, user setup shows Next 16.1.0. Params might be async.
    // Safest is to await it if it's a promise, but TS might complain if types differ.
    // Let's defer to the fact that previous code looked like `{ params: { id: string } }`.

    // Actually, in Next.js 15+, params is a Promise. To be safe in Next 16:
    const { id } = await params

    const session = await auth()
    if (!session?.user?.id) redirect("/api/auth/signin")

    const server = await prisma.server.findUnique({
        where: { id: id },
        include: {
            node: true,
            resources: true,
            subusers: true
        }
    })

    if (!server) return <div>Server not found</div>

    // Check if user owns the server OR is a subuser with access
    const isOwner = server.userId === session.user.id
    const isSubuser = server.subusers?.some(su => su.userId === session.user.id)

    if (!isOwner && !isSubuser) return <div>Unauthorized</div>

    return <ServerOverviewPage server={server} />
}
