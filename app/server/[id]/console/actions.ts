"use server"

import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { ensureVncUser, setVncPermissions, getTicket, createTermProxy, createTermProxyAsUser } from "@/lib/proxmox"

export async function initializeConsoleSession(serverId: string, type: "novnc" | "xtermjs") {
    const session = await auth()
    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: { node: true },
    })

    if (!server || !server.node) {
        throw new Error("Server not found")
    }

    if (server.userId !== session.user.id) {
        throw new Error("Unauthorized")
    }

    if (!server.vmid) {
        throw new Error("Server has no VMID")
    }

    const node = server.node

    // 1. Authenticate as VNC User (lumen_vnc)
    // Common for both NoVNC and Xtermjs
    const { userid, password } = await ensureVncUser(node, server.vmid)
    await setVncPermissions(node, server.vmid, userid)
    const authData = await getTicket(node, userid, password)

    // 2. Set Cookie (For BOTH NoVNC and XtermJS)
    // Coterm sets cookie for both. Browser needs it for direct WS connection.
    const cookieStore = await cookies()

    let cookieDomain
    try {
        if (process.env.NEXT_PUBLIC_APP_URL) {
            let hostname = process.env.NEXT_PUBLIC_APP_URL
            if (!hostname.startsWith("http")) {
                hostname = "https://" + hostname
            }

            const url = new URL(hostname)
            const parts = url.hostname.split('.')
            if (parts.length >= 2) {
                cookieDomain = "." + parts.slice(-2).join('.')
            } else {
                cookieDomain = url.hostname
            }
        }
    } catch (e) {
        console.error("Failed to parse cookie domain:", e)
    }

    cookieStore.set("PVEAuthCookie", authData.ticket, {
        domain: cookieDomain,
        path: "/",
        secure: true,
        sameSite: "none",
    })

    if (type === 'novnc') {
        const nodeUrl = new URL(node.endpoint)
        const baseUrl = `${nodeUrl.protocol}//${nodeUrl.hostname}:${nodeUrl.port}`
        const storageType = server.type === 'lxc' ? 'lxc' : 'kvm'
        const apiPathType = server.type === 'lxc' ? 'lxc' : 'qemu'

        const vncUrl = `${baseUrl}/?console=${storageType}&novnc=1&node=${node.proxmoxId}&resize=1&vmid=${server.vmid}&path=api2/json/nodes/${node.proxmoxId}/${apiPathType}/${server.vmid}/vncwebsocket`

        return { type: 'novnc', url: vncUrl }
    } else {
        // xtermjs
        if (!server.vmid) throw new Error("VMID missing")

        // 3. Create TermProxy AS the VNC User
        // Using the ticket we just generated
        const proxyData = await createTermProxyAsUser(node, server.vmid, server.type === 'lxc' ? 'lxc' : 'qemu', authData)

        const nodeUrl = new URL(node.endpoint)
        const protocol = nodeUrl.protocol === 'https:' ? 'wss:' : 'ws:'

        const wsUrl = `${protocol}//${nodeUrl.hostname}:${nodeUrl.port}/api2/json/nodes/${node.proxmoxId}/${server.type === 'lxc' ? 'lxc' : 'qemu'}/${server.vmid}/vncwebsocket?port=${proxyData.port}&vncticket=${encodeURIComponent(proxyData.ticket)}`

        return {
            type: 'xtermjs',
            url: wsUrl,
            username: userid,
            ticket: proxyData.ticket
        }
    }
}
