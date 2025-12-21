"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import {
    setAutoStart,
    deleteVm,
    getAvailableTemplates,
    setPassword,
    forceReboot,
    rebootVm,
    cloneLxc,
    cloneQemu,
    startVm,
    stopVm,
    waitForTask
} from "@/lib/proxmox"
import { releaseIPs } from "@/lib/networking"
import { revalidatePath } from "next/cache"

// Helper to validate server ownership and state
async function validateServerAccess(serverId: string) {
    const session = await auth()
    if (!session?.user?.id) {
        return { error: "Unauthorized" as const, server: null, user: null }
    }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: {
            node: true,
            resources: true,
            network: true,
            subscription: true,
            product: true,
            template: true
        }
    })

    if (!server) {
        return { error: "Server not found" as const, server: null, user: null }
    }

    if (server.userId !== session.user.id && session.user.role !== "ADMIN") {
        return { error: "Unauthorized" as const, server: null, user: null }
    }

    return { error: null, server, user: session.user }
}

// General Settings
export async function updateGeneralSettings(serverId: string, data: {
    displayName?: string
    description?: string
    timezone?: string
}) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    try {
        await prisma.server.update({
            where: { id: serverId },
            data: {
                displayName: data.displayName,
                description: data.description,
                timezone: data.timezone
            }
        })

        revalidatePath(`/dashboard/server/${serverId}`)
        revalidatePath(`/dashboard/server/${serverId}/settings`)
        return { success: true }
    } catch (err) {
        console.error("Failed to update general settings:", err)
        return { error: "Failed to update settings" }
    }
}

// Power & Behavior Settings
export async function updatePowerSettings(serverId: string, data: {
    autoStart?: boolean
}) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    if (!server.vmid) {
        return { error: "Server has no VMID" }
    }

    try {
        // Update database first (source of truth)
        await prisma.server.update({
            where: { id: serverId },
            data: { autoStart: data.autoStart }
        })

        // Then update Proxmox
        if (data.autoStart !== undefined) {
            await setAutoStart(server.node, server.vmid, server.type as "qemu" | "lxc", data.autoStart)
        }

        revalidatePath(`/dashboard/server/${serverId}/settings`)
        return { success: true }
    } catch (err) {
        console.error("Failed to update power settings:", err)
        return { error: "Failed to update power settings" }
    }
}

export async function performGracefulReboot(serverId: string) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    if (!server.vmid) {
        return { error: "Server has no VMID" }
    }

    if (server.billingStatus === "SUSPENDED" || server.billingStatus === "OVERDUE") {
        return { error: "Server is suspended or overdue" }
    }

    try {
        await rebootVm(server.node, server.vmid, server.type as "qemu" | "lxc")
        revalidatePath(`/dashboard/server/${serverId}`)
        return { success: true }
    } catch (err) {
        console.error("Failed to reboot server:", err)
        return { error: "Failed to reboot server" }
    }
}

export async function performForceReboot(serverId: string) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    if (!server.vmid) {
        return { error: "Server has no VMID" }
    }

    if (server.billingStatus === "SUSPENDED" || server.billingStatus === "OVERDUE") {
        return { error: "Server is suspended or overdue" }
    }

    try {
        await forceReboot(server.node, server.vmid, server.type as "qemu" | "lxc")
        revalidatePath(`/dashboard/server/${serverId}`)
        return { success: true }
    } catch (err) {
        console.error("Failed to force reboot server:", err)
        return { error: "Failed to force reboot server" }
    }
}

// Console & Access Settings
export async function updateConsoleSettings(serverId: string, data: {
    consoleType?: string
    consoleDisabled?: boolean
}) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    try {
        await prisma.server.update({
            where: { id: serverId },
            data: {
                consoleType: data.consoleType,
                consoleDisabled: data.consoleDisabled
            }
        })

        revalidatePath(`/dashboard/server/${serverId}/settings`)
        return { success: true }
    } catch (err) {
        console.error("Failed to update console settings:", err)
        return { error: "Failed to update console settings" }
    }
}

// Network Settings
export async function updateNetworkSettings(serverId: string, data: {
    reverseDns?: string
    firewallProfile?: string
}) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    try {
        await prisma.server.update({
            where: { id: serverId },
            data: {
                reverseDns: data.reverseDns,
                firewallProfile: data.firewallProfile
            }
        })

        revalidatePath(`/dashboard/server/${serverId}/settings`)
        return { success: true }
    } catch (err) {
        console.error("Failed to update network settings:", err)
        return { error: "Failed to update network settings" }
    }
}

// Backup Settings
export async function updateBackupSettings(serverId: string, data: {
    backupEnabled?: boolean
    backupSchedule?: string
    backupRetention?: number
    backupMode?: string
    allowRestore?: boolean
}) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    try {
        await prisma.server.update({
            where: { id: serverId },
            data: {
                backupEnabled: data.backupEnabled,
                backupSchedule: data.backupSchedule,
                backupRetention: data.backupRetention,
                backupMode: data.backupMode,
                allowRestore: data.allowRestore
            }
        })

        revalidatePath(`/dashboard/server/${serverId}/settings`)
        return { success: true }
    } catch (err) {
        console.error("Failed to update backup settings:", err)
        return { error: "Failed to update backup settings" }
    }
}

// Security Settings
export async function resetRootPassword(serverId: string) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    if (!server.vmid) {
        return { error: "Server has no VMID" }
    }

    try {
        // Generate random password
        const newPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + "!1"

        await setPassword(server.node, server.vmid, server.type as "qemu" | "lxc", newPassword)

        return { success: true, password: newPassword }
    } catch (err) {
        console.error("Failed to reset password:", err)
        return { error: "Failed to reset password" }
    }
}

export async function updateSecuritySettings(serverId: string, data: {
    sshKeysOnly?: boolean
}) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    try {
        await prisma.server.update({
            where: { id: serverId },
            data: {
                sshKeysOnly: data.sshKeysOnly
            }
        })

        revalidatePath(`/dashboard/server/${serverId}/settings`)
        return { success: true }
    } catch (err) {
        console.error("Failed to update security settings:", err)
        return { error: "Failed to update security settings" }
    }
}

// Get available templates
export async function getServerTemplates(serverId: string) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error, templates: null }

    try {
        const templates = await getAvailableTemplates(server.node)

        // Also get database templates
        const dbTemplates = await prisma.template.findMany({
            include: {
                group: true
            }
        })

        return { success: true, templates, dbTemplates }
    } catch (err) {
        console.error("Failed to get templates:", err)
        return { error: "Failed to get templates", templates: null }
    }
}

// Reinstall Server
export async function reinstallServer(serverId: string, data: {
    templateId?: string
    templateVmid?: number
    templateType?: "lxc" | "qemu"
    resetPassword: boolean
    keepIp: boolean
}) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    if (!server.vmid) {
        return { error: "Server has no VMID" }
    }

    if (server.billingStatus === "SUSPENDED" || server.billingStatus === "OVERDUE") {
        return { error: "Server is suspended or overdue" }
    }

    // Resolve template details
    let sourceVmid: number | undefined
    let sourceType: "lxc" | "qemu" | undefined

    if (data.templateId) {
        const template = await prisma.template.findUnique({ where: { id: data.templateId } })
        if (template) {
            sourceVmid = template.vmid
            sourceType = template.type as "lxc" | "qemu"
        }
    } else if (data.templateVmid && data.templateType) {
        sourceVmid = data.templateVmid
        sourceType = data.templateType
    }

    if (!sourceVmid || !sourceType) {
        return { error: "Invalid template selection" }
    }

    try {
        // 1. Stop the server (force stop to be sure)
        try {
            const stopUpid = await stopVm(server.node, server.vmid, server.type as "lxc" | "qemu")
            // Start is async, stop might return UPID or just null if already stopped?
            // stopVm returns UPID.
            if (typeof stopUpid === 'string') await waitForTask(server.node, stopUpid)
        } catch (e) {
            // Ignore if already stopped
            console.log("Stop failed (likely already stopped)", e)
        }

        // 2. Delete the current VM
        // We reuse the VMID, so we must delete the old one first.
        try {
            const deleteUpid = await deleteVm(server.node, server.vmid, server.type as "lxc" | "qemu")
            if (typeof deleteUpid === 'string') await waitForTask(server.node, deleteUpid)
        } catch (e) {
            console.error("Failed to delete old VM", e)
            return { error: "Failed to clean up old server instance" }
        }

        // 3. Clone from template
        // We reuse the same VMID
        let cloneUpid: string
        if (sourceType === "lxc") {
            cloneUpid = await cloneLxc(
                server.node,
                sourceVmid,
                server.vmid,
                server.name,
                server.description || undefined
            )
        } else {
            cloneUpid = await cloneQemu(
                server.node,
                sourceVmid,
                server.vmid,
                server.name,
                server.description || undefined
            )
        }

        await waitForTask(server.node, cloneUpid)

        // 4. Generate new password if requested
        if (data.resetPassword) {
            const newPassword = Math.random().toString(36).slice(-12) + "!1"
            await setPassword(server.node, server.vmid, sourceType, newPassword)
        }

        // 5. Start the server
        await startVm(server.node, server.vmid, sourceType)

        // 6. Update database
        await prisma.server.update({
            where: { id: serverId },
            data: {
                // If using DB template, link it. If raw, maybe create one? or just leave null?
                templateId: data.templateId || null,
                type: sourceType
            }
        })

        revalidatePath(`/dashboard/server/${serverId}`)
        return { success: true }
    } catch (err: any) {
        console.error("Failed to reinstall server:", err)
        return { error: `Failed to reinstall server: ${err.message}` }
    }
}

// Delete Server (Danger Zone)
export async function deleteServer(serverId: string, confirmName: string) {
    const { error, server } = await validateServerAccess(serverId)
    if (error || !server) return { error }

    // Confirm server name matches
    if (confirmName !== server.name) {
        return { error: "Server name does not match" }
    }

    if (!server.vmid) {
        return { error: "Server has no VMID" }
    }

    try {
        // Release IP allocations FIRST (before Proxmox delete)
        await releaseIPs(serverId)

        // Delete from Proxmox
        await deleteVm(server.node, server.vmid, server.type as "qemu" | "lxc")

        // Delete from database (cascades will handle relations)
        await prisma.server.delete({
            where: { id: serverId }
        })

        revalidatePath("/dashboard")
        return { success: true, redirect: "/dashboard" }
    } catch (err) {
        console.error("Failed to delete server:", err)
        return { error: "Failed to delete server" }
    }
}
