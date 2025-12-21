import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@/components/ui/breadcrumb"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()
    const servers = session?.user?.id ? await prisma.server.findMany({
        where: {
            OR: [
                { userId: session.user.id },
                { subusers: { some: { userId: session.user.id } } }
            ]
        },
        select: { id: true, name: true }
    }) : []

    const user = session?.user ? {
        name: session.user.name || "User",
        email: session.user.email || "",
        avatar: session.user.image || "/avatars/shadcn.jpg",
        role: session.user.role,
    } : { name: "User", email: "", avatar: "", role: "USER" }


    return (
        <SidebarProvider>
            <AppSidebar servers={servers} user={user} />
            <SidebarInset>
                {children}
            </SidebarInset>
        </SidebarProvider>
    )
}
