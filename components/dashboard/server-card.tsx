"use client"

import * as React from "react"
import { getServerMetrics } from "@/app/dashboard/actions"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
    Terminal,
    Settings,
    Server as ServerIcon,
    Cpu,
    HardDrive,
    MemoryStick,
    ArrowDown,
    ArrowUp,
    Power,
    Play,
    Square
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface ServerCardProps {
    server: {
        id: string
        name: string
        status: string
        node: {
            name: string
            address?: string
        }
        resources?: {
            cpuCores: number
            memoryMB: number
            diskGB: number
        } | null
        vmid?: number | null
        type?: string
    }
    metrics?: {
        cpuUsage: number // 0-100
        ramUsageMB: number
        diskUsageGB: number
        netRxKb: number
        netTxKb: number
    }
}

export function ServerCard({ server, metrics = {
    // Mock default metrics for "live" feel if not provided
    cpuUsage: Math.floor(Math.random() * 30) + 5,
    ramUsageMB: server.resources ? Math.floor(server.resources.memoryMB * 0.4) : 1024,
    diskUsageGB: server.resources ? Math.floor(server.resources.diskGB * 0.2) : 10,
    netRxKb: Math.floor(Math.random() * 100),
    netTxKb: Math.floor(Math.random() * 50)
} }: ServerCardProps) {
    // Status Logic
    const isRunning = server.status === 'RUNNING'
    const isStopped = server.status === 'STOPPED'

    // Virtualization Label
    const virtType = server.type === 'qemu' ? 'KVM' : 'LXC'

    // Resource calculations
    const cores = server.resources?.cpuCores || 1
    const memory = server.resources?.memoryMB || 1024
    const disk = server.resources?.diskGB || 20

    // Region Mock (since not in DB)
    const region = "UK (London)"

    return (
        <Card className="border-border/50 bg-card/50 hover:bg-card/80 hover:border-border transition-all duration-300 group hover:shadow-lg hover:-translate-y-1 overflow-hidden">
            {/* Header */}
            <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                <div className="flex gap-3 items-center">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <ServerIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                            {server.name}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            ID: {server.vmid || '---'} • {server.node.name}
                        </p>
                    </div>
                </div>

                <Badge
                    variant="outline"
                    className={cn(
                        "capitalize border-0 font-medium px-2.5 py-0.5",
                        isRunning && "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 shadow-[0_0_10px_-4px_rgba(16,185,129,0.5)]",
                        isStopped && "bg-red-500/15 text-red-500 hover:bg-red-500/25",
                        server.status === 'PROVISIONING' && "bg-amber-500/15 text-amber-500 animate-pulse"
                    )}
                >
                    {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />}
                    {isStopped && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2" />}
                    {server.status}
                </Badge>
            </CardHeader>

            <Separator className="bg-border/40" />

            <CardContent className="pt-4 space-y-4">
                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-zinc-700" />
                        {region}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-zinc-700" />
                        {virtType}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-zinc-700" />
                        NVMe Storage
                    </div>
                </div>

                {/* Resource Metrics */}
                <div className="space-y-3">
                    {/* CPU */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="flex items-center text-muted-foreground">
                                <Cpu className="w-3 h-3 mr-1.5" /> CPU ({cores} vCore)
                            </span>
                            <span className="font-medium text-foreground">{metrics.cpuUsage}%</span>
                        </div>
                        <Progress value={metrics.cpuUsage} className="h-1.5 bg-zinc-800" indicatorClassName={cn(
                            metrics.cpuUsage > 80 ? "bg-red-500" :
                                metrics.cpuUsage > 50 ? "bg-amber-500" : "bg-primary"
                        )} />
                    </div>

                    {/* RAM */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="flex items-center text-muted-foreground">
                                <MemoryStick className="w-3 h-3 mr-1.5" /> Memory
                            </span>
                            <span className="font-medium text-foreground">
                                {(metrics.ramUsageMB / 1024).toFixed(1)}GB <span className="text-muted-foreground">/ {(memory / 1024).toFixed(1)}GB</span>
                            </span>
                        </div>
                        <Progress value={(metrics.ramUsageMB / memory) * 100} className="h-1.5 bg-zinc-800" />
                    </div>

                    {/* Disk */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="flex items-center text-muted-foreground">
                                <HardDrive className="w-3 h-3 mr-1.5" /> Disk
                            </span>
                            <span className="font-medium text-foreground">
                                {metrics.diskUsageGB}GB <span className="text-muted-foreground">/ {disk}GB</span>
                            </span>
                        </div>
                        <Progress value={(metrics.diskUsageGB / disk) * 100} className="h-1.5 bg-zinc-800" />
                    </div>
                </div>

                {/* Network Stats (Visual Only) */}
                <div className="flex gap-4 pt-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowDown className="w-3 h-3" />
                        {metrics.netRxKb} KB/s
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowUp className="w-3 h-3" />
                        {metrics.netTxKb} KB/s
                    </div>
                </div>
            </CardContent>

            <CardFooter className="pt-0 gap-2">
                <Link href={`/dashboard/server/${server.id}`} className="w-full">
                    <Button className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border-0" variant="outline" size="sm">
                        <Terminal className="w-4 h-4 mr-2" />
                        Console
                    </Button>
                </Link>
                <Link href={`/dashboard/server/${server.id}/settings`} className="w-full">
                    <Button variant="secondary" size="sm" className="w-full">
                        <Settings className="w-4 h-4 mr-2" />
                        Manage
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    )
}
