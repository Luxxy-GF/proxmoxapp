import { getFeatureFlags, getStripeSettings } from "@/lib/settings"
import FeatureToggle from "@/components/admin/feature-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateStripeSettings } from "@/app/dashboard/admin/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default async function AdminSettingsPage() {
    const [flags, stripe] = await Promise.all([
        getFeatureFlags(),
        getStripeSettings()
    ])

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
                <p className="text-muted-foreground">
                    Control which experiences are visible to customers.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-zinc-950/60 border-zinc-800">
                    <CardHeader>
                        <CardTitle>Storefront</CardTitle>
                        <CardDescription>Show or hide the public store experience.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FeatureToggle
                            label="Enable store"
                            description="Allow customers to browse plans and start Stripe checkout."
                            flagKey="store_enabled"
                            defaultChecked={flags.store_enabled}
                        />
                    </CardContent>
                </Card>

                <Card className="bg-zinc-950/60 border-zinc-800">
                    <CardHeader>
                        <CardTitle>Deploy</CardTitle>
                        <CardDescription>Toggle access to the deployment wizard.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FeatureToggle
                            label="Enable deployments"
                            description="Allow customers to create new servers."
                            flagKey="deploy_enabled"
                            defaultChecked={flags.deploy_enabled}
                        />
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-zinc-950/60 border-zinc-800">
                <CardHeader>
                    <CardTitle>Stripe</CardTitle>
                    <CardDescription>Configure Stripe keys used for checkout and billing.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={updateStripeSettings} className="space-y-4 max-w-2xl">
                        <div className="space-y-2">
                            <Label htmlFor="publishableKey">Publishable key</Label>
                            <Input
                                id="publishableKey"
                                name="publishableKey"
                                defaultValue={stripe.publishableKey ?? ""}
                                placeholder="pk_live_..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="secretKey">Secret key</Label>
                            <Input
                                id="secretKey"
                                name="secretKey"
                                type="password"
                                defaultValue={stripe.secretKey ?? ""}
                                placeholder="sk_live_..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="webhookSecret">Webhook signing secret (optional)</Label>
                            <Input
                                id="webhookSecret"
                                name="webhookSecret"
                                type="password"
                                defaultValue={stripe.webhookSecret ?? ""}
                                placeholder="whsec_..."
                            />
                        </div>
                        <Button type="submit">Save Stripe settings</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
