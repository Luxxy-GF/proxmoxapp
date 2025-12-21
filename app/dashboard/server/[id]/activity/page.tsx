import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getVmTasks } from "@/lib/proxmox"

export default async function ActivityPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const server = await prisma.server.findUnique({
        where: { id },
        include: {
            node: true,
            subusers: { select: { userId: true } },
        }
    })

    if (!server) return <div className="p-6">Server not found</div>

    const isOwner = server.userId === session.user.id
    const isSubuser = server.subusers.some(s => s.userId === session.user.id)
    if (!isOwner && !isSubuser) return <div className="p-6">Unauthorized</div>

    let tasks: any[] = []
    let error: string | null = null

    if (!server.vmid || !server.node) {
        error = "No VMID or node assigned yet."
    } else {
        try {
            const data = await getVmTasks(server.node, server.vmid)
            tasks = Array.isArray(data) ? data : []
        } catch (e: any) {
            error = "Unable to load activity from Proxmox."
        }
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
                <p className="text-muted-foreground">
                    View server activity logs and audit trail
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Recent Proxmox tasks</CardTitle>
                    <CardDescription>Tasks scoped to this VMID from your node.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {error ? (
                        <div className="p-6 text-muted-foreground text-sm">{error}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Node</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tasks.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                            No recent tasks for this VM.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tasks.map((task) => (
                                        <TableRow key={task.upid}>
                                            <TableCell>
                                                {task.starttime ? new Date(task.starttime * 1000).toLocaleString() : "—"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{task.user || "system"}</TableCell>
                                            <TableCell className="uppercase text-xs text-muted-foreground">{task.type}</TableCell>
                                            <TableCell>{task.status || task.endtime ? "Finished" : "Running"}</TableCell>
                                            <TableCell>{task.node || server.node?.name}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
