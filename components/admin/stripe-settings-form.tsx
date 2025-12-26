"use client"

import { useActionState } from "react"
import { updateStripeSettings } from "@/app/dashboard/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useEffect } from "react"

interface StripeSettingsFormProps {
    initialSettings: {
        publishableKey: string | null
        secretKey: string | null
        webhookSecret: string | null
    }
}

export function StripeSettingsForm({ initialSettings }: StripeSettingsFormProps) {
    const [state, action, isPending] = useActionState(updateStripeSettings, null)

    useEffect(() => {
        if (state?.error) {
            toast.error(state.error)
        } else if (state?.success) {
            toast.success("Stripe settings updated")
        }
    }, [state])

    return (
        <form action={action} className="space-y-4 max-w-2xl">
            <div className="space-y-2">
                <Label htmlFor="publishableKey">Publishable key</Label>
                <Input
                    id="publishableKey"
                    name="publishableKey"
                    defaultValue={initialSettings.publishableKey ?? ""}
                    placeholder="pk_live_..."
                />
                {state?.issues?.publishableKey && (
                    <p className="text-sm text-destructive">{state.issues.publishableKey[0]}</p>
                )}
            </div>
            <div className="space-y-2">
                <Label htmlFor="secretKey">Secret key</Label>
                <Input
                    id="secretKey"
                    name="secretKey"
                    type="password"
                    defaultValue={initialSettings.secretKey ?? ""}
                    placeholder="sk_live_..."
                />
                {state?.issues?.secretKey && (
                    <p className="text-sm text-destructive">{state.issues.secretKey[0]}</p>
                )}
            </div>
            <div className="space-y-2">
                <Label htmlFor="webhookSecret">Webhook signing secret (optional)</Label>
                <Input
                    id="webhookSecret"
                    name="webhookSecret"
                    type="password"
                    defaultValue={initialSettings.webhookSecret ?? ""}
                    placeholder="whsec_..."
                />
            </div>
            <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Stripe settings"}
            </Button>
        </form>
    )
}
