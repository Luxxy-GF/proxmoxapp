
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, RefreshCw, Plus, Trash2, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { BareMetalConsole } from "@/components/console/BareMetalConsole";

export default function AdminDedicatedDetailsPage() {
    const { id } = useParams();
    const [server, setServer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [ips, setIps] = useState<any[]>([]);
    const [pools, setPools] = useState<any[]>([]);

    // Allocate Dialog
    const [allocateOpen, setAllocateOpen] = useState(false);
    const [selectedPool, setSelectedPool] = useState("");
    const [allocateCount, setAllocateCount] = useState("1");
    const [allocating, setAllocating] = useState(false);

    // IPMI State
    const [ipmiHost, setIpmiHost] = useState("");
    const [ipmiUser, setIpmiUser] = useState("");
    const [ipmiPass, setIpmiPass] = useState("");
    const [savingIpmi, setSavingIpmi] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [srvRes, ipsRes, poolsRes] = await Promise.all([
                fetch(`/api/baremetal/servers/${id}?t=${Date.now()}`),
                fetch(`/api/baremetal/servers/${id}/ips?t=${Date.now()}`),
                fetch(`/api/admin/ip-pools?t=${Date.now()}`)
            ]);

            if (srvRes.ok) {
                const srv = await srvRes.json();
                setServer(srv);
                // Pre-fill IPMI (Currently API doesn't return secrets, skipping prefill of pass)
                // Assuming we might add ipmiHost to response later
            }
            if (ipsRes.ok) setIps(await ipsRes.json());
            if (poolsRes.ok) setPools(await poolsRes.json());

        } catch (e) {
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const fetchIps = async () => {
        const res = await fetch(`/api/baremetal/servers/${id}/ips?t=${Date.now()}`);
        if (res.ok) setIps(await res.json());
        // Also refresh server for primary IP
        const sRes = await fetch(`/api/baremetal/servers/${id}?t=${Date.now()}`);
        if (sRes.ok) setServer(await sRes.json());
    };

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const handleAllocate = async () => {
        if (!selectedPool || !allocateCount) return;
        setAllocating(true);
        try {
            const res = await fetch(`/api/baremetal/servers/${id}/ips`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ poolId: selectedPool, count: parseInt(allocateCount) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Allocation failed");

            toast.success(`Allocated ${data.allocations?.length || 0} IPs`);
            setAllocateOpen(false);
            fetchIps();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setAllocating(false);
        }
    };

    const handleRelease = async (ip: string) => {
        if (!confirm(`Release IP ${ip}? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/baremetal/servers/${id}/ips?ip=${ip}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to release IP");
            toast.success("IP Released");
            fetchIps();
        } catch (e) {
            toast.error("Error releasing IP");
        }
    };

    const handleSetPrimary = async (ip: string | null) => {
        try {
            const res = await fetch(`/api/baremetal/servers/${id}/ips`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ primaryIpv4: ip }) // Setting IP or null? user probably wants to set valid IP
            });
            if (!res.ok) throw new Error("Failed to set primary IP");
            toast.success("Primary IP Updated (DHCP Config Regenerated)");
            fetchIps();
        } catch (e) {
            toast.error("Error setting primary IP");
        }
    };

    const handleIpmiSave = async () => {
        setSavingIpmi(true);
        try {
            const res = await fetch(`/api/baremetal/servers/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ipmiHost, ipmiUser, ipmiPass }),
            });
            if (!res.ok) throw new Error("Update failed");
            toast.success("IPMI Config Saved");
        } catch (e) {
            toast.error("Failed to save IPMI");
        } finally {
            setSavingIpmi(false);
        }
    };

    // Network Config State
    const [configOpen, setConfigOpen] = useState(false);
    const [configData, setConfigData] = useState({
        primaryIpv4: "",
        gateway: "",
        netmask: "",
        nameservers: "",
        vlanId: "",
        rack: ""
    });
    const [savingConfig, setSavingConfig] = useState(false);

    useEffect(() => {
        if (server) {
            setConfigData({
                primaryIpv4: server.primaryIpv4 || "",
                gateway: server.gateway || "",
                netmask: server.netmask || "",
                nameservers: server.nameservers || "",
                vlanId: server.vlanId?.toString() || "",
                rack: server.rack || ""
            });
        }
    }, [server]);

    const handleConfigSave = async () => {
        setSavingConfig(true);
        try {
            const body = {
                primaryIpv4: configData.primaryIpv4 || null,
                gateway: configData.gateway || null,
                netmask: configData.netmask || null,
                nameservers: configData.nameservers || null,
                vlanId: configData.vlanId ? parseInt(configData.vlanId) : null,
                rack: configData.rack || null
            };

            const res = await fetch(`/api/baremetal/servers/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error("Failed to update configuration");
            toast.success("Network configuration updated");
            setConfigOpen(false);
            fetchIps(); // Refresh server data
        } catch (e) {
            toast.error("Update failed");
        } finally {
            setSavingConfig(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!server) return <div className="p-10">Server not found</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{server.hostname}</h1>
                    <p className="text-muted-foreground font-mono">{server.macAddress}</p>
                </div>
                <div className="flex gap-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button>Open Console</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[90vw] h-[90vh] p-0 border-0 bg-transparent shadow-none">
                            <div className="w-full h-full bg-black rounded-lg overflow-hidden border border-zinc-700">
                                <BareMetalConsole id={id as string} />
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Link href="/dashboard/admin/dedicated">
                        <Button variant="outline">Back to List</Button>
                    </Link>
                    <Button variant="outline" size="icon" onClick={fetchData}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="network" className="w-full">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="network">Network & IPs</TabsTrigger>
                    <TabsTrigger value="settings">Settings (IPMI)</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                    <Card>
                        <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between border-b pb-2">
                                <span className="font-semibold">Status</span>
                                <Badge>{server.status}</Badge>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="font-semibold">User</span>
                                <span>{server.user?.email || "Unassigned"}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="font-semibold">Rack</span>
                                <span>{server.rack || "N/A"}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="font-semibold">Primary IP</span>
                                <span className="font-mono">{server.primaryIpv4 || "DHCP (Dynamic)"}</span>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="network" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Network Configuration</CardTitle>
                                <CardDescription>Static network settings provided to the OS.</CardDescription>
                            </div>
                            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">Edit Config</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Edit Network Configuration</DialogTitle></DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Primary IPv4</Label>
                                            <Input value={configData.primaryIpv4} onChange={e => setConfigData({ ...configData, primaryIpv4: e.target.value })} placeholder="10.x.x.x" />
                                            <p className="text-xs text-muted-foreground">Used for PXE and Main Assignment</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Gateway</Label>
                                                <Input value={configData.gateway} onChange={e => setConfigData({ ...configData, gateway: e.target.value })} placeholder="192.168.1.1" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Netmask</Label>
                                                <Input value={configData.netmask} onChange={e => setConfigData({ ...configData, netmask: e.target.value })} placeholder="255.255.255.0" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>DNS Nameservers</Label>
                                            <Input value={configData.nameservers} onChange={e => setConfigData({ ...configData, nameservers: e.target.value })} placeholder="8.8.8.8 1.1.1.1" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>VLAN ID</Label>
                                                <Input type="number" value={configData.vlanId} onChange={e => setConfigData({ ...configData, vlanId: e.target.value })} placeholder="None" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Rack Location</Label>
                                                <Input value={configData.rack} onChange={e => setConfigData({ ...configData, rack: e.target.value })} placeholder="Rack 1, Unit 4" />
                                            </div>
                                        </div>
                                        <Button onClick={handleConfigSave} disabled={savingConfig} className="w-full">
                                            {savingConfig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Configuration
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm font-medium">Gateway</p>
                                <p className="text-muted-foreground font-mono text-sm">{server.gateway || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium">Netmask</p>
                                <p className="text-muted-foreground font-mono text-sm">{server.netmask || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium">VLAN</p>
                                <p className="text-muted-foreground font-mono text-sm">{server.vlanId || "Native"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium">Nameservers</p>
                                <p className="text-muted-foreground font-mono text-sm">{server.nameservers || "N/A"}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>IP Allocations</CardTitle>
                                    <CardDescription>
                                        Manage routed IPs and Static DHCP assignments.
                                    </CardDescription>
                                </div>
                                <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Allocate IPs</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader><DialogTitle>Allocate IP Addresses</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>IP Pool</Label>
                                                <Select value={selectedPool} onValueChange={setSelectedPool}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Pool" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {pools.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.name} ({p.startIP} - {p.endIP})</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Amount</Label>
                                                <Input type="number" min="1" max="16" value={allocateCount} onChange={e => setAllocateCount(e.target.value)} />
                                            </div>
                                            <Button onClick={handleAllocate} disabled={allocating || !selectedPool} className="w-full">
                                                {allocating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Allocate
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>IP Address</TableHead>
                                        <TableHead>Pool</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        // Merge manual primary IP into list if not present
                                        const displayIps = [...ips];
                                        if (server.primaryIpv4 && !ips.find(i => i.ipAddress === server.primaryIpv4)) {
                                            displayIps.unshift({
                                                id: 'manual-primary',
                                                ipAddress: server.primaryIpv4,
                                                pool: { name: 'Manual Assignment' },
                                                isManual: true
                                            });
                                        }

                                        if (displayIps.length === 0) {
                                            return (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-muted-foreground p-6">No IPs allocated.</TableCell>
                                                </TableRow>
                                            );
                                        }

                                        return displayIps.map(ip => {
                                            const isPrimary = server.primaryIpv4 === ip.ipAddress;
                                            return (
                                                <TableRow key={ip.id}>
                                                    <TableCell className="font-mono font-medium">
                                                        {ip.ipAddress}
                                                        {isPrimary && <Badge className="ml-2 bg-blue-500">Primary (PXE)</Badge>}
                                                    </TableCell>
                                                    <TableCell>{ip.pool?.name}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{ip.isManual ? 'Config' : 'Reserved'}</TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        {!isPrimary && (
                                                            <Button variant="ghost" size="sm" onClick={() => handleSetPrimary(ip.ipAddress)}>
                                                                Make Primary
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => {
                                                            if (ip.isManual) {
                                                                // Unset primary
                                                                handleSetPrimary(null as any); // Hacky cast, but handleSetPrimary sends payload
                                                            } else {
                                                                handleRelease(ip.ipAddress);
                                                            }
                                                        }}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        });
                                    })()}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>IPMI Configuration</CardTitle>
                            <CardDescription>Credentials for Out-of-Band Management</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 max-w-lg">
                            <div className="space-y-2">
                                <Label>Host / IP</Label>
                                <Input value={ipmiHost} onChange={e => setIpmiHost(e.target.value)} placeholder="10.x.x.x" />
                            </div>
                            <div className="space-y-2">
                                <Label>User</Label>
                                <Input value={ipmiUser} onChange={e => setIpmiUser(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Password</Label>
                                <Input type="password" value={ipmiPass} onChange={e => setIpmiPass(e.target.value)} placeholder="••••••" />
                            </div>
                            <Button onClick={handleIpmiSave} disabled={savingIpmi}>
                                {savingIpmi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
