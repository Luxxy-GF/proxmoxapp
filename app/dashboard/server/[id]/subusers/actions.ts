"use server"

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const addSubuserSchema = z.object({
    email: z.string().email(),
    permissions: z.array(z.string()).default([])
})

export async function getSubusers(serverId: string) {
    try {
        const subusers = await prisma.serverUser.findMany({
            where: { serverId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true
                    }
                }
            }
        })
        return { success: true, subusers }
    } catch (error) {
        console.error("Failed to fetch subusers:", error)
        return { error: "Failed to fetch subusers" }
    }
}

export async function addSubuser(serverId: string, formData: FormData) {
    const email = formData.get("email") as string

    // Parse permissions if sent as JSON, otherwise default
    // For simplicity in this first pass, we might just default to basic permissions or parse a string
    const permissionsRaw = formData.get("permissions")
    let permissions: string[] = []
    if (permissionsRaw) {
        try {
            permissions = JSON.parse(permissionsRaw as string)
        } catch (e) { }
    }

    try {
        // Validation
        const validated = addSubuserSchema.parse({ email, permissions })

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: validated.email }
        })

        if (!user) {
            return { error: "User not found with that email" }
        }

        // Check if already added
        const existing = await prisma.serverUser.findUnique({
            where: {
                serverId_userId: {
                    serverId,
                    userId: user.id
                }
            }
        })

        if (existing) {
            return { error: "User is already a subuser on this server" }
        }

        // Add subuser
        await prisma.serverUser.create({
            data: {
                serverId,
                userId: user.id,
                permissions: validated.permissions // Prisma handles JSON automatically? Validated.permissions is string[], expect prisma to handle it if mapped to Json
            }
        })

        revalidatePath(`/dashboard/server/${serverId}/subusers`)
        return { success: true }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        console.error("Failed to add subuser:", error)
        return { error: "Failed to add subuser" }
    }
}

export async function removeSubuser(serverId: string, userId: string) {
    try {
        await prisma.serverUser.delete({
            where: {
                serverId_userId: {
                    serverId,
                    userId
                }
            }
        })
        revalidatePath(`/dashboard/server/${serverId}/subusers`)
        return { success: true }
    } catch (error) {
        console.error("Failed to remove subuser:", error)
        return { error: "Failed to remove subuser" }
    }
}
