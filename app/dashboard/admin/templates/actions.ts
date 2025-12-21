"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"

// Template Groups

export async function createTemplateGroup(name: string) {
    // const session = await auth()
    // if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" }

    try {
        await prisma.templateGroup.create({
            data: { name }
        })
        revalidatePath("/dashboard/admin/templates")
        return { success: true }
    } catch (error) {
        return { error: "Failed to create group" }
    }
}

export async function deleteTemplateGroup(id: string) {
    // const session = await auth()
    // if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" }

    try {
        await prisma.templateGroup.delete({
            where: { id }
        })
        revalidatePath("/dashboard/admin/templates")
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete group" }
    }
}

export async function updateTemplateGroup(id: string, name: string) {
    // const session = await auth()
    // if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" }

    try {
        await prisma.templateGroup.update({
            where: { id },
            data: { name }
        })
        revalidatePath("/dashboard/admin/templates")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update group" }
    }
}


// Templates

export async function createTemplate(groupId: string, name: string, vmid: number, image?: string) {
    // const session = await auth()
    // if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" }

    try {
        await prisma.template.create({
            data: {
                name,
                vmid,
                image,
                groupId
            }
        })
        revalidatePath("/dashboard/admin/templates")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Failed to create template" }
    }
}

export async function deleteTemplate(id: string) {
    // const session = await auth()
    // if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" }

    try {
        await prisma.template.delete({
            where: { id }
        })
        revalidatePath("/dashboard/admin/templates")
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete template" }
    }
}

export async function updateTemplate(id: string, data: { name?: string, vmid?: number, image?: string }) {
    // const session = await auth()
    // if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" }

    try {
        await prisma.template.update({
            where: { id },
            data
        })
        revalidatePath("/dashboard/admin/templates")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update template" }
    }
}
