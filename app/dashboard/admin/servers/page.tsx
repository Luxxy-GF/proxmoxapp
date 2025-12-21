import { prisma } from "@/lib/db"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Power, Server as ServerIcon, Play, Square, Pause, Trash2 } from "lucide-react"
import { AdminServerActions } from "@/components/admin/admin-server-actions"
import { Badge } from "@/components/ui/badge"

export default async function ServersPage() {
    const servers = await prisma.server.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            node: true,
            user: true
        }
    })

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Servers</h1>
                    <p className="text-muted-foreground">
                        Manage all servers across the infrastructure.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Instance List</CardTitle>
                    <CardDescription>
                        View and control user instances.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Server</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Node</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Billing</TableHead>
                                <TableHead>VMID</TableHead>
                                <TableHead className="text-right">Admin Controls</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {servers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">
                                        No servers provisioned yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                servers.map((server) => (
                                    <TableRow key={server.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <ServerIcon className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <div className="font-bold">vps-{server.id.slice(0, 5)}</div>
                                                    <div className="text-xs text-muted-foreground">{server.type}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">{server.user.name}</div>
                                            <div className="text-xs text-muted-foreground">{server.user.email}</div>
                                        </TableCell>
                                        <TableCell>{server.node.name}</TableCell>
                                        <TableCell>
                                            <Badge variant={server.status === 'RUNNING' ? 'default' : 'secondary'}>
                                                {server.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={server.billingStatus === 'ACTIVE' ? 'outline' : 'destructive'} className="uppercase">
                                                {server.billingStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{server.vmid || "N/A"}</TableCell>
                                        <TableCell className="text-right">
                                            <AdminServerActions id={server.id} status={server.status} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
