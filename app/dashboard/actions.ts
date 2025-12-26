"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { getVmStatus } from "@/lib/proxmox"

export async function getServerMetrics(serverId: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: { node: true }
    })

    if (!server || !server.vmid) return { error: "Server not found" }

    try {
        const status = await getVmStatus(server.node, server.vmid, server.type as "qemu" | "lxc")
        const data = status.data

        // Parse metrics
        return {
            status: data.status, // running, stopped
            cpuUsage: data.cpu ? parseFloat((data.cpu * 100).toFixed(1)) : 0,
            ramUsageMB: data.mem ? Math.round(data.mem / 1024 / 1024) : 0,
            diskUsageGB: data.disk ? parseFloat((data.disk / 1024 / 1024 / 1024).toFixed(1)) : 0,
            netRxKb: data.netin ? Math.round(data.netin / 1024) : 0,
            uptime: data.uptime
        }
    } catch (error) {
        console.error("Failed to get metrics:", error)
        return { error: "Failed to fetch metrics" }
    }
}
