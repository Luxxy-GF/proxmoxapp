"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
    AlertOctagon, Eye, EyeOff, Wand2, Disc, AlertTriangle
} from "lucide-react";
import { InstallProgress } from "./install-progress";

interface ReinstallPaneProps {
    server: any;
    profiles: any[];
    onReinstall: (data: any) => Promise<void>;
    onCancel?: () => Promise<void>;
}

export function ReinstallPane({ server, profiles, onReinstall, onCancel }: ReinstallPaneProps) {
    // Group profiles by OS Family
    const osFamilies = useMemo(() => {
        const families: Record<string, any[]> = {};
        profiles.forEach(p => {
            let family = p.name.split(' ')[0];
            if (p.name.includes("Proxmox")) family = "Proxmox";
            if (p.name.includes("Rocky")) family = "Rocky Linux";
            if (p.name.includes("Alma")) family = "AlmaLinux";
            if (!families[family]) families[family] = [];
            families[family].push(p);
        });
        // Add Disk Wipe option
        if (!families["Disk Wipe"]) {
            families["Disk Wipe"] = [{ id: "wipe", name: "Secure Disk Wipe", isDestructive: true }];
        }
        return families;
    }, [profiles]);

    const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<string>("");

    // Config State
    const [hostname, setHostname] = useState(server.hostname || "");
    const [password, setPassword] = useState("");
    const [sshKeys, setSshKeys] = useState("");
    const [diskLayout, setDiskLayout] = useState("auto"); // Default

    const [showPassword, setShowPassword] = useState(false);

    // Confirmation Dialog
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmAck, setConfirmAck] = useState(false);
    const [loading, setLoading] = useState(false);

    // Auto-select first version when family changes
    useEffect(() => {
        if (selectedFamily && osFamilies[selectedFamily]?.length > 0) {
            setSelectedProfileId(osFamilies[selectedFamily][0].id);
        }
    }, [selectedFamily, osFamilies]);

    const handleGeneratePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let pass = "";
        for (let i = 0; i < 16; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        setPassword(pass);
    };

    const handleInstall = async () => {
        if (!selectedProfileId) return;
        setLoading(true);
        try {
            await onReinstall({
                profileId: selectedProfileId === 'wipe' ? 'wipe' : selectedProfileId,
                hostname,
                rootPassword: password,
                sshKeys: sshKeys.split('\n').filter(k => k.trim().length > 0),
                diskLayout,
            });
            setConfirmOpen(false);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const activeInstall = server.installs && server.installs.length > 0 ? server.installs[0] : null;

    return (
        <div className="space-y-6 w-full pb-20">
            {/* Header Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Reinstall Operating System</h2>
                <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-500">
                    <AlertOctagon className="h-4 w-4" />
                    <AlertTitle>Reinstalling will permanently delete all data on this server.</AlertTitle>
                </Alert>
            </div>

            {/* Section 1: Operating System Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>Select Operating System</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.keys(osFamilies).map((family) => {
                            const isSelected = selectedFamily === family;
                            const isWipe = family === "Disk Wipe";

                            return (
                                <div
                                    key={family}
                                    onClick={() => setSelectedFamily(family)}
                                    className={`
                                        cursor-pointer rounded-md border p-4 transition-all
                                        ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-muted bg-card hover:bg-accent/50 hover:border-sidebar-accent"}
                                        ${isWipe && isSelected ? "border-red-500 bg-red-500/5 ring-red-500" : ""}
                                    `}
                                >
                                    <div className="flex flex-col items-center text-center space-y-3">
                                        <div className={`p-2 rounded-full ${isSelected ? "bg-background shadow-sm" : "bg-muted/50"}`}>
                                            {getOsIcon(family)}
                                        </div>

                                        <div className="font-semibold">{family}</div>

                                        <div className="w-full" onClick={(e) => e.stopPropagation()}>
                                            <Select
                                                value={isSelected ? selectedProfileId : ""}
                                                onValueChange={setSelectedProfileId}
                                                disabled={!isSelected || isWipe}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder={isWipe ? "Secure Wipe" : "Select Version"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {osFamilies[family].map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Section 2: Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Configure System</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Hostname</Label>
                            <Input
                                placeholder="server.example.com"
                                value={hostname}
                                onChange={(e) => setHostname(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Root Password</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter or generate..."
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <Button variant="outline" onClick={handleGeneratePassword} title="Generate">
                                    <Wand2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Disk Layout</Label>
                            <Select value={diskLayout} onValueChange={setDiskLayout}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Automatic (Ext4)</SelectItem>
                                    <SelectItem value="raid1">Software RAID-1</SelectItem>
                                    <SelectItem value="zfs">ZFS (RAID-1)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>SSH Keys (Optional)</Label>
                        <Textarea
                            className="font-mono text-xs min-h-[100px]"
                            placeholder={`ssh-ed25519 AAAAC3NzaC...`}
                            value={sshKeys}
                            onChange={(e) => setSshKeys(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Add one public key per line.</p>
                    </div>
                </CardContent>

                {/* Section 3: Action Button (Inside Card Footer) */}
                <div className="flex items-center justify-between p-6 pt-0">
                    <div className="text-sm text-muted-foreground">
                        {selectedFamily ? (
                            <span>Target: <span className="font-medium text-foreground">{profiles.find(p => p.id === selectedProfileId)?.name || selectedFamily}</span></span>
                        ) : (
                            <span>Select an OS above to proceed.</span>
                        )}
                    </div>

                    <Dialog open={confirmOpen} onOpenChange={(open) => {
                        if (open) setConfirmAck(false);
                        setConfirmOpen(open);
                    }}>
                        <DialogTrigger asChild>
                            <Button
                                variant="destructive"
                                size="lg"
                                className="px-8"
                                disabled={!selectedFamily || (!password && !sshKeys && selectedFamily !== 'Disk Wipe')}
                            >
                                Start Reinstallation
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Confirm Reinstallation</DialogTitle>
                                <DialogDescription>
                                    This action cannot be undone.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="bg-muted/30 border-l-2 border-red-500/50 p-4 rounded-r-md text-sm space-y-3 font-mono">
                                    <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
                                        <span className="text-muted-foreground">Operating System:</span>
                                        <span className="font-medium text-foreground">
                                            {profiles.find(p => p.id === selectedProfileId)?.name || selectedFamily}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
                                        <span className="text-muted-foreground">Disk Action:</span>
                                        <span className="font-medium text-red-500">All disks will be wiped</span>
                                    </div>
                                    <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
                                        <span className="text-muted-foreground">Hostname:</span>
                                        <span className="font-medium text-foreground">{hostname || server.hostname}</span>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox id="confirm" checked={confirmAck} onCheckedChange={(c) => setConfirmAck(!!c)} />
                                    <Label htmlFor="confirm" className="font-medium">
                                        I understand this will permanently delete all data.
                                    </Label>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                                <Button variant="destructive" onClick={handleInstall} disabled={!confirmAck || loading}>
                                    {loading ? "Starting..." : "Confirm Reinstallation"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </Card>

            {/* Section 4: Last Installation */}
            {activeInstall && (
                <div className="pt-6">
                    <h3 className="text-sm font-semibold mb-3">Previous Installation Status</h3>
                    <InstallProgress install={activeInstall} onCancel={onCancel} />
                </div>
            )}
        </div>
    );
}

// Icon Helper
function getOsIcon(family: string) {
    const className = "h-8 w-8";
    if (family.includes("Debian")) {
        return (
            <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#D70A53]`} xmlns="http://www.w3.org/2000/svg">
                <path d="M13.88 12.685c-.4 0 .08.2.601.28.14-.1.27-.22.39-.33a3.001 3.001 0 01-.99.05m2.14-.53c.23-.33.4-.69.47-1.06-.06.27-.2.5-.33.73-.75.47-.07-.27 0-.56-.8 1.01-.11.6-.14.89m.781-2.05c.05-.721-.14-.501-.2-.221.07.04.13.5.2.22M12.38.31c.2.04.45.07.42.12.23-.05.28-.1-.43-.12m.43.12l-.15.03.14-.01V.43m6.633 9.944c.02.64-.2.95-.38 1.5l-.35.181c-.28.54.03.35-.17.78-.44.39-1.34 1.22-1.62 1.301-.201 0 .14-.25.19-.34-.591.4-.481.6-1.371.85l-.03-.06c-2.221 1.04-5.303-1.02-5.253-3.842-.03.17-.07.13-.12.2a3.551 3.552 0 012.001-3.501 3.361 3.362 0 013.732.48 3.341 3.342 0 00-2.721-1.3c-1.18.01-2.281.76-2.651 1.57-.6.38-.67 1.47-.93 1.661-.361 2.601.66 3.722 2.38 5.042.27.19.08.21.12.35a4.702 4.702 0 01-1.53-1.16c.23.33.47.66.8.91-.55-.18-1.27-1.3-1.48-1.35.93 1.66 3.78 2.921 5.261 2.3a6.203 6.203 0 01-2.33-.28c-.33-.16-.77-.51-.7-.57a5.802 5.803 0 005.902-.84c.44-.35.93-.94 1.07-.95-.2.32.04.16-.12.44.44-.72-.2-.3.46-1.24l.24.33c-.09-.6.74-1.321.66-2.262.19-.3.2.3 0 .97.29-.74.08-.85.15-1.46.08.2.18.42.23.63-.18-.7.2-1.2.28-1.6-.09-.05-.28.3-.32-.53 0-.37.1-.2.14-.28-.08-.05-.26-.32-.38-.861.08-.13.22.33.34.34-.08-.42-.2-.75-.2-1.08-.34-.68-.12.1-.4-.3-.34-1.091.3-.25.34-.74.54.77.84 1.96.981 2.46-.1-.6-.28-1.2-.49-1.76.16.07-.26-1.241.21-.37A7.823 7.824 0 0017.702 1.6c.18.17.42.39.33.42-.75-.45-.62-.48-.73-.67-.61-.25-.65.02-1.06 0C15.082.73 14.862.8 13.8.4l.05.23c-.77-.25-.9.1-1.73 0-.05-.04.27-.14.53-.18-.741.1-.701-.14-1.431.03.17-.13.36-.21.55-.32-.6.04-1.44.35-1.18.07C9.6.68 7.847 1.3 6.867 2.22L6.838 2c-.45.54-1.96 1.611-2.08 2.311l-.131.03c-.23.4-.38.85-.57 1.261-.3.52-.45.2-.4.28-.6 1.22-.9 2.251-1.16 3.102.18.27 0 1.65.07 2.76-.3 5.463 3.84 10.776 8.363 12.006.67.23 1.65.23 2.49.25-.99-.28-1.12-.15-2.08-.49-.7-.32-.85-.7-1.34-1.13l.2.35c-.971-.34-.57-.42-1.361-.67l.21-.27c-.31-.03-.83-.53-.97-.81l-.34.01c-.41-.501-.63-.871-.61-1.161l-.111.2c-.13-.21-1.52-1.901-.8-1.511-.13-.12-.31-.2-.5-.55l.14-.17c-.35-.44-.64-1.02-.62-1.2.2.24.32.3.45.33-.88-2.172-.93-.12-1.601-2.202l.15-.02c-.1-.16-.18-.34-.26-.51l.06-.6c-.63-.74-.18-3.102-.09-4.402.07-.54.53-1.1.88-1.981l-.21-.04c.4-.71 2.341-2.872 3.241-2.761.43-.55-.09 0-.18-.14.96-.991 1.26-.7 1.901-.88.7-.401-.6.16-.27-.151 1.2-.3.85-.7 2.421-.85.16.1-.39.14-.52.26 1-.49 3.151-.37 4.562.27 1.63.77 3.461 3.011 3.531 5.132l.08.02c-.04.85.13 1.821-.17 2.711l.2-.42M9.54 13.236l-.05.28c.26.35.47.73.8 1.01-.24-.47-.42-.66-.75-1.3m.62-.02c-.14-.15-.22-.34-.31-.52.08.32.26.6.43.88l-.12-.36m10.945-2.382l-.07.15c-.1.76-.34 1.511-.69 2.212.4-.73.65-1.541.75-2.362M12.45.12c.27-.1.66-.05.95-.12-.37.03-.74.05-1.1.1l.15.02M3.006 5.142c.07.57-.43.8.11.42.3-.66-.11-.18-.1-.42m-.64 2.661c.12-.39.15-.62.2-.84-.35.44-.17.53-.2.83" />
            </svg>
        );
    }
    if (family.includes("Ubuntu")) {
        return (
            <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#E95420]`} xmlns="http://www.w3.org/2000/svg">
                <path d="M17.61.455a3.41 3.41 0 0 0-3.41 3.41 3.41 3.41 0 0 0 3.41 3.41 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41zM12.92.8C8.923.777 5.137 2.941 3.148 6.451a4.5 4.5 0 0 1 .26-.007 4.92 4.92 0 0 1 2.585.737A8.316 8.316 0 0 1 12.688 3.6 4.944 4.944 0 0 1 13.723.834 11.008 11.008 0 0 0 12.92.8zm9.226 4.994a4.915 4.915 0 0 1-1.918 2.246 8.36 8.36 0 0 1-.273 8.303 4.89 4.89 0 0 1 1.632 2.54 11.156 11.156 0 0 0 .559-13.089zM3.41 7.932A3.41 3.41 0 0 0 0 11.342a3.41 3.41 0 0 0 3.41 3.409 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41zm2.027 7.866a4.908 4.908 0 0 1-2.915.358 11.1 11.1 0 0 0 7.991 6.698 11.234 11.234 0 0 0 2.422.249 4.879 4.879 0 0 1-.999-2.85 8.484 8.484 0 0 1-.836-.136 8.304 8.304 0 0 1-5.663-4.32zm11.405.928a3.41 3.41 0 0 0-3.41 3.41 3.41 3.41 0 0 0 3.41 3.41 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41z" />
            </svg>
        );
    }
    if (family.includes("Rocky")) {
        return (
            <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#10B981]`} xmlns="http://www.w3.org/2000/svg">
                <path d="M23.332 15.957c.433-1.239.668-2.57.668-3.957 0-6.627-5.373-12-12-12S0 5.373 0 12c0 3.28 1.315 6.251 3.447 8.417L15.62 8.245l3.005 3.005zm-2.192 3.819l-5.52-5.52L6.975 22.9c1.528.706 3.23 1.1 5.025 1.1 3.661 0 6.94-1.64 9.14-4.224z" />
            </svg>
        );
    }
    if (family.includes("Alma")) {
        return (
            <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#425091]`} xmlns="http://www.w3.org/2000/svg">
                <path d="M23.994 15.133c.079 1.061-.668 1.927-1.69 2.005a1.8 1.8 0 0 1-1.928-1.651c-.078-1.062.63-1.849 1.691-1.967 1.023-.078 1.849.59 1.927 1.613zm-12.623 4.955c-.944 0-1.73.786-1.73 1.809 0 1.14.747 1.848 1.887 1.848.904-.04 1.691-.865 1.691-1.809 0-.983-.904-1.848-1.848-1.848zm1.061-9.675c-.039-.865-.078-1.73.08-2.556.156-.944.314-1.887.904-2.674.707-.983 1.809-.944 2.399.118.314.511.432 1.062.471 1.652 0 .354.158.432.472.393.944-.157 1.888-.157 2.792.197.118.039.236.118.394 0 .314-.276.393-1.652.196-2.006-.354-.63-.904-.55-1.455-.55-.629.039-1.18-.158-1.612-.67-.393-.471-.511-1.06-.59-1.65-.04-.276-.079-.512-.315-.709-.55-.55-1.809-.432-2.477.118-2.556 2.045-2.989 5.467-1.534 8.18.04.118.118.236.275.157zm7.984 3.658c.354-.511.865-.747 1.415-.983a.973.973 0 0 0 .59-.472c.354-.669-.078-1.81-.747-2.36-2.595-2.006-5.938-1.612-8.18.433-.118.078-.157.196-.078.314.786-.236 1.612-.472 2.477-.51.905-.08 1.848-.158 2.753.235 1.14.472 1.337 1.534.472 2.36-.393.393-.905.668-1.455.825-.315.08-.354.236-.236.551.354.865.59 1.77.472 2.753-.04.157-.079.275.078.393.354.236 1.691 0 1.967-.275.511-.472.314-1.023.196-1.534-.157-.63-.078-1.219.276-1.73zm-7.197-2.045c-.118-.079-.197-.118-.315 0 .472.708.905 1.455 1.259 2.241.314.866.668 1.73.55 2.714-.118 1.18-1.1 1.69-2.123 1.101-.511-.275-.905-.669-1.22-1.14-.196-.276-.393-.276-.629-.08-.747.63-1.533 1.102-2.516 1.26-.158 0-.315 0-.394.157-.118.393.472 1.612.826 1.809.59.354 1.062 0 1.534-.276.55-.314 1.101-.432 1.73-.236.59.197.983.63 1.337 1.102.158.196.315.353.63.432.747.197 1.77-.59 2.084-1.376 1.18-3.028-.157-6.135-2.753-7.708zm-2.556 2.438c.472-.669.826-1.416.983-2.202-.157-.04-.197.04-.315.078-.904.944-1.848 1.849-3.067 2.478-.472.236-.983.433-1.534.433-.865 0-1.376-.551-1.298-1.416a2.92 2.92 0 0 1 .787-1.849c.236-.275.236-.432-.04-.668-.786-.55-1.494-1.22-1.848-2.124-.078-.275-.275-.275-.51-.157a4.293 4.293 0 0 0-.434.236c-1.022.63-1.14 1.416-.275 2.28.63.63.944 1.338.708 2.203-.118.433-.354.747-.63 1.101a.95.95 0 0 0-.235.787c.079.747.826 1.494 1.73 1.573 2.517.236 4.562-.63 5.978-2.753zm-4.68-5.152c1.376 1.18 3.067 1.455 4.837 1.377.157 0 .315 0 .354-.118.04-.197-.157-.197-.275-.236-.826-.354-1.691-.63-2.438-1.14S6.848 8.25 6.534 7.266c-.236-.747.078-1.415.825-1.651.669-.236 1.337-.236 1.967 0 .393.157.55.078.629-.354.118-.747.354-1.455.826-2.085.55-.786.55-.865-.354-1.376-.04 0-.04-.04-.079-.04-.865-.471-1.534-.196-1.848.709-.472 1.376-1.377 1.887-2.832 1.612-.196-.04-.393-.079-.472-.079-.747.118-1.18.55-1.297 1.14-.158 1.81.786 3.107 2.084 4.17zm-2.32 3.658c-.079-.944-1.023-1.652-2.045-1.534-.905.079-1.691 1.022-1.613 1.966.08.983 1.023 1.77 1.967 1.652 1.14-.079 1.73-1.18 1.69-2.084zm15.18-8.298c.943-.079 1.73-.983 1.651-1.927-.078-.983-1.022-1.77-2.005-1.691-1.023.079-1.73.983-1.652 1.966s.983 1.73 2.006 1.652zm-12.27-.826c1.062-.157 1.77-1.023 1.652-2.045C8.107.897 7.163.149 6.18.267c-1.062.118-1.691.944-1.573 2.085.118.865 1.061 1.612 1.966 1.494z" />
            </svg>
        );
    }
    if (family.includes("Proxmox")) {
        return (
            <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#E57000]`} xmlns="http://www.w3.org/2000/svg">
                <path d="M4.928 1.825c-1.09.553-1.09.64-.07 1.78 5.655 6.295 7.004 7.782 7.107 7.782.139.017 7.971-8.542 8.058-8.801.034-.07-.208-.312-.519-.536-.415-.312-.864-.433-1.712-.467-1.59-.104-2.144.242-4.115 2.455-.899 1.003-1.66 1.833-1.66 1.833-.017 0-.76-.813-1.642-1.798S8.473 2.1 8.127 1.91c-.796-.45-2.421-.484-3.2-.086zM1.297 4.367C.45 4.695 0 5.007 0 5.248c0 .121 1.331 1.678 2.94 3.459 1.625 1.78 2.939 3.268 2.939 3.302 0 .035-1.331 1.522-2.94 3.303C1.314 17.11.017 18.683.035 18.822c.086.467 1.504 1.055 2.541 1.055 1.678-.018 2.058-.312 5.603-4.202 1.78-1.954 3.233-3.614 3.233-3.666 0-.069-1.435-1.694-3.199-3.63-2.3-2.508-3.423-3.632-3.96-3.874-.812-.398-2.126-.467-2.956-.138zm18.467.12c-.502.26-1.764 1.505-3.943 3.891-1.763 1.937-3.199 3.562-3.199 3.631 0 .07 1.453 1.712 3.234 3.666 3.544 3.89 3.925 4.184 5.602 4.202 1.038 0 2.455-.588 2.542-1.055.017-.156-1.28-1.712-2.905-3.493-1.608-1.78-2.94-3.285-2.94-3.32 0-.034 1.332-1.539 2.94-3.32C22.72 6.91 24.017 5.352 24 5.214c-.087-.45-1.366-.968-2.473-1.038-.795-.034-1.21.035-1.763.312zM7.954 16.973c-2.144 2.369-3.908 4.374-3.943 4.46-.034.07.208.312.52.537.414.311.864.432 1.711.467 1.574.103 2.161-.26 4.15-2.508.864-.968 1.608-1.78 1.625-1.78s.761.812 1.643 1.798c2.023 2.248 2.559 2.576 4.132 2.49.848-.035 1.297-.156 1.712-.467.311-.225.553-.467.519-.536-.087-.26-7.92-8.819-8.058-8.801-.069 0-1.867 1.954-4.011 4.34z" />
            </svg>
        );
    }
    if (family.includes("Disk Wipe")) return <div className="text-gray-500 font-bold text-lg">WIPE</div>;
    return <Disc className="text-primary h-6 w-6" />;
}
