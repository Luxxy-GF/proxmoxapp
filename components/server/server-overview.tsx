"use client"

import * as React from "react"
import { Monitor, Power, RotateCw, Square, Clock, Cpu, HardDrive, Network, ExternalLink, ChevronDown, Skull } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Console } from "@/components/server/console"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { pollVmStatus, powerAction, getServerIPs } from "@/app/dashboard/server/[id]/actions"

interface ServerOverviewProps {
    server: any
}

const chartConfig = {
    cpu: {
        label: "CPU",
        color: "hsl(var(--chart-1))",
    },
    memory: {
        label: "Memory",
        color: "hsl(var(--chart-2))",
    },
}

export default function ServerOverviewPage({ server }: ServerOverviewProps) {
    const [stats, setStats] = React.useState({
        status: server.status,
        cpu: 0,
        memory: 0,
        memoryTotal: 0,
        disk: 0,
        uptime: 0,
        maxMemory: 0,
        netin: 0,
        netout: 0
    })

    const [actionLoading, setActionLoading] = React.useState<string | null>(null)
    const [chartPoints, setChartPoints] = React.useState<any[]>([])
    const [serverIPs, setServerIPs] = React.useState<string[]>([])
    const [lastNetworkStats, setLastNetworkStats] = React.useState<{ netin: number, netout: number, time: number } | null>(null)

    // Initialize chart points
    React.useEffect(() => {
        const points = []
        for (let i = 0; i < 20; i++) {
            points.push({ time: i, cpu: 0, memory: 0, netin: 0, netout: 0 })
        }
        setChartPoints(points)
    }, [])

    // Fetch IPs from guest agent
    React.useEffect(() => {
        const fetchIPs = async () => {
            const result = await getServerIPs(server.id)
            if (result.success && result.ips) {
                setServerIPs(result.ips)
            }
        }

        fetchIPs()
        // Refresh IPs every 30 seconds
        const interval = setInterval(fetchIPs, 30000)
        return () => clearInterval(interval)
    }, [server.id])

    React.useEffect(() => {
        const fetchStats = async () => {
            const result = await pollVmStatus(server.id)
            if (result.success && result.data) {
                const data = result.data
                const cpuPercent = (data.cpu || 0) * 100
                const memUsed = data.mem || 0
                const memTotal = data.maxmem || 1
                const memPercent = (memUsed / memTotal) * 100

                // Calculate network rates (MB/s)
                const currentNetin = data.netin || 0
                const currentNetout = data.netout || 0
                const now = Date.now()

                let netinRate = 0
                let netoutRate = 0

                if (lastNetworkStats) {
                    const timeDiff = (now - lastNetworkStats.time) / 1000 // seconds
                    if (timeDiff > 0) {
                        netinRate = ((currentNetin - lastNetworkStats.netin) / timeDiff) / 1024 / 1024 // MB/s
                        netoutRate = ((currentNetout - lastNetworkStats.netout) / timeDiff) / 1024 / 1024 // MB/s
                    }
                }

                setLastNetworkStats({ netin: currentNetin, netout: currentNetout, time: now })

                setStats({
                    status: data.status ? data.status.toLowerCase() : "unknown",
                    cpu: cpuPercent,
                    memory: memPercent,
                    memoryTotal: memTotal,
                    disk: 0,
                    uptime: data.uptime || 0,
                    maxMemory: memTotal,
                    netin: netinRate,
                    netout: netoutRate
                })

                setChartPoints(prev => {
                    const newPoint = {
                        time: Date.now(),
                        cpu: parseFloat(cpuPercent.toFixed(1)),
                        memory: parseFloat(memPercent.toFixed(1)),
                        netin: parseFloat(netinRate.toFixed(2)),
                        netout: parseFloat(netoutRate.toFixed(2))
                    }
                    // Keep only last 20 points
                    const newPoints = [...prev, newPoint]
                    if (newPoints.length > 20) newPoints.shift()
                    return newPoints
                })
            }
        }

        // Initial fetch
        fetchStats()
        // Poll every 3 seconds
        const interval = setInterval(fetchStats, 3000)

        return () => clearInterval(interval)
    }, [server.id])

    const handlePowerAction = async (action: "start" | "stop" | "shutdown" | "reboot") => {
        if (actionLoading) return
        setActionLoading(action)

        try {
            console.log(`Sending ${action} command...`)
            const result = await powerAction(server.id, action)

            if (result.error) {
                console.error(result.error)
                alert(`Error: ${result.error}`)
            } else {
                console.log(`Server ${action} command sent`)
                // Optimistic update or fast poll could go here
            }
        } catch (error) {
            console.error("Failed to execute action", error)
            alert("Failed to execute action")
        } finally {
            setActionLoading(null)
        }
    }

    if (!server) return <div>Server not found</div>

    const formatUptime = (seconds: number) => {
        if (!seconds) return "0m 0s"
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor(seconds % (3600 * 24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        const s = Math.floor(seconds % 60);

        if (d > 0) return `${d}d ${h}h ${m}m`;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        return `${m}m ${s}s`;
    }

    const StatusDot = ({ status }: { status: string }) => (
        <div className={`h-3 w-3 rounded-full ${status === 'running' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
    )

    const isRunning = stats.status === 'running' // Added isRunning variable

    return (
        <div className="flex flex-col min-h-screen w-full bg-[#09090b]">
            <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-6 bg-[#09090b]">
                <div className="flex items-center gap-2">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbLink href="/dashboard">Servers</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbLink href="#">{server.name}</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <span className="text-foreground">Overview</span>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
                <div className="flex items-center gap-2">
                    {!isRunning && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                            onClick={() => handlePowerAction("start")}
                            disabled={!!actionLoading}
                        >
                            <Power className="h-4 w-4 text-green-500" />
                            Start
                        </Button>
                    )}

                    {isRunning && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                                onClick={() => handlePowerAction("shutdown")}
                                disabled={!!actionLoading}
                            >
                                <Power className="h-4 w-4" />
                                Shutdown
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                                onClick={() => handlePowerAction("reboot")}
                                disabled={!!actionLoading}
                            >
                                <RotateCw className="h-4 w-4" />
                                Reboot
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700"
                                onClick={() => handlePowerAction("stop")}
                                disabled={!!actionLoading}
                                title="Force Stop"
                            >
                                <Skull className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            </header>

            <div className="flex flex-1 flex-col gap-6 p-6">

                {/* Stats Row */}
                <div className="grid grid-cols-5 gap-0 bg-[#0c0c0e] border border-zinc-800 rounded-xl overflow-hidden divide-x divide-zinc-800">
                    <div className="p-6 flex items-center gap-4">
                        <StatusDot status={stats.status} />
                        <div>
                            <div className="text-xl font-semibold text-white tracking-tight">
                                {stats.status.charAt(0).toUpperCase() + stats.status.slice(1).toLowerCase()}
                            </div>
                            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Server Status</div>
                        </div>
                    </div>

                    <div className="p-6 flex items-center gap-4">
                        <Clock className="h-5 w-5 text-zinc-500" />
                        <div>
                            <div className="text-xl font-semibold text-white tracking-tight">{formatUptime(stats.uptime)}</div>
                            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Server Uptime</div>
                        </div>
                    </div>

                    <div className="p-6 flex items-center gap-4">
                        <Cpu className="h-5 w-5 text-zinc-500" />
                        <div>
                            <div className="text-xl font-semibold text-white tracking-tight">{stats.cpu.toFixed(2)}%</div>
                            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-0.5">CPU Usage</div>
                        </div>
                    </div>

                    <div className="p-6 flex items-center gap-4">
                        <HardDrive className="h-5 w-5 text-zinc-500" />
                        <div>
                            <div className="text-xl font-semibold text-white tracking-tight">{stats.memory.toFixed(2)}%</div>
                            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Memory Usage</div>
                        </div>
                    </div>

                    <div className="p-6 flex items-center gap-4">
                        <Network className="h-5 w-5 text-zinc-500" />
                        <div className="flex-1">
                            {serverIPs.length > 0 ? (
                                <>
                                    <div className="text-sm font-mono text-white tracking-tight">{serverIPs[0]}</div>
                                    <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-0.5 flex items-center gap-2">
                                        IPs
                                        {serverIPs.length > 1 && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors">
                                                        More
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                                                    {serverIPs.slice(1).map((ip, idx) => (
                                                        <DropdownMenuItem key={idx} className="font-mono text-xs">
                                                            {ip}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-sm text-zinc-600">No IPs detected</div>
                                    <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-0.5">IPs</div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-7 lg:grid-cols-7 h-full">
                    {/* Console Area (Left) */}
                    <Card className="col-span-4 flex flex-col overflow-hidden bg-[#0f0f12] border-zinc-800 h-[600px] relative p-8">
                        <div className="flex h-full w-full flex-col items-center justify-center gap-6 text-center">
                            <div className="space-y-2">
                                <p className="text-2xl font-semibold text-white">Launch Server Console</p>
                                <p className="text-sm text-zinc-400 max-w-md">
                                    Access your server's terminal directly. Use the button below to open a secure console session in a new window.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <Button
                                    size="lg"
                                    className="bg-white text-black hover:bg-zinc-200"
                                    onClick={() => window.open(`/server/${server.id}/console?type=xtermjs`, '_blank')}
                                >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open Console
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="lg" className="border-zinc-700 text-zinc-200">
                                            More Options
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => window.open(`/server/${server.id}/console?type=novnc`, '_blank')}>
                                            <Monitor className="mr-2 h-4 w-4" />
                                            Open with noVNC
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => window.open(`/server/${server.id}/console?type=xtermjs`, '_blank', 'width=1280,height=800')}>
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Popup window
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </Card>

                    {/* Graphs Column (Right) */}
                    <div className="col-span-3 flex flex-col gap-6">

                        {/* CPU Chart */}
                        <Card className="bg-[#0c0c0e] border-zinc-800">
                            <CardHeader className="p-6 pb-0 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-zinc-200">CPU Usage</CardTitle>
                                <Cpu className="h-4 w-4 text-zinc-500" />
                            </CardHeader>
                            <CardContent className="p-6 pt-4">
                                <div className="h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartPoints} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#27272a" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#27272a" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid vertical={false} stroke="#27272a" strokeDasharray="3 3" />
                                            <XAxis dataKey="time" hide />
                                            <YAxis
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#71717a', fontSize: 12 }}
                                                tickFormatter={(value: number) => `${value}%`}
                                                domain={[0, 100]}
                                                ticks={[25, 50, 75, 100]}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="cpu"
                                                stroke="#52525b"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorCpu)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Memory Chart */}
                        <Card className="bg-[#0c0c0e] border-zinc-800">
                            <CardHeader className="p-6 pb-0 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-zinc-200">Memory Usage</CardTitle>
                                <HardDrive className="h-4 w-4 text-zinc-500" />
                            </CardHeader>
                            <CardContent className="p-6 pt-4">
                                <div className="h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartPoints} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#27272a" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#27272a" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid vertical={false} stroke="#27272a" strokeDasharray="3 3" />
                                            <XAxis dataKey="time" hide />
                                            <YAxis
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#71717a', fontSize: 12 }}
                                                tickFormatter={(value: number) => `${(value * stats.memoryTotal / 100 / 1024 / 1024 / 1024).toFixed(1)}GB`}
                                                domain={[0, 100]}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="memory"
                                                stroke="#52525b"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorMem)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Network Chart */}
                        <Card className="bg-[#0c0c0e] border-zinc-800">
                            <CardHeader className="p-6 pb-0 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-zinc-200">Network Traffic</CardTitle>
                                <Network className="h-4 w-4 text-zinc-500" />
                            </CardHeader>
                            <CardContent className="p-6 pt-4">
                                <div className="h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartPoints} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorNetin" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorNetout" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid vertical={false} stroke="#27272a" strokeDasharray="3 3" />
                                            <XAxis dataKey="time" hide />
                                            <YAxis
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#71717a', fontSize: 12 }}
                                                tickFormatter={(value: number) => `${value.toFixed(1)}MB/s`}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="netin"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorNetin)"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="netout"
                                                stroke="#10b981"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorNetout)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                </div>

            </div>
        </div>
    )
}
