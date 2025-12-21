import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { NodeEditForm } from "@/components/admin/node-edit-form"
import { NodeStatsCard } from "@/components/admin/node-stats-card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Trash2 } from "lucide-react"
import Link from "next/link"
import { DeleteNodeButton } from "@/components/admin/delete-node-button"

export default async function NodeDetailsPage(props: { params: Promise<{ id: string }> }) {
    const session = await auth()
    // if (session?.user?.role !== "ADMIN") return redirect("/dashboard")

    // Await params if necessary (Next.js 15+ changes, but standard 14 is fine directly, 
    // though safe to await if it becomes a promise)
    const params = await props.params
    const { id } = params

    const node = await prisma.node.findUnique({
        where: { id: id }
    })

    if (!node) {
        notFound()
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/dashboard/admin/nodes">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">{node.name}</h2>
                        <p className="text-muted-foreground">{node.address}</p>
                    </div>
                </div>
                <DeleteNodeButton id={node.id} disabled={false} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="h-full">
                    <NodeEditForm node={node} />
                </div>
                <div className="h-full">
                    <NodeStatsCard
                        nodeId={node.id}
                        initialStats={{
                            cpuUsage: node.cpuUsage,
                            ramUsage: node.ramUsage,
                            diskUsage: node.diskUsage,
                            status: node.status
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
