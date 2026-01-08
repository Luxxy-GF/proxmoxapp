"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, AlertTriangle } from "lucide-react";

interface PXEProfile {
    id: string;
    name: string;
    templateType: string;
    osFamily: string;
    tags: string[];
    enabled: boolean;
    language: string | null;
    timezone: string | null;
    releaseVersion: string | null;
    mirrorUrl: string | null;
    httpDirectory: string | null;
    driversUrl: string | null;
    localCacheDir: string | null;
    cachingPolicy: string;
    enableComboot: boolean;
    ipxeBiosFile: string | null;
    ipxeEfiFile: string | null;
    dhcpKeepAliveMinutes: number;
    networkMode: string;
    ipv4Behavior: string;
    ipv6Behavior: string;
    allowDifferentGateway: boolean;
    requireServerTags: string[];
    excludeServerTags: string[];
    requireUserRoles: string[];
    excludeUserRoles: string[];
    serverTargetType: string;
    completionEvent: string;
    defaultDiskLayoutId: string | null;
    fallbackToDefault: boolean;
    forceDiskLayout: boolean;
    postInstallScriptIds: string[];
    firstBootScriptIds: string[];
    enforceScripts: boolean;
    hideOtherScripts: boolean;
    allowSetHostname: boolean;
    allowSshKeyInjection: boolean;
    allowSetRootPassword: boolean;
    updateInventoryAfter: boolean;
    bootScriptTemplate: string | null;
    installTemplate: string | null;
    diskLayoutTemplate: string | null;
    defaultPackages: string | null;
    customScripts: string | null;
    isDestructive: boolean;
}

const defaultProfile: Partial<PXEProfile> = {
    name: "",
    templateType: "PRESEED",
    osFamily: "DEBIAN",
    tags: [],
    enabled: true,
    cachingPolicy: "SMART",
    enableComboot: false,
    dhcpKeepAliveMinutes: 5,
    networkMode: "AUTO",
    ipv4Behavior: "allow",
    ipv6Behavior: "allow",
    allowDifferentGateway: false,
    requireServerTags: [],
    excludeServerTags: [],
    requireUserRoles: [],
    excludeUserRoles: [],
    serverTargetType: "BOTH",
    completionEvent: "AFTER_PXE",
    fallbackToDefault: true,
    forceDiskLayout: false,
    postInstallScriptIds: [],
    firstBootScriptIds: [],
    enforceScripts: false,
    hideOtherScripts: false,
    allowSetHostname: true,
    allowSshKeyInjection: true,
    allowSetRootPassword: true,
    updateInventoryAfter: true,
    isDestructive: false,
};

export default function PXEProfileEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const isNew = id === "new";

    const [profile, setProfile] = useState<Partial<PXEProfile>>(defaultProfile);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [tagsInput, setTagsInput] = useState("");

    useEffect(() => {
        if (!isNew) {
            fetch(`/api/admin/pxe/profiles/${id}`)
                .then((res) => res.json())
                .then((data) => {
                    setProfile(data);
                    setTagsInput(data.tags?.join(", ") || "");
                })
                .finally(() => setLoading(false));
        }
    }, [id, isNew]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
            const payload = { ...profile, tags };

            const url = isNew ? "/api/admin/pxe/profiles" : `/api/admin/pxe/profiles/${id}`;
            const method = isNew ? "POST" : "PATCH";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                router.push("/dashboard/admin/pxe");
            }
        } finally {
            setSaving(false);
        }
    };

    const updateField = <K extends keyof PXEProfile>(key: K, value: PXEProfile[K]) => {
        setProfile((prev) => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/admin/pxe")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">
                            {isNew ? "New PXE Profile" : `Edit: ${profile.name}`}
                        </h1>
                        <p className="text-muted-foreground">Configure PXE boot profile settings</p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save Profile"}
                </Button>
            </div>

            {/* Section 1: Basic Details */}
            <Card>
                <CardHeader>
                    <CardTitle>Basic Details</CardTitle>
                    <CardDescription>Profile identification and status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">OS Name</Label>
                            <Input
                                id="name"
                                value={profile.name || ""}
                                onChange={(e) => updateField("name", e.target.value)}
                                placeholder="e.g., Debian 13 (Trixie)"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="templateType">Template Type</Label>
                            <Select value={profile.templateType} onValueChange={(v) => updateField("templateType", v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="KICKSTART">Kickstart</SelectItem>
                                    <SelectItem value="PRESEED">Preseed</SelectItem>
                                    <SelectItem value="WINDOWS">Windows</SelectItem>
                                    <SelectItem value="RESCUE">Rescue System</SelectItem>
                                    <SelectItem value="UTILITY">Utility</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="osFamily">OS Family</Label>
                            <Select value={profile.osFamily} onValueChange={(v) => updateField("osFamily", v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DEBIAN">Debian</SelectItem>
                                    <SelectItem value="UBUNTU">Ubuntu</SelectItem>
                                    <SelectItem value="ALMALINUX">AlmaLinux</SelectItem>
                                    <SelectItem value="ROCKY">Rocky Linux</SelectItem>
                                    <SelectItem value="WINDOWS">Windows</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tags">Tags (comma-separated)</Label>
                            <Input
                                id="tags"
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                                placeholder="e.g., stable, lts, production"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label>Enabled</Label>
                            <p className="text-sm text-muted-foreground">Profile is available for use</p>
                        </div>
                        <Switch
                            checked={profile.enabled}
                            onCheckedChange={(v) => updateField("enabled", v)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Section 2: Installation Metadata */}
            <Card>
                <CardHeader>
                    <CardTitle>Installation Metadata</CardTitle>
                    <CardDescription>Localization and package sources</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="language">Language</Label>
                            <Input
                                id="language"
                                value={profile.language || ""}
                                onChange={(e) => updateField("language", e.target.value)}
                                placeholder="en_US"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="timezone">Timezone</Label>
                            <Input
                                id="timezone"
                                value={profile.timezone || ""}
                                onChange={(e) => updateField("timezone", e.target.value)}
                                placeholder="UTC"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="releaseVersion">Release Version</Label>
                            <Input
                                id="releaseVersion"
                                value={profile.releaseVersion || ""}
                                onChange={(e) => updateField("releaseVersion", e.target.value)}
                                placeholder="22.04"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="mirrorUrl">Mirror URL</Label>
                            <Input
                                id="mirrorUrl"
                                value={profile.mirrorUrl || ""}
                                onChange={(e) => updateField("mirrorUrl", e.target.value)}
                                placeholder="http://deb.debian.org/debian"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="httpDirectory">HTTP Directory (Preseed)</Label>
                            <Input
                                id="httpDirectory"
                                value={profile.httpDirectory || ""}
                                onChange={(e) => updateField("httpDirectory", e.target.value)}
                                placeholder="/srv/preseed"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="cachingPolicy">Caching Policy</Label>
                            <Select value={profile.cachingPolicy} onValueChange={(v) => updateField("cachingPolicy", v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SMART">Smart caching</SelectItem>
                                    <SelectItem value="DELETE_DAILY">Delete files daily</SelectItem>
                                    <SelectItem value="CLEAR_BEFORE_INSTALL">Clear before installation</SelectItem>
                                    <SelectItem value="KEEP_LONG">Keep files as long as possible</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="driversUrl">Additional Drivers URL</Label>
                            <Input
                                id="driversUrl"
                                value={profile.driversUrl || ""}
                                onChange={(e) => updateField("driversUrl", e.target.value)}
                                placeholder="http://example.com/drivers"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Section 3: PXE Boot Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>PXE Boot Configuration</CardTitle>
                    <CardDescription>iPXE and COMBOOT settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label>Enable COMBOOT</Label>
                            <p className="text-sm text-muted-foreground">Use legacy COMBOOT chain loading</p>
                        </div>
                        <Switch
                            checked={profile.enableComboot}
                            onCheckedChange={(v) => updateField("enableComboot", v)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="ipxeBiosFile">iPXE BIOS File</Label>
                            <Input
                                id="ipxeBiosFile"
                                value={profile.ipxeBiosFile || ""}
                                onChange={(e) => updateField("ipxeBiosFile", e.target.value)}
                                placeholder="Default: undionly.kpxe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ipxeEfiFile">iPXE EFI File</Label>
                            <Input
                                id="ipxeEfiFile"
                                value={profile.ipxeEfiFile || ""}
                                onChange={(e) => updateField("ipxeEfiFile", e.target.value)}
                                placeholder="Default: ipxe.efi"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dhcpKeepAlive">DHCP Keep-Alive (minutes)</Label>
                        <Input
                            id="dhcpKeepAlive"
                            type="number"
                            value={profile.dhcpKeepAliveMinutes || 5}
                            onChange={(e) => updateField("dhcpKeepAliveMinutes", parseInt(e.target.value))}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Section 4: Network Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Network Configuration</CardTitle>
                    <CardDescription>IP addressing and routing behavior</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Network Mode</Label>
                            <Select value={profile.networkMode} onValueChange={(v) => updateField("networkMode", v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AUTO">Auto</SelectItem>
                                    <SelectItem value="STATIC">Static</SelectItem>
                                    <SelectItem value="DHCP">DHCP</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>IPv4 Behavior</Label>
                            <Select value={profile.ipv4Behavior} onValueChange={(v) => updateField("ipv4Behavior", v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="allow">Allow</SelectItem>
                                    <SelectItem value="force">Force</SelectItem>
                                    <SelectItem value="disable">Disable</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>IPv6 Behavior</Label>
                            <Select value={profile.ipv6Behavior} onValueChange={(v) => updateField("ipv6Behavior", v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="allow">Allow</SelectItem>
                                    <SelectItem value="force">Force</SelectItem>
                                    <SelectItem value="disable">Disable</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                <Label>Allow Different Gateway IPs</Label>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Allows gateway addresses that differ from server subnet. Use with caution.
                            </p>
                        </div>
                        <Switch
                            checked={profile.allowDifferentGateway}
                            onCheckedChange={(v) => updateField("allowDifferentGateway", v)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Section 5: Offering Rules */}
            <Card>
                <CardHeader>
                    <CardTitle>Offering Rules</CardTitle>
                    <CardDescription>Controls which servers and users can see this profile</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Server Target Type</Label>
                        <Select value={profile.serverTargetType} onValueChange={(v) => updateField("serverTargetType", v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DEDICATED">Dedicated Only</SelectItem>
                                <SelectItem value="VIRTUAL">Virtual Only</SelectItem>
                                <SelectItem value="BOTH">Both</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Separator />
                    <p className="text-sm text-muted-foreground">
                        Tag and role filtering is configured via comma-separated values. Leave empty for no restrictions.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Only Offer If Server Has Tags</Label>
                            <Input placeholder="tag1, tag2" disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Do Not Offer If Server Has Tags</Label>
                            <Input placeholder="tag1, tag2" disabled />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Section 6: Completion Logic */}
            <Card>
                <CardHeader>
                    <CardTitle>Completion Logic</CardTitle>
                    <CardDescription>When should the installation be marked as complete?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Completion Event</Label>
                        <Select value={profile.completionEvent} onValueChange={(v) => updateField("completionEvent", v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AFTER_PXE">After PXE steps complete</SelectItem>
                                <SelectItem value="AFTER_FIRST_BOOT_BEFORE_SCRIPTS">After first OS boot (before scripts)</SelectItem>
                                <SelectItem value="AFTER_FIRST_BOOT_AFTER_SCRIPTS">After first OS boot (after scripts)</SelectItem>
                                <SelectItem value="AFTER_FIRST_PXE_ACCESS">After first PXE file access</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                        <p><Badge variant="outline">AFTER_PXE</Badge> — Marks complete when PXE boot finishes, before OS installs</p>
                        <p><Badge variant="outline">AFTER_FIRST_BOOT_BEFORE_SCRIPTS</Badge> — Marks complete after OS boots, before post-install scripts run</p>
                        <p><Badge variant="outline">AFTER_FIRST_BOOT_AFTER_SCRIPTS</Badge> — Marks complete after all post-install scripts finish</p>
                        <p><Badge variant="outline">AFTER_FIRST_PXE_ACCESS</Badge> — Marks complete on first PXE file request</p>
                    </div>
                </CardContent>
            </Card>

            {/* Section 7: Disk Layout */}
            <Card>
                <CardHeader>
                    <CardTitle>Disk Layout Integration</CardTitle>
                    <CardDescription>Configure default and forced disk layouts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Default Disk Layout</Label>
                        <Select value={profile.defaultDiskLayoutId || "none"} onValueChange={(v) => updateField("defaultDiskLayoutId", v === "none" ? null : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label>Fallback to Default</Label>
                            <p className="text-sm text-muted-foreground">Use default layout if user doesn&apos;t select one</p>
                        </div>
                        <Switch
                            checked={profile.fallbackToDefault}
                            onCheckedChange={(v) => updateField("fallbackToDefault", v)}
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label>Force Disk Layout</Label>
                            <p className="text-sm text-muted-foreground">Hide disk selection from users, always use default</p>
                        </div>
                        <Switch
                            checked={profile.forceDiskLayout}
                            onCheckedChange={(v) => updateField("forceDiskLayout", v)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Section 8: Script Execution */}
            <Card>
                <CardHeader>
                    <CardTitle>Script Execution</CardTitle>
                    <CardDescription>Post-installation and first-boot scripts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label>Enforce Script Execution</Label>
                            <p className="text-sm text-muted-foreground">Users cannot skip or modify scripts</p>
                        </div>
                        <Switch
                            checked={profile.enforceScripts}
                            onCheckedChange={(v) => updateField("enforceScripts", v)}
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label>Hide Other Scripts</Label>
                            <p className="text-sm text-muted-foreground">Only show scripts assigned to this profile</p>
                        </div>
                        <Switch
                            checked={profile.hideOtherScripts}
                            onCheckedChange={(v) => updateField("hideOtherScripts", v)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Section 9: Feature Permissions */}
            <Card>
                <CardHeader>
                    <CardTitle>Feature Permissions</CardTitle>
                    <CardDescription>Controls what users can configure during reinstallation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <Label>Allow Set Hostname</Label>
                            <Switch
                                checked={profile.allowSetHostname}
                                onCheckedChange={(v) => updateField("allowSetHostname", v)}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <Label>Allow SSH Key Injection</Label>
                            <Switch
                                checked={profile.allowSshKeyInjection}
                                onCheckedChange={(v) => updateField("allowSshKeyInjection", v)}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <Label>Allow Set Root Password</Label>
                            <Switch
                                checked={profile.allowSetRootPassword}
                                onCheckedChange={(v) => updateField("allowSetRootPassword", v)}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <Label>Update Hardware Inventory</Label>
                            <Switch
                                checked={profile.updateInventoryAfter}
                                onCheckedChange={(v) => updateField("updateInventoryAfter", v)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Section 10: Profile Content */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile Content</CardTitle>
                    <CardDescription>Technical templates and scripts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="bootScriptTemplate">iPXE Boot Script</Label>
                        <Textarea
                            id="bootScriptTemplate"
                            value={profile.bootScriptTemplate || ""}
                            onChange={(e) => updateField("bootScriptTemplate", e.target.value)}
                            placeholder="#!ipxe\nkernel http://...\ninitrd http://...\nboot"
                            className="font-mono text-sm min-h-[200px]"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="installTemplate">Installation Template (Preseed/Kickstart)</Label>
                        <Textarea
                            id="installTemplate"
                            value={profile.installTemplate || ""}
                            onChange={(e) => updateField("installTemplate", e.target.value)}
                            placeholder="d-i debian-installer/locale string en_US..."
                            className="font-mono text-sm min-h-[200px]"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="defaultPackages">Default Packages</Label>
                        <Textarea
                            id="defaultPackages"
                            value={profile.defaultPackages || ""}
                            onChange={(e) => updateField("defaultPackages", e.target.value)}
                            placeholder="vim htop curl wget..."
                            className="font-mono text-sm min-h-[100px]"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="diskLayoutTemplate">Disk Layout Template (Preseed Partitioning)</Label>
                        <Textarea
                            id="diskLayoutTemplate"
                            value={profile.diskLayoutTemplate || ""}
                            onChange={(e) => updateField("diskLayoutTemplate", e.target.value)}
                            placeholder="d-i partman-auto/method string lvm..."
                            className="font-mono text-sm min-h-[200px]"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="customScripts">First-Boot Script</Label>
                        <Textarea
                            id="customScripts"
                            value={profile.customScripts || ""}
                            onChange={(e) => updateField("customScripts", e.target.value)}
                            placeholder="#!/bin/bash\n# Post-install commands..."
                            className="font-mono text-sm min-h-[200px]"
                        />
                    </div>

                    {profile.templateType === "UTILITY" && (
                        <div className="flex items-center justify-between rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                    <Label>Destructive Operation</Label>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Mark this as a destructive utility (e.g., disk wipe). Shows additional warnings.
                                </p>
                            </div>
                            <Switch
                                checked={profile.isDestructive}
                                onCheckedChange={(v) => updateField("isDestructive", v)}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Footer Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} size="lg">
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save Profile"}
                </Button>
            </div>
        </div>
    );
}
