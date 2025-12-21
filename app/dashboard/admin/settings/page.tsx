import { getFeatureFlags } from "@/lib/settings"
import FeatureToggle from "@/components/admin/feature-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function AdminSettingsPage() {
    const flags = await getFeatureFlags()

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
                <p className="text-muted-foreground">
                    Control which experiences are visible to customers.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Storefront</CardTitle>
                        <CardDescription>Show or hide the public store experience.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FeatureToggle
                            label="Enable store"
                            description="Allow customers to browse plans and start Stripe checkout."
                            flagKey="store_enabled"
                            defaultChecked={flags.store_enabled}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Deploy</CardTitle>
                        <CardDescription>Toggle access to the deployment wizard.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FeatureToggle
                            label="Enable deployments"
                            description="Allow customers to create new servers."
                            flagKey="deploy_enabled"
                            defaultChecked={flags.deploy_enabled}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
