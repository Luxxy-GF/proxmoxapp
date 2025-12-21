import { finalizeCheckout } from "../actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface CheckoutPageProps {
  searchParams: { session_id?: string }
}

export default async function CheckoutStatusPage({ searchParams }: CheckoutPageProps) {
  const sessionId = typeof searchParams.session_id === "string" ? searchParams.session_id : undefined

  const result = sessionId ? await finalizeCheckout(sessionId) : { error: "Missing checkout session." }

  const isPaid = !result?.error && (result?.invoice?.status === "PAID" || result?.stripeStatus === "paid")

  if (result?.error) {
    return (
      <div className="p-6">
        <Card className="border-red-500/40 bg-red-500/5">
          <CardHeader>
            <CardTitle>Checkout issue</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Link href="/dashboard/store">
              <Button>Back to Store</Button>
            </Link>
            <Link href="/dashboard/billing">
              <Button variant="outline">View Billing</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>{isPaid ? "Payment received" : "Payment pending"}</CardTitle>
          <CardDescription>
            {isPaid
              ? "Stripe confirmed your payment. Funds are now available on your account."
              : "We are waiting for Stripe to confirm this checkout session."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.invoice && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Invoice</span>
                <span className="font-mono text-xs">{result.invoice.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-semibold">${result.invoice.amount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={isPaid ? "default" : "secondary"}>
                  {isPaid ? "PAID" : "PENDING"}
                </Badge>
              </div>
            </>
          )}

          <div className="pt-2 flex gap-3">
            <Link href="/dashboard">
              <Button>Return to dashboard</Button>
            </Link>
            <Link href="/dashboard/billing">
              <Button variant="outline">View invoices</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
