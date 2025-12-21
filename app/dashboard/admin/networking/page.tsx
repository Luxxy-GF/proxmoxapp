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
import { Badge } from "@/components/ui/badge"
import { Network, Trash2 } from "lucide-react"
import { AddIPPoolDialog } from "@/components/admin/add-ip-pool-dialog"
import { EditIPPoolDialog } from "@/components/admin/edit-ip-pool-dialog"
import { DeleteIPPoolButton } from "@/components/admin/delete-ip-pool-button"
import { ipToLong } from "@/lib/networking"

export default async function NetworkingPage() {
    const pools = await prisma.iPPool.findMany({
        include: {
            node: true,
            _count: {
                select: { allocations: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    const nodes = await prisma.node.findMany({
        select: { id: true, name: true }
    })

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Networking</h1>
                    <p className="text-muted-foreground">
                        Manage IP pools and network allocations.
                    </p>
                </div>
                <AddIPPoolDialog nodes={nodes} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>IP Pools</CardTitle>
                    <CardDescription>
                        Global IP ranges available for server provisioning.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Node</TableHead>
                                <TableHead>Range</TableHead>
                                <TableHead>Bridge / VLAN</TableHead>
                                <TableHead>Usage</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pools.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">
                                        No IP pools defined.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pools.map((pool) => {
                                    const total = ipToLong(pool.endIP) - ipToLong(pool.startIP) + 1
                                    const used = pool._count.allocations
                                    const percent = Math.round((used / total) * 100)

                                    return (
                                        <TableRow key={pool.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Network className="h-4 w-4 text-muted-foreground" />
                                                    <div>
                                                        <div>{pool.name}</div>
                                                        <div className="text-xs text-muted-foreground">{pool.gateway}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{pool.node.name}</TableCell>
                                            <TableCell>
                                                <div className="text-xs font-mono">
                                                    {pool.startIP} - {pool.endIP}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    /{pool.netmask.split('.').map(Number).reduce((a, b) => a + (b >>> 0).toString(2).split('1').length - 1, 0)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">{pool.bridge}</Badge>
                                                    {pool.vlan && <Badge variant="secondary">VLAN {pool.vlan}</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 w-24">
                                                    <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary"
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{percent}%</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {used} / {total} IPs
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {pool.enabled ? (
                                                    <Badge className="bg-green-500/15 text-green-500 hover:bg-green-500/25 border-green-500/20">Active</Badge>
                                                ) : (
                                                    <Badge variant="destructive">Disabled</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <EditIPPoolDialog pool={pool} nodes={nodes} />
                                                <DeleteIPPoolButton id={pool.id} disabled={used > 0} />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
