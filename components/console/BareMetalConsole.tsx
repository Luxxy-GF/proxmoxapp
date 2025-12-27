"use client";

import { useEffect, useRef, useState } from "react";
import RFB from "@novnc/novnc/lib/rfb";
import { Loader2 } from "lucide-react";

interface BareMetalConsoleProps {
    id: string; // Server ID
}

export function BareMetalConsole({ id }: BareMetalConsoleProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rfbRef = useRef<RFB | null>(null);
    const [status, setStatus] = useState<'initializing' | 'connecting' | 'connected' | 'disconnected' | 'error'>('initializing');
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        let mounted = true;

        async function startSession() {
            try {
                setStatus('initializing');
                // 1. Request Session from Backend
                const res = await fetch(`/api/baremetal/servers/${id}/console`, {
                    method: 'POST'
                });

                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(txt || "Failed to start console session");
                }

                const data = await res.json();
                let { wsUrl } = data;

                if (!wsUrl || !mounted) return;

                // Fix for localhost development:
                // If the API returns localhost but we are on a remote IP (e.g. 10.x.x.x), 
                // we must rewrite localhost to the current window hostname.
                const urlObj = new URL(wsUrl);
                if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
                    urlObj.hostname = window.location.hostname;
                    wsUrl = urlObj.toString();
                }

                setStatus('connecting');

                // 2. Connect noVNC
                if (containerRef.current) {
                    const rfb = new RFB(containerRef.current, wsUrl, {
                        credentials: { password: "" } // No auth on the WS itself for MVP/Desktop bridge
                    });

                    rfb.addEventListener("connect", () => {
                        if (mounted) setStatus('connected');
                    });

                    rfb.addEventListener("disconnect", (e: any) => {
                        if (mounted) setStatus('disconnected');
                        console.log("Console Disconnected", e);
                    });

                    rfbRef.current = rfb;
                }

            } catch (e: any) {
                if (mounted) {
                    setStatus('error');
                    setErrorMsg(e.message);
                }
            }
        }

        startSession();

        return () => {
            mounted = false;
            if (rfbRef.current) {
                rfbRef.current.disconnect();
            }
        };
    }, [id]);

    return (
        <div className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden rounded-md border border-zinc-800">
            <div ref={containerRef} className="w-full h-full" />

            {/* Overlays */}
            {status === 'initializing' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white gap-2">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
                    <p>Provisioning Console Session...</p>
                </div>
            )}
            {status === 'connecting' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white gap-2">
                    <Loader2 className="animate-spin h-8 w-8 text-green-500" />
                    <p>Connecting to Desktop...</p>
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-red-500 gap-2">
                    <p className="font-bold">Console Error</p>
                    <p className="text-sm text-zinc-400">{errorMsg}</p>
                </div>
            )}
            {status === 'disconnected' && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-zinc-500 gap-2">
                    <p>Disconnected</p>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 text-white text-sm">Reconnect</button>
                    <p className="text-xs text-zinc-600 mt-4 max-w-xs text-center">
                        Note: If using HTTPS dashboard with HTTP console (local), connection may be blocked by browser.
                        Allow "Insecure Content" for this site.
                    </p>
                </div>
            )}
        </div>
    );
}
