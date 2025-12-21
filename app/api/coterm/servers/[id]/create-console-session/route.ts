import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { createVncProxy, ensureVncUser, setVncPermissions, getTicket } from "@/lib/proxmox"
import { decrypt } from "@/lib/encryption"

type ConsoleType = "xtermjs" | "novnc"

interface ProxmoxConsoleSession {
    ticket: string
    port: number | string
    user?: string
    username?: string
}

const SUPPORTED_TYPES: ConsoleType[] = ["xtermjs", "novnc"]

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    console.log(`[Coterm] Incoming console session request`, {
        serverId: id,
        method: req.method,
        url: req.nextUrl?.toString?.() || req.url,
    })


    let parsedType: ConsoleType | undefined
    try {
        const body = await req.json()
        parsedType = body?.type
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if (!parsedType || !SUPPORTED_TYPES.includes(parsedType)) {
        return NextResponse.json({ error: "Invalid console type" }, { status: 400 })
    }

    const server = await prisma.server.findUnique({
        where: { id },
        include: { node: true },
    })

    if (!server || !server.node) {
        console.warn("[Coterm] Server or node not found", id)
        return NextResponse.json({ error: "Server not found" }, { status: 404 })
    }

    if (!server.vmid) {
        console.warn("[Coterm] Server missing VMID", id)
        return NextResponse.json({ error: "Server is not provisioned yet" }, { status: 400 })
    }

    const node = server.node

    if (!node.cotermSecret) {
        console.warn("[Coterm] Node missing coterm secret", node.id)
        return NextResponse.json({ error: "Coterm secret is not configured for this node" }, { status: 503 })
    }

    const authHeader = req.headers.get("authorization") || ""
    if (authHeader !== `Bearer ${node.cotermSecret}`) {
        console.warn("[Coterm] Unauthorized request for console session", id)
        return new NextResponse("Unauthorized", { status: 401 })
    }

    let endpoint: URL
    try {
        endpoint = new URL(node.endpoint)
    } catch {
        return NextResponse.json({ error: "Node endpoint is invalid" }, { status: 500 })
    }

    const nodePort = endpoint.port
        ? parseInt(endpoint.port, 10)
        : endpoint.protocol === "https:" ? 443 : 80

    try {
        console.log("[Coterm] Creating VNC proxy", {
            serverId: server.id,
            vmid: server.vmid,
            type: server.type,
        })
        const session = await createVncProxy(node, server.vmid, server.type as "qemu" | "lxc") as ProxmoxConsoleSession

        // Create/Update ephemeral VNC user and get a real ticket
        const { userid, password } = await ensureVncUser(node, server.vmid)
        await setVncPermissions(node, server.vmid, userid)
        const authData = await getTicket(node, userid, password)
        const realTicket = authData.ticket

        const basePayload = {
            node_fqdn: endpoint.hostname,
            node_port: 8006,
            node_pve_name: node.proxmoxId,
            vmid: server.vmid,
            port: typeof session.port === "string" ? parseInt(session.port, 10) : session.port,
            ticket: session.ticket, // This is the VNC ticket
            pve_auth_cookie: realTicket, // This is the User Session ticket
        }
        console.log(basePayload)
        if (parsedType === "novnc") {
            return NextResponse.json({ data: basePayload })
        }

        const rawUser = session.user || session.username || ""
        const [username, realm_type = "pam"] = rawUser.includes("@")
            ? rawUser.split("@")
            : [rawUser || "root", "pam"]

        console.log("[Coterm] Console session created", { serverId: server.id, type: parsedType })

        return NextResponse.json({
            data: {
                ...basePayload,
                username,
                realm_type,
            },
        })
    } catch (error) {
        console.error("Failed to create console session:", error)
        return NextResponse.json({ error: "Failed to create console session" }, { status: 500 })
    }
}

