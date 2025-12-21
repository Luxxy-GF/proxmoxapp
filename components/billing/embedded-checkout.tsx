"use client"

import { useMemo } from "react"
import { CheckoutProvider, PaymentElement } from "@stripe/react-stripe-js/checkout"
import { loadStripe } from "@stripe/stripe-js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

const getStripePromise = () => {
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!pk) return null
  return loadStripe(pk)
}

interface EmbeddedCheckoutProps {
  clientSecret: string
  sessionId: string
}

export function EmbeddedCheckout({ clientSecret, sessionId }: EmbeddedCheckoutProps) {
  const stripePromise = useMemo(() => getStripePromise(), [])

  if (!stripePromise) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Stripe is not configured</AlertTitle>
        <AlertDescription>Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable checkout.</AlertDescription>
      </Alert>
    )
  }

  return (
    <CheckoutProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "night" },
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Secure checkout</CardTitle>
          <CardDescription>Session: {sessionId}</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentElement />
        </CardContent>
      </Card>
    </CheckoutProvider>
  )
}
