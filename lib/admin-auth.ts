import { auth } from "@/auth"

export async function requireAdmin() {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
        throw new Error("Unauthorized: Admin access required")
    }

    return session
}
