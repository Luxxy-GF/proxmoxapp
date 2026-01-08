"use client";
import { useEffect, useState } from "react";

export function ServerPowerStatus({ serverId }: { serverId: string }) {
    const [status, setStatus] = useState<'on' | 'off' | 'unknown' | 'loading'>('loading');

    useEffect(() => {
        let mounted = true;
        const fetchPower = async () => {
            try {
                const res = await fetch(`/api/baremetal/servers/${serverId}/power`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                if (mounted) setStatus(data.status);
            } catch {
                if (mounted) setStatus('unknown');
            }
        };

        fetchPower();
        const interval = setInterval(fetchPower, 15000); // 15s polling
        return () => { mounted = false; clearInterval(interval); };
    }, [serverId]);

    return (
        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 ml-4" title="Real-time Power Status">
            {status === 'loading' && <div className="h-2.5 w-2.5 rounded-full bg-zinc-400 animate-pulse" />}
            {status === 'on' && <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />}
            {status === 'off' && <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />}
            {status === 'unknown' && <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />}

            <span className="text-xs font-medium uppercase text-zinc-600 dark:text-zinc-400">
                {status === 'loading' ? 'Checking...' : status}
            </span>
        </div>
    );
}
