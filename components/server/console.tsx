"use client"

import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function Console() {
    const terminalRef = useRef<HTMLDivElement>(null)
    const termRef = useRef<Terminal | null>(null)

    useEffect(() => {
        if (!terminalRef.current) return

        const term = new Terminal({
            cursorBlink: true,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            theme: {
                background: '#09090b', // zinc-950
                foreground: '#e4e4e7', // zinc-200
                cursor: '#fff',
            },
            rows: 24,
            cols: 80,
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        term.open(terminalRef.current)
        fitAddon.fit()

        term.writeln('\x1b[32mWelcome to Lumen Server Console\x1b[0m')
        term.writeln('Connecting to proxmox instance...')
        term.writeln('')
        term.write('user@vps-01:~$ ')

        term.onData((data) => {
            term.write(data) // Local echo for now
            // TODO: Send to WebSocket
        })

        termRef.current = term

        const handleResize = () => fitAddon.fit()
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            term.dispose()
        }
    }, [])

    return (
        <div className="h-full w-full bg-[#09090b] p-2" ref={terminalRef} />
    )
}
