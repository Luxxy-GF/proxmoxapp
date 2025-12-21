"use client"

import { useEffect, useRef } from "react"
import "@xterm/xterm/css/xterm.css"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"

export default function XtermTerminal({ session }: { session: { url: string, username: string, ticket: string } }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const terminalRef = useRef<Terminal | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (!containerRef.current) return

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#000000',
            }
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(containerRef.current)
        fitAddon.fit()

        terminalRef.current = term

        // Connect WebSocket
        term.write(`\r\nConnecting to: ${session.url}\r\n`)

        let ws: WebSocket;
        try {
            // Proxmox expects 'binary' protocol negotiation, 
            // but the communication is actually a text-based packet protocol for Client->Server.
            ws = new WebSocket(session.url, ['binary'])
            ws.binaryType = 'arraybuffer'
        } catch (e: any) {
            term.write(`\r\nFailed to create WebSocket: ${e.message}\r\n`)
            return
        }

        ws.onopen = () => {
            term.write("\r\nConnected! Sending handshake...\r\n")
            // Handshake: username:ticket
            ws.send(`${session.username}:${session.ticket}\n`)

            // Start Ping Interval (30s)
            // Protocol: "2"
            pingIntervalRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send("2")
                }
            }, 30000)

            // Send Initial Resize
            const dims = fitAddon.proposeDimensions()
            if (dims) {
                // Protocol: "1:COLS:ROWS:"
                ws.send(`1:${dims.cols}:${dims.rows}:`)
            }
        }

        ws.onmessage = (event) => {
            // Server->Client is RAW data (Text or Binary)
            if (event.data instanceof ArrayBuffer) {
                term.write(new Uint8Array(event.data))
            } else if (typeof event.data === 'string') {
                term.write(event.data)
            } else {
                const reader = new FileReader()
                reader.onload = () => {
                    if (typeof reader.result === 'string') {
                        term.write(reader.result)
                    } else if (reader.result instanceof ArrayBuffer) {
                        term.write(new Uint8Array(reader.result))
                    }
                }
                reader.readAsArrayBuffer(event.data)
            }
        }

        ws.onclose = (ev) => {
            term.write(`\r\nConnection Closed (Code: ${ev.code}, Reason: ${ev.reason})\r\n`)
        }

        ws.onerror = (e) => {
            console.error("WS Error", e)
            term.write("\r\nWebSocket Error (Check console for details)\r\n")
        }

        // Send input using Proxmox Protocol: "0:LENGTH:MSG"
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                // Calculate Byte Length (not string length)
                const len = new TextEncoder().encode(data).length
                const msg = `0:${len}:${data}`
                ws.send(msg)
            }
        })

        const handleResize = () => {
            fitAddon.fit()
            const dims = fitAddon.proposeDimensions()
            if (dims && ws.readyState === WebSocket.OPEN) {
                ws.send(`1:${dims.cols}:${dims.rows}:`)
            }
        }
        window.addEventListener('resize', handleResize)

        wsRef.current = ws

        return () => {
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
            window.removeEventListener('resize', handleResize)
            ws.close()
            term.dispose()
        }
    }, [session])

    return <div ref={containerRef} className="h-screen w-screen bg-black" />
}
