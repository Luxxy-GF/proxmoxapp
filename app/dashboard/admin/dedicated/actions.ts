"use server"

import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function refreshDedicatedNodeStatus(nodeId: string) {
    try {
        await requireAdmin()
    } catch {
        return { error: "Unauthorized" }
    }

    try {
        const node = await prisma.dedicatedNode.findUnique({
            where: { id: nodeId }
        })

        if (!node) {
            return { error: "Node not found" }
        }

        const protocol = "http"
        const port = node.port || 3000
        const url = `${protocol}://${node.address}:${port}/`

        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000)

            const res = await fetch(url, {
                signal: controller.signal,
                headers: {
                    // Start basic, maybe add auth later if checking specific endpoints
                    "User-Agent": "Luxxy-Panel-HealthCheck"
                }
            })
            clearTimeout(timeoutId)

            if (res.ok) {
                await prisma.dedicatedNode.update({
                    where: { id: nodeId },
                    data: { status: "ONLINE" }
                })
                revalidatePath("/dashboard/admin/dedicated/nodes")
                return { success: true, status: "ONLINE" }
            } else {
                throw new Error(`Agent returned ${res.status}`)
            }

        } catch (error) {
            console.error(`Health check failed for ${node.name} (${url}):`, error)
            await prisma.dedicatedNode.update({
                where: { id: nodeId },
                data: { status: "OFFLINE" }
            })
            revalidatePath("/dashboard/admin/dedicated/nodes")
            return { success: true, status: "OFFLINE" }
        }

    } catch (error) {
        console.error("Failed to refresh dedicated node status:", error)
        return { error: "Internal Error" }
    }
}

export async function powerAction(serverId: string, action: 'on' | 'off' | 'reset' | 'cycle' | 'status') {
    try {
        await requireAdmin()
    } catch {
        return { error: "Unauthorized" }
    }

    try {
        const server = await prisma.dedicatedServer.findUnique({
            where: { id: serverId },
            include: { dedicatedNode: true }
        })

        if (!server) return { error: "Server not found" }
        if (!server.dedicatedNode) return { error: "Server not assigned to an Agent Node" }

        const node = server.dedicatedNode
        const protocol = "http"
        const port = node.port || 3000
        const url = `${protocol}://${node.address}:${port}/power/${action === 'status' ? 'status' : 'control'}`

        // Get IPMI creds from server data - assuming simple storage for now as per schema
        // Schema has 'encryptedConfig' on Connection model, but DedicatedServer has no direct creds fields except via relation?
        // Wait, schema has `events` and `hardware` but creds might be in `assignments` -> `Connection`.
        // For this task, I'll check if there's a simpler way or if we need to implement Connection lookup.
        // User request "move all dedi servers to be manage by the agent" implies the AGENT does the work.
        // The Agent might need credentials passed to it, or it might already know them if it's "managing" them?
        // Agent's `IpmiService` expects {host, user, pass}.
        // The `DedicatedServer` model has `assignments`.

        // Let's look up the IPMI connection assignment
        const assignment = await prisma.connectionAssignment.findFirst({
            where: {
                serverId: server.id,
                connection: { type: "IPMI" }
            },
            include: { connection: true }
        })

        // Fallback or Error if no IPMI
        // For the sake of the "Agent" model, maybe the Agent uses local IPMI if hostname matches?
        // Or we pass the param. Let's assume we pass params.

        let creds = {
            host: server.primaryIpv4 || server.hostname, // Fallback
            user: "ADMIN", // Placeholder
            pass: "ADMIN"  // Placeholder
        }

        if (assignment && assignment.connection.encryptedConfig) {
            const { decrypt } = await import("@/lib/encryption")
            const config = JSON.parse(decrypt(assignment.connection.encryptedConfig))
            creds = {
                host: config.host || creds.host,
                user: config.user || creds.user,
                pass: config.pass || creds.pass
            }
        }

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Luxxy-Panel-PowerControl"
            },
            body: JSON.stringify({
                ...creds,
                action: action !== 'status' ? action : undefined
            })
        })

        if (!res.ok) {
            const errText = await res.text()
            throw new Error(`Agent error: ${errText}`)
        }

        const data = await res.json()
        return { success: true, data }

    } catch (error) {
        console.error("Power action failed:", error)
        return { error: error instanceof Error ? error.message : "Action failed" }
    }
}

export async function assignServerToNode(serverId: string, nodeId: string) {
    try { await requireAdmin() } catch { return { error: "Unauthorized" } }

    try {
        await prisma.dedicatedServer.update({
            where: { id: serverId },
            data: { dedicatedNodeId: nodeId }
        })
        revalidatePath("/dashboard/admin/dedicated")
        return { success: true }
    } catch (e) {
        return { error: "Assignment failed" }
    }
}
