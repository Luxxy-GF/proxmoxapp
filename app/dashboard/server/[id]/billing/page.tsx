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
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function BillingPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const server = await prisma.server.findUnique({
        where: { id },
        include: {
            subscription: true,
            product: true,
            subusers: { select: { userId: true } }
        }
    })

    if (!server) {
        return <div className="p-6">Server not found</div>
    }

    const isOwner = server.userId === session.user.id
    const isSubuser = server.subusers.some(s => s.userId === session.user.id)
    if (!isOwner && !isSubuser) {
        return <div className="p-6">Unauthorized</div>
    }

    if (isSubuser && !server.subscription) {
        return (
            <div className="p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Billing restricted</CardTitle>
                        <CardDescription>
                            Billing history is only visible when this server is linked to a subscription.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    const invoices = await prisma.invoice.findMany({
        where: {
            userId: server.userId,
            ...(server.subscription ? { subscriptionId: server.subscription.id } : isSubuser ? { id: "" } : {}),
        },
        orderBy: { createdAt: "desc" },
    })

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
                    <p className="text-muted-foreground">
                        Track payments and renewal dates for this server.
                    </p>
                </div>
                <Link href="/dashboard/billing">
                    <Button variant="outline">Account Billing</Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>
                        Current plan and renewal timeline.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <div>
                        <div className="text-sm text-muted-foreground">Plan</div>
                        <div className="font-semibold">
                            {server.product ? `${server.product.name} (${server.product.type.toUpperCase()})` : "Custom"}
                        </div>
                        {server.product && (
                            <div className="text-xs text-muted-foreground">
                                {server.product.cpuCores} vCPU • {server.product.memoryMB} MB RAM • {server.product.diskGB} GB SSD
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-sm text-muted-foreground">Billing Status</div>
                        <Badge className="mt-1">{server.billingStatus}</Badge>
                    </div>
                    <div>
                        <div className="text-sm text-muted-foreground">Next Invoice</div>
                        <div className="font-semibold">
                            {server.subscription?.currentPeriodEnd
                                ? new Date(server.subscription.currentPeriodEnd).toLocaleDateString()
                                : "Not scheduled"}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Invoices</CardTitle>
                    <CardDescription>Invoices related to this server or your account.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Due</TableHead>
                                <TableHead>Paid</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No invoices have been generated for this server yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                invoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-mono text-xs">{invoice.id}</TableCell>
                                        <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    invoice.status === "PAID"
                                                        ? "default"
                                                        : invoice.status === "CANCELLED"
                                                            ? "secondary"
                                                            : "outline"
                                                }
                                            >
                                                {invoice.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                                        <TableCell>{invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "—"}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle>Need to add funds?</CardTitle>
                    <CardDescription>Go to the store to pay through Stripe and credit your balance.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/dashboard/store">
                        <Button>Open Store</Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    )
}
