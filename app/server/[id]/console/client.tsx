"use client"

import { useEffect, useRef, useState } from "react"
import { initializeConsoleSession } from "./actions"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"

// Dynamically import XtermTerminal with SSR disabled
const XtermTerminal = dynamic(() => import("./xterm-terminal"), {
    ssr: false,
    loading: () => (
        <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
        </div>
    )
})

type InitResult =
    | { type: 'novnc', url: string }
    | { type: 'xtermjs', url: string, username: string, ticket: string }

export function ConsoleViewer({ serverId, type }: { serverId: string, type: "novnc" | "xtermjs" }) {
    const [session, setSession] = useState<InitResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        async function init() {
            try {
                const res = await initializeConsoleSession(serverId, type)
                if (mounted) {
                    setSession(res as InitResult)
                }
            } catch (e: any) {
                console.error("Console Init Error:", e)
                if (mounted) setError(e.message || "Failed to initialize console support")
            } finally {
                if (mounted) setLoading(false)
            }
        }
        init()
        return () => { mounted = false }
    }, [serverId, type])

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p>Connecting to Proxmox...</p>
                </div>
            </div>
        )
    }

    if (error || !session) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
                <div className="space-y-2 text-center text-red-500">
                    <p className="text-lg font-semibold">Connection Failed</p>
                    <p className="text-sm text-zinc-400">{error || "Unknown error"}</p>
                </div>
            </div>
        )
    }

    if (session.type === 'novnc') {
        return (
            <div className="fixed inset-0 h-full w-full bg-black">
                <iframe
                    src={session.url}
                    className="h-full w-full border-0"
                    allowFullScreen
                />
            </div>
        )
    }

    // XtermJS - pass session as props
    // We cast to specific type for XtermTerminal
    if (session.type === 'xtermjs') {
        return <XtermTerminal session={session as { type: 'xtermjs', url: string, username: string, ticket: string }} />
    }

    return null
}
