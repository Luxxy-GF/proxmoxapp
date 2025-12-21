
import { redirect, notFound } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { generateConsoleToken } from "@/lib/coterm"
import { ConsoleViewer } from "./client"

interface ConsolePageProps {
    params: Promise<{ id: string }> | { id: string }
    searchParams?: Promise<{ type?: string }> | { type?: string }
}

export default async function ConsolePage(props: ConsolePageProps) {
    const resolvedParams = await props.params
    const resolvedSearchParams = props.searchParams ? await props.searchParams : {}

    const serverId = resolvedParams.id
    const consoleType = resolvedSearchParams?.type === "novnc" ? "novnc" : "xtermjs"

    const session = await auth()
    if (!session?.user?.id) {
        redirect("/login")
    }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: { node: true },
    })

    if (!server || !server.node) {
        notFound()
    }

    if (server.userId !== session.user.id) {
        notFound()
    }

    if (!server.vmid) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
                <div className="space-y-2 text-center">
                    <p className="text-lg font-semibold">Console unavailable</p>
                    <p className="text-sm text-zinc-400">This server is still provisioning.</p>
                </div>
            </div>
        )
    }

    const node = server.node

    // We don't need Coterm anymore, so no checks for cotermEndpoint/Secret.
    // We only rely on Proxmox connection (node.endpoint).

    // ==========================================
    // Native Console Mode (Client Component)
    // ==========================================
    // Handles both NoVNC (IFrame) and Xterm.js (Native Xterm)
    return <ConsoleViewer serverId={server.id} type={consoleType} />
}
