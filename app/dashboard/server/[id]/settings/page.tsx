import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { ServerSettings } from "@/components/server/server-settings"

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const session = await auth()
    if (!session?.user?.id) redirect("/api/auth/signin")

    const server = await prisma.server.findUnique({
        where: { id },
        include: {
            node: true,
            resources: true,
            network: true,
            subscription: true,
            product: true,
            template: true,
            user: true
        }
    })

    if (!server) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold">Server not found</h1>
                    <p className="text-muted-foreground">The requested server could not be found.</p>
                </div>
            </div>
        )
    }

    if (server.userId !== session.user.id && session.user.role !== "ADMIN") {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold">Unauthorized</h1>
                    <p className="text-muted-foreground">You do not have permission to access this server.</p>
                </div>
            </div>
        )
    }

    return <ServerSettings server={server} userRole={session.user.role || "USER"} />
}
