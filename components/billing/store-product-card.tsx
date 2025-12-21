"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { createCheckoutSession } from "@/app/dashboard/billing/actions"

interface StoreProductCardProps {
  product: {
    id: string
    name: string
    description?: string | null
    price: number
    billingCycle: string
    cpuCores: number
    memoryMB: number
    diskGB: number
    type: string
  }
}

export function StoreProductCard({ product }: StoreProductCardProps) {
  const [isLoading, startTransition] = useTransition()

  const handleCheckout = () => {
    startTransition(async () => {
      const res = await createCheckoutSession(product.id)
      if (res?.error) {
        toast.error(res.error)
        return
      }

      if (res?.url) {
        window.location.href = res.url
        return
      }

      toast.error("Stripe did not return a checkout URL.")
    })
  }

  return (
    <Card className="h-full border-zinc-800 bg-zinc-950/60">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{product.name}</CardTitle>
            <CardDescription className="capitalize">{product.type}</CardDescription>
          </div>
          <Badge variant="outline" className="uppercase">
            {product.billingCycle}
          </Badge>
        </div>
        {product.description && (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">${product.price.toFixed(2)}</span>
          <span className="text-muted-foreground text-sm">/{product.billingCycle === "YEARLY" ? "yr" : "mo"}</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>{product.cpuCores} vCPU</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>{product.memoryMB} MB RAM</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>{product.diskGB} GB SSD</span>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleCheckout}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirecting to Stripe...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Buy with Stripe
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
