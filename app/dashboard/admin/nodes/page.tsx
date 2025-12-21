import Link from "next/link"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
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
import { PlusCircle, Server, Trash2 } from "lucide-react"
import { AddNodeDialog } from "@/components/admin/add-node-dialog"
import { EditNodeDialog } from "@/components/admin/edit-node-dialog"
import { DeleteNodeButton } from "@/components/admin/delete-node-button"
import { RefreshNodeButton } from "@/components/admin/refresh-node-button"

export default async function NodesPage() {
    const nodes = await prisma.node.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: { servers: true },
            },
        },
    })

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Nodes</h1>
                    <p className="text-muted-foreground">
                        Manage Proxmox nodes and connection credentials.
                    </p>
                </div>
                <AddNodeDialog />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Infrastructure Nodes</CardTitle>
                    <CardDescription>
                        List of all registered Proxmox nodes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead>Proxmox ID</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Usage (CPU/RAM/Disk)</TableHead>
                                <TableHead>Servers</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {nodes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">
                                        No nodes found. Add your first node to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                nodes.map((node) => (
                                    <TableRow key={node.id}>
                                        <TableCell className="font-medium">
                                            <Link href={`/dashboard/admin/nodes/${node.id}`} className="hover:underline flex items-center gap-2">
                                                <Server className="h-4 w-4" />
                                                {node.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{node.address}</TableCell>
                                        <TableCell>{node.proxmoxId}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className={`h-2 w-2 rounded-full ${node.status === 'Online' ? 'bg-green-500' : 'bg-red-500'}`} />
                                                {node.status}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs space-y-1">
                                                <div>CPU: {node.cpuUsage.toFixed(1)}%</div>
                                                <div>RAM: {node.ramUsage.toFixed(1)}%</div>
                                                <div>Disk: {node.diskUsage.toFixed(1)}%</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{node._count.servers}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <RefreshNodeButton id={node.id} />
                                                <EditNodeDialog node={node} />
                                                <DeleteNodeButton id={node.id} disabled={node._count.servers > 0} />
                                            </div>
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
