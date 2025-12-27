
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
import { Loader2, Plus, RefreshCw } from "lucide-react";

interface PXEProfile {
    id: string;
    name: string;
    kind: string;
    osFamily: string;
    tags: string[];
    enabled: boolean;
}

export default function AdminPXEProfilesPage() {
    const [profiles, setProfiles] = useState<PXEProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [kind, setKind] = useState("INSTALL");
    const [osFamily, setOsFamily] = useState("UBUNTU");
    const [scriptTemplate, setScriptTemplate] = useState("");

    const fetchProfiles = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/baremetal/pxe/profiles");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setProfiles(data);
        } catch (error) {
            toast.error("Failed to load profiles");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleCreate = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/baremetal/pxe/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    kind,
                    osFamily,
                    tags: [], // Todo: Tag input
                    bootScriptTemplate: scriptTemplate || undefined
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (Array.isArray(data)) throw new Error(data[0].message);
                throw new Error(data.error || "Creation failed");
            }

            toast.success("Profile created");
            setCreateOpen(false);
            setName(""); setScriptTemplate("");
            fetchProfiles();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">PXE Profiles</h1>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchProfiles}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="h-4 w-4 mr-2" /> Add Profile</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>Add PXE Profile</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ubuntu 22.04 LTS" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Kind</Label>
                                        <Select value={kind} onValueChange={setKind}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="INSTALL">Install</SelectItem>
                                                <SelectItem value="RESCUE">Rescue</SelectItem>
                                                <SelectItem value="INVENTORY">Inventory</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>OS Family</Label>
                                        <Select value={osFamily} onValueChange={setOsFamily}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="UBUNTU">Ubuntu</SelectItem>
                                                <SelectItem value="DEBIAN">Debian</SelectItem>
                                                <SelectItem value="ALMALINUX">AlmaLinux</SelectItem>
                                                <SelectItem value="OTHER">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>iPXE Script Template (Optional)</Label>
                                    <div className="text-xs text-muted-foreground mb-1">
                                        Leave blank for auto-generation. Use {"{{CONFIG_URL}}"} and {"{{CALLBACK_URL}}"} tags.
                                    </div>
                                    <Textarea
                                        value={scriptTemplate}
                                        onChange={(e) => setScriptTemplate(e.target.value)}
                                        placeholder="#!ipxe ..."
                                        className="font-mono h-32"
                                    />
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
                            <TableHead>rub</TableHead>
                            <TableHead>Kind</TableHead>
                            <TableHead>OS Family</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {profiles.map((profile) => (
                            <TableRow key={profile.id}>
                                <TableCell className="font-medium">{profile.name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{profile.kind}</Badge>
                                </TableCell>
                                <TableCell>{profile.osFamily}</TableCell>
                                <TableCell>
                                    <Badge variant={profile.enabled ? "default" : "secondary"}>
                                        {profile.enabled ? "Enabled" : "Disabled"}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!loading && profiles.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                    No profiles defined.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
