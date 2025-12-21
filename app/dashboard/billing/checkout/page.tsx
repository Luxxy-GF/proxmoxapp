import { getCheckoutSession, finalizeCheckout } from "../actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EmbeddedCheckout } from "@/components/billing/embedded-checkout"
import { Badge } from "@/components/ui/badge"

interface CheckoutPageProps {
  searchParams: { session_id?: string }
}

export default async function CheckoutStatusPage({ searchParams }: CheckoutPageProps) {
  const sessionId = typeof searchParams.session_id === "string" ? searchParams.session_id : undefined
  if (!sessionId) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Checkout session missing</CardTitle>
            <CardDescription>Please start from the store to create a checkout session.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/store">
              <Button>Back to Store</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const checkout = await getCheckoutSession(sessionId)

  if (checkout?.error || !checkout?.clientSecret) {
    return (
      <div className="p-6">
        <Card className="border-red-500/40 bg-red-500/5">
          <CardHeader>
            <CardTitle>Checkout issue</CardTitle>
            <CardDescription>{checkout?.error || "Unable to load checkout session."}</CardDescription>
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

  const paymentComplete = checkout.paymentStatus === "paid" || checkout.status === "complete"
  const invoiceResult = paymentComplete ? await finalizeCheckout(sessionId) : null

  return (
    <div className="p-6 space-y-4">
      {!paymentComplete && (
        <EmbeddedCheckout
          clientSecret={checkout.clientSecret}
          sessionId={checkout.sessionId}
          publishableKey={checkout.publishableKey || ""}
        />
      )}

      {paymentComplete && invoiceResult?.invoice && (
        <Card>
          <CardHeader>
            <CardTitle>Payment received</CardTitle>
            <CardDescription>Funds have been applied to your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Invoice</span>
              <span className="font-mono text-xs">{invoiceResult.invoice.id}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Amount</span>
              <span className="font-semibold text-foreground">${invoiceResult.invoice.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Status</span>
              <Badge>PAID</Badge>
            </div>
            <div className="pt-3 flex gap-2">
              <Link href="/dashboard">
                <Button>Return to dashboard</Button>
              </Link>
              <Link href="/dashboard/billing">
                <Button variant="outline">View invoices</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
