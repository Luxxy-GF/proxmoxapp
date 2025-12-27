
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw } from "lucide-react";

interface DedicatedServer {
    id: string;
    hostname: string;
    macAddress: string;
    status: string;
    user?: { email: string };
    createdAt: string;
}

export default function AdminDedicatedPage() {
    const [servers, setServers] = useState<DedicatedServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Create Form State
    const [hostname, setHostname] = useState("");
    const [macAddress, setMacAddress] = useState("");
    const [rack, setRack] = useState("");

    const fetchServers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/baremetal/servers");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setServers(data);
        } catch (error) {
            toast.error("Failed to load servers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServers();
    }, []);

    const handleCreate = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/baremetal/servers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hostname, macAddress, rack }),
            });
            const data = await res.json();
            if (!res.ok) {
                // If it's a ZodError array
                if (Array.isArray(data)) throw new Error(data[0].message);
                throw new Error(data.error || "Creation failed");
            }
            toast.success("Server created");
            setCreateOpen(false);
            setHostname(""); setMacAddress(""); setRack("");
            fetchServers();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    // IPMI Dialog State
    const [ipmiOpen, setIpmiOpen] = useState(false);
    const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
    const [ipmiHost, setIpmiHost] = useState("");
    const [ipmiUser, setIpmiUser] = useState("");
    const [ipmiPass, setIpmiPass] = useState("");

    const openIpmiDialog = (server: DedicatedServer) => {
        setSelectedServerId(server.id);
        // Reset fields (security: don't prefill pass, maybe prefill host/user if we had it, but API doesn't return it yet for list)
        setIpmiHost("");
        setIpmiUser("");
        setIpmiPass("");
        setIpmiOpen(true);
    };

    const handleIpmiSave = async () => {
        if (!selectedServerId) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/baremetal/servers/${selectedServerId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ipmiHost, ipmiUser, ipmiPass }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Update failed");

            toast.success("IPMI Configuration updated");
            setIpmiOpen(false);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Dedicated Servers (Admin)</h1>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchServers}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="h-4 w-4 mr-2" /> Add Server</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Dedicated Server</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label>Hostname</Label>
                                    <Input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="srv-01.example.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label>MAC Address</Label>
                                    <Input value={macAddress} onChange={(e) => setMacAddress(e.target.value)} placeholder="00:11:22:33:44:55" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Rack / Location (Optional)</Label>
                                    <Input value={rack} onChange={(e) => setRack(e.target.value)} placeholder="Rack A1" />
                                </div>
                                <Button onClick={handleCreate} disabled={saving} className="w-full">
                                    {saving ? <Loader2 className="animate-spin mr-2" /> : null} Create
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* IPMI Config Dialog */}
                    <Dialog open={ipmiOpen} onOpenChange={setIpmiOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Configure IPMI / Management</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label>Management URL / IP</Label>
                                    <Input value={ipmiHost} onChange={(e) => setIpmiHost(e.target.value)} placeholder="10.15.0.100" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Username</Label>
                                    <Input value={ipmiUser} onChange={(e) => setIpmiUser(e.target.value)} placeholder="admin" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <Input type="password" value={ipmiPass} onChange={(e) => setIpmiPass(e.target.value)} placeholder="••••••" />
                                </div>
                                <Button onClick={handleIpmiSave} disabled={saving} className="w-full">
                                    {saving ? <Loader2 className="animate-spin mr-2" /> : null} Save Configuration
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Hostname</TableHead>
                            <TableHead>MAC</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {servers.map((server) => (
                            <TableRow key={server.id}>
                                <TableCell className="font-medium">{server.hostname}</TableCell>
                                <TableCell className="font-mono text-sm">{server.macAddress}</TableCell>
                                <TableCell>
                                    <Badge variant={
                                        server.status === 'ACTIVE' ? 'default' :
                                            server.status === 'INSTALLING' ? 'secondary' : 'destructive'
                                    }>{server.status}</Badge>
                                </TableCell>
                                <TableCell>{server.user?.email || "Unassigned"}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => openIpmiDialog(server)} className="mr-2">
                                        IPMI
                                    </Button>
                                    <Link href={`/dashboard/admin/dedicated/${server.id}`}>
                                        <Button variant="outline" size="sm">Manage</Button>
                                    </Link>
                                    <Link href={`/dashboard/dedicated/${server.id}`}>
                                        <Button variant="ghost" size="sm" className="ml-2">User View</Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!loading && servers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                    No servers found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
