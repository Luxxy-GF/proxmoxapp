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
import { Package } from "lucide-react"
import { AddProductDialog } from "@/components/admin/add-product-dialog"
import { DeleteProductButton } from "@/components/admin/delete-product-button"

export default async function ProductsPage() {
    const products = await prisma.product.findMany({
        orderBy: { price: "asc" },
        include: {
            _count: {
                select: { servers: true }
            }
        }
    })

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
                    <p className="text-muted-foreground">
                        Manage hosting plans and resource allocations.
                    </p>
                </div>
                <AddProductDialog />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Available Plans</CardTitle>
                    <CardDescription>
                        Plans available for users to provision.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Resources</TableHead>

                                <TableHead>Price</TableHead>
                                <TableHead>Active Servers</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">
                                        No plans created yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                products.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <div>{product.name}</div>
                                                    <div className="text-xs text-muted-foreground">{product.description}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="uppercase">{product.type}</TableCell>
                                        <TableCell>
                                            <div className="text-xs space-y-1">
                                                <div>{product.cpuCores} vCPU</div>
                                                <div>{product.memoryMB} MB RAM</div>
                                                <div>{product.diskGB} GB Disk</div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            ${product.price.toFixed(2)} / {product.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}
                                        </TableCell>
                                        <TableCell>{product._count.servers}</TableCell>
                                        <TableCell className="text-right">
                                            <DeleteProductButton id={product.id} disabled={product._count.servers > 0} />
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
