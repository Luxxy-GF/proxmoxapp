"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Save, Power, Network, Server, HardDrive } from "lucide-react";
import { toast } from "sonner";

interface PXESettings {
    id: string;
    interface: string;
    dhcpRangeStart: string;
    dhcpRangeEnd: string;
    subnetMask: string;
    leaseTime: string;
    gateway: string;
    dnsServer: string;
    tftpRoot: string;
    httpBootUrl: string;
    enabled: boolean;
}

interface ServiceStatus {
    active: boolean;
    status: string;
    details: string;
    recentLogs: string;
}

export default function PXESettingsPage() {
    const [settings, setSettings] = useState<PXESettings | null>(null);
    const [status, setStatus] = useState<ServiceStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [restarting, setRestarting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            const [settingsRes, statusRes] = await Promise.all([
                fetch("/api/admin/pxe/settings"),
                fetch("/api/admin/pxe/status")
            ]);

            if (settingsRes.ok) {
                setSettings(await settingsRes.json());
            }
            if (statusRes.ok) {
                setStatus(await statusRes.json());
            }
        } catch (error) {
            toast.error("Failed to fetch PXE settings");
        } finally {
            setLoading(false);
        }
    }

    async function saveSettings() {
        if (!settings) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/pxe/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                toast.success("Settings saved and dnsmasq restarted");
                fetchData();
            } else {
                toast.error("Failed to save settings");
            }
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    }

    async function restartService() {
        setRestarting(true);
        try {
            const res = await fetch("/api/admin/pxe/restart", { method: "POST" });
            const data = await res.json();

            if (data.success) {
                toast.success("dnsmasq restarted successfully");
                fetchData();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error("Failed to restart dnsmasq");
        } finally {
            setRestarting(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">PXE Boot Settings</h1>
                    <p className="text-muted-foreground">Configure DHCP/TFTP server for network booting</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={restartService} disabled={restarting}>
                        <Power className="h-4 w-4 mr-2" />
                        {restarting ? "Restarting..." : "Restart Service"}
                    </Button>
                    <Button onClick={saveSettings} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save Settings"}
                    </Button>
                </div>
            </div>

            {/* Service Status */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Server className="h-5 w-5" />
                            Service Status
                        </CardTitle>
                        <Badge variant={status?.active ? "default" : "destructive"}>
                            {status?.active ? "Running" : "Stopped"}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-32">
                        {status?.details || "No status available"}
                    </pre>
                </CardContent>
            </Card>

            {settings && (
                <>
                    {/* Enable/Disable */}
                    <Card>
                        <CardHeader>
                            <CardTitle>PXE Boot Service</CardTitle>
                            <CardDescription>Enable or disable the PXE boot server</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center space-x-4">
                                <Switch
                                    checked={settings.enabled}
                                    onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                                />
                                <Label>PXE Boot {settings.enabled ? "Enabled" : "Disabled"}</Label>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Network Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Network className="h-5 w-5" />
                                Network Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Network Interface</Label>
                                <Input
                                    value={settings.interface}
                                    onChange={(e) => setSettings({ ...settings, interface: e.target.value })}
                                    placeholder="ens19"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Subnet Mask</Label>
                                <Input
                                    value={settings.subnetMask}
                                    onChange={(e) => setSettings({ ...settings, subnetMask: e.target.value })}
                                    placeholder="255.255.255.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Gateway</Label>
                                <Input
                                    value={settings.gateway}
                                    onChange={(e) => setSettings({ ...settings, gateway: e.target.value })}
                                    placeholder="10.15.0.1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>DNS Server</Label>
                                <Input
                                    value={settings.dnsServer}
                                    onChange={(e) => setSettings({ ...settings, dnsServer: e.target.value })}
                                    placeholder="8.8.8.8"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* DHCP Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle>DHCP Range</CardTitle>
                            <CardDescription>IP address range for PXE clients</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Range Start</Label>
                                <Input
                                    value={settings.dhcpRangeStart}
                                    onChange={(e) => setSettings({ ...settings, dhcpRangeStart: e.target.value })}
                                    placeholder="10.15.0.100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Range End</Label>
                                <Input
                                    value={settings.dhcpRangeEnd}
                                    onChange={(e) => setSettings({ ...settings, dhcpRangeEnd: e.target.value })}
                                    placeholder="10.15.0.200"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Lease Time</Label>
                                <Input
                                    value={settings.leaseTime}
                                    onChange={(e) => setSettings({ ...settings, leaseTime: e.target.value })}
                                    placeholder="24h"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* TFTP/HTTP Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HardDrive className="h-5 w-5" />
                                Boot Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>TFTP Root Directory</Label>
                                <Input
                                    value={settings.tftpRoot}
                                    onChange={(e) => setSettings({ ...settings, tftpRoot: e.target.value })}
                                    placeholder="/srv/tftp"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>HTTP Boot URL</Label>
                                <Input
                                    value={settings.httpBootUrl}
                                    onChange={(e) => setSettings({ ...settings, httpBootUrl: e.target.value })}
                                    placeholder="http://10.15.0.1:3000/api/pxe/ipxe"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Logs */}
                    {status?.recentLogs && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Logs</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-48 whitespace-pre-wrap">
                                    {status.recentLogs}
                                </pre>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
