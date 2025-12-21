"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"
import { refreshNode } from "@/app/dashboard/admin/actions"
import { Loader2 } from "lucide-react"

interface NodeStats {
    online: boolean
    cpu: number
    ram: number
    disk: number
    uptime?: number
    version?: string
    error?: any
}

interface NodeStatsCardProps {
    nodeId: string
    initialStats?: {
        cpuUsage: number
        ramUsage: number
        diskUsage: number
        status: string
    }
}

export function NodeStatsCard({ nodeId, initialStats }: NodeStatsCardProps) {
    // Initialize with DB values
    const [stats, setStats] = useState<NodeStats>({
        online: initialStats?.status === 'Online',
        cpu: initialStats?.cpuUsage || 0,
        ram: initialStats?.ramUsage || 0,
        disk: initialStats?.diskUsage || 0,
    })
    const [loading, setLoading] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

    useEffect(() => {
        let intervalId: NodeJS.Timeout

        const fetchStats = async () => {
            // setLoading(true) // Don't show loading on every poll, too distracting
            try {
                // We call the server action which updates DB and we can fetch fresh or return value
                // Ideally refreshNode should return the stats, but currently it returns success/error
                // For now, let's assume we might need a dedicated direct fetch or modify refreshNode.
                // Actually, let's create a client-side friendly fetcher or just use the action.

                // Modifying refreshNode to return stats would be best, but let's stick to the pattern.
                // We need to fetch the fresh data. 

                // Actually, for live stats, maybe we shouldn't hammer the DB update every 5 seconds?
                // But the user wants automatic.

                // Let's assume we modify refreshNode to return stats or we add a specific getter.
                // For now, I'll rely on refreshNode updating the DB and revalidating the path 
                // BUT revalidatePath is for server components. Client components won't see it unless they refetch.

                // Better approach: Server Action that returns data directly without DB write? 
                // Or standard polling.

                // Let's trigger the refresh action (which writes to DB)
                const result: any = await refreshNode(nodeId)
                if (result.success && result.stats) {
                    setStats({
                        online: result.stats.online,
                        cpu: result.stats.cpu,
                        ram: result.stats.ram,
                        disk: result.stats.disk,
                        version: result.stats.version,
                        uptime: result.stats.uptime
                    })
                }
            } catch (err) {
                console.error(err)
            } finally {
                // setLoading(false)
                setLastUpdated(new Date())
            }
        }

        // Poll every 5 seconds
        intervalId = setInterval(fetchStats, 5000)

        // Initial fetch
        fetchStats()

        return () => clearInterval(intervalId)
    }, [nodeId])

    // Wait, I need actual data to render. 
    // I will modify `app/dashboard/admin/actions.ts` to return the stats in `refreshNode` in the next step.
    // For now, I'll write the component to expect `refreshNode` to return `stats`.

    return (
        <Card className="h-full border-zinc-800 bg-zinc-950/50">
            <CardHeader>
                <CardTitle>Node Information</CardTitle>
                <CardDescription>Real-time resource usage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <div className="flex justify-between mb-2 text-sm">
                        <span className="text-zinc-400">Name:</span>
                        <span>pve</span> {/* Placeholder or fetch? */}
                    </div>
                    <div className="flex justify-between mb-2 text-sm">
                        <span className="text-zinc-400">Version:</span>
                        <span>{stats.version || "Unknown"}</span>
                    </div>
                    <div className="flex justify-between mb-2 text-sm">
                        <span className="text-zinc-400">Uptime:</span>
                        <span>{stats.uptime ? formatUptime(stats.uptime) : "Unknown"}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>CPU usage</span>
                        <span className="text-zinc-400">{stats.cpu.toFixed(2)}% of ? CPU(s)</span>
                    </div>
                    <Progress value={stats.cpu} className="h-2" />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>RAM usage</span>
                        <span className="text-zinc-400">{stats.ram.toFixed(2)}%</span>
                    </div>
                    <Progress value={stats.ram} className="h-2" />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Disk usage (local)</span>
                        <span className="text-zinc-400">{stats.disk.toFixed(2)}%</span>
                    </div>
                    <Progress value={stats.disk} className="h-2" />
                </div>
            </CardContent>
        </Card>
    )
}

function formatUptime(seconds: number) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);

    const dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
    const hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    const mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    return dDisplay + hDisplay + mDisplay;
}
