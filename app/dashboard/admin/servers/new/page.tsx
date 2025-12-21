import { prisma } from "@/lib/db"
import { ServerCreationWizard } from "@/components/admin/server-creation-wizard"

export default async function NewServerPage() {
    // Fetch all necessary data for the form
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } })
    const nodes = await prisma.node.findMany() // Fetch all, disabled logic handles offline
    const products = await prisma.product.findMany()
    const groups = await prisma.templateGroup.findMany({
        include: { templates: true }
    })
    const ipPools = await prisma.iPPool.findMany({
        where: { enabled: true },
        include: { _count: { select: { allocations: true } } }
    })

    // Fetch all ISOs for admin
    const isos = await prisma.iso.findMany({
        include: { user: true },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="max-w-5xl mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Provision Server</h1>
                <p className="text-muted-foreground">Create a new server using the wizard below.</p>
            </div>

            <ServerCreationWizard
                users={users}
                nodes={nodes}
                products={products}
                groups={groups}
                ipPools={ipPools}
                isos={isos}
            />
        </div>
    )
}
