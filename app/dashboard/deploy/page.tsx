import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { DeployWizard } from "@/components/deploy-wizard"

export default async function DeployPage() {
    const session = await auth()
    // if (!session?.user) return redirect("/login")

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
            />
        </div>
    )
}
