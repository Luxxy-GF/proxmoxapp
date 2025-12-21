const STRIPE_API_BASE = "https://api.stripe.com/v1"

type StripeMethod = "GET" | "POST"

interface StripeRequestOptions {
  path: string
  method?: StripeMethod
  body?: URLSearchParams
}

interface StripeCheckoutSession {
  id: string
  url?: string
  client_secret?: string
  payment_status?: string
  status?: string
  amount_total?: number
  currency?: string
  metadata?: Record<string, string>
  payment_intent?: string
}

function getStripeSecret() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured in the environment")
  }
  return secret
}

async function stripeRequest<T>({
  path,
  method = "GET",
  body,
}: StripeRequestOptions): Promise<T> {
  const secret = getStripeSecret()

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Stripe request failed (${response.status}): ${errorText || "Unknown error"}`,
    )
  }

  return (await response.json()) as T
}

export async function createStripeCheckoutSession(options: {
  productName: string
  amountCents: number
  currency?: string
  description?: string | null
  successUrl: string
  cancelUrl: string
  customerEmail?: string | null
  metadata?: Record<string, string>
  uiMode?: "embedded" | "hosted"
}) {
  const {
    productName,
    amountCents,
    currency = "usd",
    description,
    successUrl,
    cancelUrl,
    customerEmail,
    metadata = {},
    uiMode = "embedded",
  } = options

  const body = new URLSearchParams()
  body.append("mode", "payment")
  body.append("ui_mode", uiMode)
  body.append("payment_method_types[0]", "card")
  body.append("success_url", successUrl)
  body.append("cancel_url", cancelUrl)

  body.append("line_items[0][price_data][currency]", currency)
  body.append("line_items[0][price_data][product_data][name]", productName)
  if (description) {
    body.append("line_items[0][price_data][product_data][description]", description)
  }
  body.append("line_items[0][price_data][unit_amount]", amountCents.toString())
  body.append("line_items[0][quantity]", "1")

  if (customerEmail) {
    body.append("customer_email", customerEmail)
  }

  Object.entries(metadata).forEach(([key, value]) => {
    body.append(`metadata[${key}]`, value)
  })

  return await stripeRequest<StripeCheckoutSession>({
    path: "/checkout/sessions",
    method: "POST",
    body,
  })
}

export async function retrieveStripeCheckoutSession(sessionId: string) {
  const query = new URLSearchParams()
  query.append("expand[]", "payment_intent")

  return await stripeRequest<StripeCheckoutSession>({
    path: `/checkout/sessions/${sessionId}?${query.toString()}`,
    method: "GET",
  })
}
