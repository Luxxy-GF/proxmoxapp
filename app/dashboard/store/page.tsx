import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { StoreProductCard } from "@/components/billing/store-product-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getFeatureFlags, getStripeSettings } from "@/lib/settings"

export default async function StorePage({ searchParams }: { searchParams?: { cancelled?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [flags, stripe] = await Promise.all([getFeatureFlags(), getStripeSettings()])
  const isEnabled = flags.store_enabled || session.user.role === "ADMIN"

  const [products, user] = await Promise.all([
    prisma.product.findMany({
      orderBy: { price: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true, name: true },
    }),
  ])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit">Storefront</Badge>
        <h1 className="text-3xl font-bold tracking-tight">Launch-ready plans</h1>
        <p className="text-muted-foreground max-w-3xl">
          Choose a plan, pay securely with Stripe, and we&apos;ll credit your account instantly for deployments.
        </p>
      </div>

      {!isEnabled && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle>Store is currently disabled</CardTitle>
            <CardDescription>
              Please check back later. If you are an admin, toggle the store in Settings.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {searchParams?.cancelled && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardHeader>
            <CardTitle>Checkout cancelled</CardTitle>
            <CardDescription>You left Stripe without completing payment. Pick a plan to try again.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!stripe.publishableKey && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle>Stripe is not configured</CardTitle>
            <CardDescription>
              Add your publishable and secret keys in Admin &gt; Settings to enable checkout.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {isEnabled && (
        <div className="grid gap-6 lg:grid-cols-3 md:grid-cols-2">
          {products.length === 0 ? (
            <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
              <CardHeader>
                <CardTitle>No plans available</CardTitle>
                <CardDescription>
                  Add products from the admin area to start selling plans.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            products.map((product) => (
              <StoreProductCard key={product.id} product={product} />
            ))
          )}
        </div>
      )}

      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader>
          <CardTitle>Current balance</CardTitle>
          <CardDescription>
            Funds added through Stripe are credited automatically after payment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">${(user?.balance ?? 0).toFixed(2)}</div>
        </CardContent>
      </Card>
    </div>
  )
}
