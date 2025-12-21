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
import { Button } from "@/components/ui/button"
import { InvoiceActions } from "@/components/admin/invoice-actions"

export default async function BillingPage() {
    const invoices = await prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        include: { user: true }
    })

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Billing & Invoices</h1>
                <p className="text-muted-foreground">
                    Manage system-wide invoices and payments.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Invoices</CardTitle>
                    <CardDescription>
                        All generated invoices.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice ID</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">
                                        No invoices found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                invoices.map((inv) => (
                                    <TableRow key={inv.id}>
                                        <TableCell className="font-mono text-xs">{inv.id}</TableCell>
                                        <TableCell>
                                            <div>{inv.user.name}</div>
                                            <div className="text-xs text-muted-foreground">{inv.user.email}</div>
                                        </TableCell>
                                        <TableCell>${inv.amount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Badge variant={inv.status === 'PAID' ? 'default' : inv.status === 'CANCELLED' ? 'secondary' : 'destructive'}>
                                                {inv.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{inv.dueDate.toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <InvoiceActions id={inv.id} status={inv.status} />
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
