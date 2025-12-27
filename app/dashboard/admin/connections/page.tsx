
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Key } from "lucide-react";

interface Connection {
    id: string;
    type: 'IPMI' | 'DHCP' | 'PXE';
    name: string;
    description: string;
    agentId?: string;
    enabled: boolean;
}

export default function AdminConnectionsPage() {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State
    const [type, setType] = useState<string>("IPMI");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [configJson, setConfigJson] = useState("");

    const fetchConnections = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/baremetal/connections");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setConnections(data);
        } catch (error) {
            toast.error("Failed to load connections");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConnections();
    }, []);

    const handleCreate = async () => {
        setSaving(true);
        try {
            let parsedConfig = {};
            try {
                parsedConfig = JSON.parse(configJson);
            } catch (e) {
                throw new Error("Invalid JSON Config");
            }

            const res = await fetch("/api/baremetal/connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type,
                    name,
                    description,
                    config: parsedConfig
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (Array.isArray(data)) throw new Error(data[0].message);
                throw new Error(data.error || "Creation failed");
            }

            toast.success("Connection created");
            setCreateOpen(false);
            setName(""); setDescription(""); setConfigJson("");
            fetchConnections();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Infrastructure Connections</h1>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchConnections}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="h-4 w-4 mr-2" /> Add Connection</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>Add New Connection</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Type</Label>
                                        <Select value={type} onValueChange={setType}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="IPMI">IPMI (BMC/iDRAC/iLO)</SelectItem>
                                                <SelectItem value="DHCP">DHCP Provider</SelectItem>
                                                <SelectItem value="PXE">PXE Service</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Name</Label>
                                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rack A IPMI Network" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Configuration (JSON)</Label>
                                    <div className="text-xs text-muted-foreground mb-1">
                                        Enter connection details. For IPMI: {"{ \"host\": \"1.2.3.4\", \"user\": \"root\", \"pass\": \"calvin\" }"}
                                    </div>
                                    <Textarea
                                        value={configJson}
                                        onChange={(e) => setConfigJson(e.target.value)}
                                        placeholder="{ ... }"
                                        className="font-mono h-32"
                                    />
                                    <p className="text-xs text-amber-600 flex items-center">
                                        <Key className="h-3 w-3 mr-1" />
                                        This data will be encrypted at rest.
                                    </p>
                                </div>
                                <Button onClick={handleCreate} disabled={saving} className="w-full">
                                    {saving ? <Loader2 className="animate-spin mr-2" /> : null} Create
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
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Agent</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {connections.map((conn) => (
                            <TableRow key={conn.id}>
                                <TableCell>
                                    <Badge variant="outline">{conn.type}</Badge>
                                </TableCell>
                                <TableCell className="font-medium">{conn.name}</TableCell>
                                <TableCell className="text-muted-foreground">{conn.description}</TableCell>
                                <TableCell>
                                    <Badge variant={conn.enabled ? "default" : "secondary"}>
                                        {conn.enabled ? "Enabled" : "Disabled"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm font-mono text-muted-foreground">
                                    {conn.agentId || "Local Controller"}
                                </TableCell>
                            </TableRow>
                        ))}
                        {!loading && connections.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                    No connections defined.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
