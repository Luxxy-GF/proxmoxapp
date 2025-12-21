"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Disc, HardDrive, Loader2, Play } from "lucide-react"
import { attachIso, detachIso } from "@/app/dashboard/server/[id]/media/actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface ServerMediaProps {
    server: any
    isos: any[]
}

export function ServerMedia({ server, isos }: ServerMediaProps) {
    const [selectedIso, setSelectedIso] = useState<string>(server.isoId || "")
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleAttach = async () => {
        if (!selectedIso) return
        setIsLoading(true)
        try {
            const result = await attachIso(server.id, selectedIso)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("ISO Attached successfully")
                router.refresh()
            }
        } catch (e) {
            toast.error("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDetach = async () => {
        setIsLoading(true)
        try {
            const result = await detachIso(server.id)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("ISO Detached successfully")
                setSelectedIso("")
                router.refresh()
            }
        } catch (e) {
            toast.error("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    const currentIso = isos.find(i => i.id === server.isoId)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Media & Boot</h2>
                    <p className="text-muted-foreground">Manage boot media and ISO images.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 items-start">
                <Card className="border-zinc-800 bg-zinc-950/50 h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Disc className="w-5 h-5 text-primary" />
                            CD/DVD Drive
                        </CardTitle>
                        <CardDescription>Attach an ISO image to the virtual CD-ROM drive.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">ISO Image</label>
                            {server.isoId ? (
                                <div className="flex items-center justify-between p-3 border border-zinc-800 rounded-lg bg-zinc-900/50">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="bg-primary/20 p-2 rounded shrink-0">
                                            <Disc className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-medium text-sm truncate">{currentIso?.name || "Unknown ISO"}</span>
                                            <span className="text-xs text-muted-foreground truncate">{currentIso?.filename}</span>
                                        </div>
                                    </div>
                                    <Button variant="destructive" size="sm" onClick={handleDetach} disabled={isLoading} className="shrink-0 ml-2">
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eject"}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <Select value={selectedIso} onValueChange={setSelectedIso} disabled={isLoading}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select ISO..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {isos.length === 0 ? (
                                                <SelectItem value="none" disabled>No ISOs found</SelectItem>
                                            ) : (
                                                isos.map((iso: any) => (
                                                    <SelectItem key={iso.id} value={iso.id}>
                                                        {iso.name} ({iso.filename})
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={handleAttach} disabled={!selectedIso || isLoading}>
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mount"}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {!server.isoId && (
                            <div className="text-xs text-muted-foreground bg-zinc-900/50 p-3 rounded border border-zinc-800">
                                <p>Mounting an ISO will automatically change the boot order to prioritize the CD-ROM drive on next boot.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-zinc-800 bg-zinc-950/50 h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Play className="w-5 h-5 text-primary" />
                            Boot Order
                        </CardTitle>
                        <CardDescription>Current boot configuration.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                                    <span className="font-mono text-xs text-zinc-500 w-6">1</span>
                                    {server.isoId ? (
                                        <>
                                            <Disc className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-medium">CD-ROM (ide2)</span>
                                            <span className="text-xs text-muted-foreground ml-auto">Preferred</span>
                                        </>
                                    ) : (
                                        <>
                                            <HardDrive className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-medium">Hard Disk (scsi0)</span>
                                            <span className="text-xs text-muted-foreground ml-auto">Preferred</span>
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-zinc-900/30 border border-zinc-800/50 rounded-lg opacity-70">
                                    <span className="font-mono text-xs text-zinc-500 w-6">2</span>
                                    {server.isoId ? (
                                        <>
                                            <HardDrive className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm font-medium text-muted-foreground">Hard Disk (scsi0)</span>
                                        </>
                                    ) : (
                                        <>
                                            <Disc className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm font-medium text-muted-foreground">CD-ROM (ide2)</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">
                                The boot order is automatically managed based on whether an ISO is attached. To boot from ISO, simply mount it.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
