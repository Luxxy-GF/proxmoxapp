import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { DeployWizard } from "@/components/deploy-wizard"
import { getFeatureFlags } from "@/lib/settings"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function DeployPage() {
    const session = await auth()
    if (!session?.user?.id) return redirect("/login")

    const flags = await getFeatureFlags()
    const isEnabled = flags.deploy_enabled || session.user.role === "ADMIN"

    // Fetch necessary data for the wizard
    const groups = await prisma.templateGroup.findMany({
        include: { templates: true },
        orderBy: { name: 'asc' }
    })

    const products = await prisma.product.findMany({
        orderBy: { price: 'asc' }
    })

    const ipPools = await prisma.iPPool.findMany({
        where: { enabled: true },
        include: {
            node: true,
            allocations: true
        },
        orderBy: { name: 'asc' }
    })

    const isos = await prisma.iso.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' }
    })

    if (!isEnabled) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Deploy New Server</h1>
                    <p className="text-muted-foreground">Deployment is temporarily disabled.</p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Deployments are offline</CardTitle>
                        <CardDescription>
                            Please contact support or check back later. Admins can toggle deployments in Settings.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Deploy New Server</h1>
                <p className="text-muted-foreground">Choose your OS and resources to get started.</p>
            </div>

            <DeployWizard
                groups={groups}
                products={products}
                ipPools={ipPools}
                isos={isos}
            />
        </div>
    )
}
