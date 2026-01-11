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
import { PlusCircle, Server, Trash2, Cpu } from "lucide-react"
import { AddDedicatedNodeDialog } from "@/components/admin/add-dedicated-node-dialog"
import { DedicatedNodeActions } from "@/components/admin/dedicated-node-actions"
// Reuse existing components where applicable or create generic ones if needed
// import { EditNodeDialog } from "@/components/admin/edit-node-dialog" 
// import { DeleteNodeButton } from "@/components/admin/delete-node-button"
// import { RefreshNodeButton } from "@/components/admin/refresh-node-button"

export default async function DedicatedNodesPage() {
    const nodes = await prisma.dedicatedNode.findMany({
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
                    <h1 className="text-3xl font-bold tracking-tight">Dedicated Nodes</h1>
                    <p className="text-muted-foreground">
                        Manage physical locations and Agent controllers.
                    </p>
                </div>
                <AddDedicatedNodeDialog />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Infrastructure Controllers</CardTitle>
                    <CardDescription>
                        Nodes running the Luxxy Agent for bare metal management.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Servers</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {nodes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">
                                        No nodes found. Add your first dedicated node via API/Seed.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                nodes.map((node) => (
                                    <TableRow key={node.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Cpu className="h-4 w-4" />
                                                {node.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>{node.address}</TableCell>
                                        <TableCell>{node.location || 'Unknown'}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                {node.status}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                Dedi: {node._count.servers}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DedicatedNodeActions id={node.id} />
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
