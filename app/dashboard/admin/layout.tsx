import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
        redirect("/dashboard")
    }

    return <div className="p-6 space-y-6">{children}</div>
}
