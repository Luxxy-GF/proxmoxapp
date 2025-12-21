import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { TemplateManager } from "@/components/admin/template-manager"

export default async function TemplatesPage() {
    const session = await auth()
    // if (session?.user?.role !== "ADMIN") return redirect("/dashboard")

    const groups = await prisma.templateGroup.findMany({
        include: {
            templates: {
                orderBy: { vmid: 'asc' }
            }
        },
        orderBy: { name: 'asc' }
    })

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">OS Templates</h1>
                <p className="text-muted-foreground">Manage operating system templates and groups.</p>
            </div>

            <TemplateManager initialGroups={groups} />
        </div>
    )
}
