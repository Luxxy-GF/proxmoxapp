
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Power, RefreshCw, Terminal, HardDrive, Activity, Server as ServerIcon, Cpu, MemoryStick, Globe } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ReinstallDialog } from "@/components/dedicated/reinstall-dialog";
import { InstallProgress } from "@/components/dedicated/install-progress";

export default function DedicatedServerPage() {
    const { id } = useParams();
    const [server, setServer] = useState<any>(null);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [powerState, setPowerState] = useState<string | null>(null);

    // Reinstall state (handled by dialog mostly)
    const [selectedProfile, setSelectedProfile] = useState("");

    const fetchServer = async () => {
        // setLoading(true); // Don't set global loading on refresh, only initial
        try {
            const res = await fetch(`/api/baremetal/servers/${id}?t=${Date.now()}`);
            if (!res.ok) throw new Error("Failed to fetch server");
            const data = await res.json();
            setServer(data);
        } catch (error) {
            toast.error("Failed to load server details");
        } finally {
            setLoading(false);
        }
    };

    const fetchProfiles = async () => {
        try {
            const res = await fetch("/api/baremetal/pxe/profiles");
            if (res.ok) {
                const data = await res.json();
                setProfiles(data.filter((p: any) => p.kind === 'INSTALL' && p.enabled));
            }
        } catch (e) {
            console.error(e);
        }
    }

    const checkPower = async () => {
        try {
            const res = await fetch(`/api/baremetal/servers/${id}/power`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: 'status' }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.output.toLowerCase().includes("is on")) setPowerState("on");
                else if (data.output.toLowerCase().includes("is off")) setPowerState("off");
                else setPowerState("unknown");
            }
        } catch (e) {
            console.error("Power check failed", e);
        }
    };

    useEffect(() => {
        if (id) {
            setLoading(true);
            Promise.all([fetchServer(), fetchProfiles(), checkPower()]).finally(() => setLoading(false));
        }
    }, [id]);

    // Poll for updates if installing
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (server?.status === 'INSTALLING' || server?.installs?.[0]?.state === 'RUNNING') {
            interval = setInterval(fetchServer, 5000);
        }
        return () => clearInterval(interval);
    }, [server?.status, server?.installs?.[0]?.state]);

    const handlePower = async (action: string) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/baremetal/servers/${id}/power`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Power action failed");

            toast.success(`Power ${action} initiated: ${data.output}`);
            fetchServer();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReinstall = async (data: any) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/baremetal/servers/${id}/install`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const resData = await res.json();
            if (!res.ok) throw new Error(resData.error || "Reinstall failed");

            toast.success("Reinstall started. Server will reboot shortly.");
            fetchServer();
        } catch (error: any) {
            toast.error(error.message);
            throw error;
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm("Are you sure you want to cancel the installation? It may leave the server in a broken state.")) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/baremetal/servers/${id}/install`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to cancel");

            toast.success("Installation cancelled");
            fetchServer();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleInventoryScan = async () => {
        if (!confirm("This will reboot the server into a temporary image to scan hardware. The current OS will be stopped. Continue?")) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/baremetal/servers/${id}/inventory`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to start inventory scan");

            toast.success("Inventory scan started. Server rebooting...");

            // Trigger reboot via power API
            await fetch(`/api/baremetal/servers/${id}/power`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reset" }), // Hard reset to force PXE catch
            });

            fetchServer();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!server) return <div className="p-10">Server not found</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold tracking-tight">{server.hostname}</h1>
                        <Badge variant={
                            server.status === 'ACTIVE' ? 'default' :
                                server.status === 'INSTALLING' ? 'secondary' : 'destructive'
                        }>{server.status}</Badge>
                    </div>
                    <p className="text-muted-foreground font-mono mt-1">{server.macAddress}</p>
                </div>
                <Button variant="outline" onClick={fetchServer} disabled={actionLoading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="power">Power</TabsTrigger>
                    <TabsTrigger value="reinstall">Reinstall</TabsTrigger>
                    <TabsTrigger value="console" disabled>Console</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 mt-4">
                    {/* Top Stats Row */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardContent className="p-4 flex flex-row items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-md">
                                    <Cpu className="h-8 w-8 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium leading-none">{server.hardware?.cpuModel || "Unknown CPU"}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {server.hardware?.cpuCores ? `${server.hardware.cpuCores} Cores` : "Cores Unknown"}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex flex-row items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-md">
                                    <MemoryStick className="h-8 w-8 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium leading-none">
                                        {server.hardware?.ramMiB ? `${Math.round(server.hardware.ramMiB / 1024)} GB RAM` : "RAM Unknown"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">Memory</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex flex-row items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-md">
                                    <HardDrive className="h-8 w-8 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium leading-none">
                                        {(() => {
                                            const disks = Array.isArray(server.hardware?.disksJson) ? server.hardware.disksJson : [];
                                            const validDisks = disks.filter((d: any) =>
                                                !d.name.startsWith('loop') &&
                                                !d.name.startsWith('sr') &&
                                                !d.name.startsWith('ram')
                                            );

                                            // Simple parser for human readable sizes (e.g. "447.1G", "1.8T")
                                            const parseSize = (s: string) => {
                                                if (!s) return 0;
                                                const numeric = parseFloat(s);
                                                if (s.includes('T')) return numeric * 1024;
                                                if (s.includes('G')) return numeric;
                                                if (s.includes('M')) return numeric / 1024;
                                                return 0; // Ignore K or B for total storage mostly
                                            };

                                            const totalGB = validDisks.reduce((acc: number, d: any) => acc + parseSize(d.size), 0);
                                            if (totalGB > 1000) return `${(totalGB / 1024).toFixed(2)} TB Storage`;
                                            return `${totalGB.toFixed(0)} GB Storage`;
                                        })()}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {(() => {
                                            const disks = Array.isArray(server.hardware?.disksJson) ? server.hardware.disksJson : [];
                                            const count = disks.filter((d: any) => !d.name.startsWith('loop') && !d.name.startsWith('sr')).length;
                                            return `${count} Disks`;
                                        })()}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex flex-row items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-md">
                                    <Globe className="h-8 w-8 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium leading-none">Unmetered</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        IPv4: {server.primaryIpv4 || "DHCP"}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Action Cards */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Hardware Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {server.hardware?.disksJson && (
                                    <div className="text-xs space-y-1">
                                        <p className="font-semibold mb-2">Physical Disks:</p>
                                        {Array.isArray(server.hardware.disksJson) && (server.hardware.disksJson as any[])
                                            .filter((d: any) => !d.name.startsWith('loop') && !d.name.startsWith('sr'))
                                            .map((d: any, i: number) => (
                                                <div key={i} className="flex justify-between border-b pb-1 last:border-0">
                                                    <span className="font-mono">{d.name}</span>
                                                    <span className="text-muted-foreground">{d.size} ({d.model || "Unknown"})</span>
                                                </div>
                                            ))}
                                    </div>
                                )}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-4"
                                    onClick={handleInventoryScan}
                                    disabled={actionLoading || server.status === 'INSTALLING' || server.status === 'INVENTORYING'}
                                >
                                    {server.status === 'INVENTORYING' ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <HardDrive className="mr-2 h-3 w-3" />}
                                    {server.status === 'INVENTORYING' ? "Scanning..." : "Scan Hardware"}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="power" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                <span>Power Control</span>
                                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : (
                                    <Badge variant={powerState === 'on' ? 'default' : powerState === 'off' ? 'destructive' : 'secondary'}>
                                        {powerState ? `Power: ${powerState.toUpperCase()}` : 'Power: UNKNOWN'}
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription>Control the physical power state of the server via IPMI.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-4">
                                <Button onClick={() => handlePower('on')} disabled={actionLoading} className="w-32 bg-green-600 hover:bg-green-700">
                                    <Power className="mr-2 h-4 w-4" /> Power On
                                </Button>
                                <Button onClick={() => handlePower('off')} disabled={actionLoading} variant="destructive" className="w-32">
                                    <Power className="mr-2 h-4 w-4" /> Power Off
                                </Button>
                                <Button onClick={() => handlePower('reset')} disabled={actionLoading} variant="outline" className="w-32">
                                    <RefreshCw className="mr-2 h-4 w-4" /> Reboot (Force)
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Note: Power actions may take up to 30 seconds to reflect.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="reinstall" className="mt-4">
                    {/* Check if there's an active install */}
                    {server.installs && server.installs.length > 0 &&
                        ['QUEUED', 'RUNNING'].includes(server.installs[0].state) ? (
                        <InstallProgress
                            install={server.installs[0]}
                            onCancel={handleCancel}
                        />
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Reinstall Operating System</CardTitle>
                                <CardDescription className="text-red-500">
                                    Warning: Reinstalling will permanently delete all data on the server disks.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 max-w-lg">
                                <ReinstallDialog
                                    server={server}
                                    profiles={profiles}
                                    onReinstall={handleReinstall}
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Show previous/completed install if present and not running */}
                    {server.installs && server.installs.length > 0 &&
                        ['DONE', 'FAILED'].includes(server.installs[0].state) && (
                            <div className="mt-6">
                                <h3 className="mb-2 text-sm font-medium">Last Installation</h3>
                                <InstallProgress install={server.installs[0]} />
                            </div>
                        )}
                </TabsContent>
            </Tabs>

            <Separator />

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Activity Log</h3>
                <div className="border rounded-md bg-muted/40 p-4 h-64 overflow-y-auto font-mono text-xs">
                    {server.events?.length === 0 ? <div className="text-muted-foreground">No events recorded.</div> : null}
                    {server.events?.map((e: any) => (
                        <div key={e.id} className="mb-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <span className="text-muted-foreground mr-2">[{new Date(e.createdAt).toLocaleString()}]</span>
                            <span className={`font-bold mr-2 ${e.type === 'ERROR' ? 'text-red-500' : 'text-blue-500'}`}>{e.type}</span>
                            <span>{e.message}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
