
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, HardDrive } from "lucide-react";
import { toast } from "sonner";

interface ReinstallDialogProps {
    server: any;
    profiles: any[];
    onReinstall: (data: any) => Promise<void>;
}

export function ReinstallDialog({ server, profiles, onReinstall }: ReinstallDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        hostname: server.hostname || "",
        profileId: "",
        rootPassword: "",
        sshKeys: "", // Split by newline
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!formData.profileId) {
            toast.error("Please select an operating system profile");
            setLoading(false);
            return;
        }

        try {
            await onReinstall({
                ...formData,
                sshKeys: formData.sshKeys.split('\n').filter(k => k.trim().length > 0)
            });
            setOpen(false);
            // Form reset or keep? 
        } catch (error) {
            // Handled by parent usually but good to know
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                    <HardDrive className="mr-2 h-4 w-4" /> Start Reinstallation
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Reinstall Server</DialogTitle>
                        <DialogDescription className="text-red-500 font-medium">
                            WARNING: This action will permanently wipe all data on the server!
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="profile">Operating System</Label>
                            <Select
                                value={formData.profileId}
                                onValueChange={(v) => setFormData({ ...formData, profileId: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select OS..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {profiles.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="hostname">Hostname</Label>
                            <Input
                                id="hostname"
                                value={formData.hostname}
                                onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                                placeholder="server.example.com"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Root Password</Label>
                            <Input
                                id="password"
                                type="text"
                                value={formData.rootPassword}
                                onChange={(e) => setFormData({ ...formData, rootPassword: e.target.value })}
                                placeholder="Leave empty to generate random"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sshKeys">SSH Keys (One per line)</Label>
                            <Textarea
                                id="sshKeys"
                                value={formData.sshKeys}
                                onChange={(e) => setFormData({ ...formData, sshKeys: e.target.value })}
                                placeholder="ssh-rsa AAAA..."
                                className="font-mono text-xs"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="destructive" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Reinstall
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
