"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import {
    getVmStatus as getProxmoxVmStatus,
    startVm,
    stopVm,
    shutdownVm,
    rebootVm,
    resetVm,
    suspendVm,
    resumeVm,
    getGuestAgentNetworkInfo
} from "@/lib/proxmox"
import { revalidatePath } from "next/cache"

export async function pollVmStatus(serverId: string) {
    const session = await auth()
    if (!session?.user?.id) {
        return { error: "Unauthorized" }
    }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: { node: true }
    })

    if (!server || server.userId !== session.user.id) {
        return { error: "Server not found or unauthorized" }
    }

    if (!server.vmid) {
        return { error: "Server has no VMID" }
    }

    try {
        const status = await getProxmoxVmStatus(server.node, server.vmid, server.type as "qemu" | "lxc")
        return { success: true, data: status }
    } catch (error) {
        console.error("Failed to poll VM status:", error)
        return { error: "Failed to fetch status" }
    }
}

export async function powerAction(serverId: string, action: "start" | "stop" | "shutdown" | "reboot" | "reset" | "suspend" | "resume") {
    const session = await auth()
    if (!session?.user?.id) {
        return { error: "Unauthorized" }
    }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: { node: true }
    })

    if (!server || server.userId !== session.user.id) {
        return { error: "Server not found or unauthorized" }
    }

    if (!server.vmid) {
        return { error: "Server has no VMID" }
    }

    const vmid = server.vmid
    const node = server.node
    const type = server.type as "qemu" | "lxc"

    try {
        switch (action) {
            case "start":
                await startVm(node, vmid, type)
                break
            case "stop":
                await stopVm(node, vmid, type)
                break
            case "shutdown":
                await shutdownVm(node, vmid, type)
                break
            case "reboot":
                await rebootVm(node, vmid, type)
                break
            case "reset":
                await resetVm(node, vmid, type)
                break
            case "suspend":
                await suspendVm(node, vmid, type)
                break
            case "resume":
                await resumeVm(node, vmid, type)
                break
            default:
                return { error: "Invalid action" }
        }

        revalidatePath(`/dashboard/server/${serverId}`)
        return { success: true }
    } catch (error) {
        console.error(`Failed to perform power action ${action}:`, error)
        return { error: `Failed to ${action} server` }
    }
}

export async function getServerIPs(serverId: string) {
    const session = await auth()
    if (!session?.user?.id) {
        return { error: "Unauthorized", ips: [] }
    }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: { node: true }
    })

    if (!server || server.userId !== session.user.id) {
        return { error: "Server not found or unauthorized", ips: [] }
    }

    if (!server.vmid) {
        return { error: "Server has no VMID", ips: [] }
    }

    try {
        const ips = await getGuestAgentNetworkInfo(
            server.node,
            server.vmid,
            server.type as "qemu" | "lxc"
        )
        return { success: true, ips }
    } catch (error) {
        console.error("Failed to fetch server IPs:", error)
        return { error: "Failed to fetch IPs", ips: [] }
    }
}
