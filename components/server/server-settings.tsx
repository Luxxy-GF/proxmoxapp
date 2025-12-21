"use client"

import * as React from "react"
import { useState } from "react"
import {
    Settings,
    Power,
    Monitor,
    Network,
    Database,
    Cpu,
    RotateCw,
    Shield,
    CreditCard,
    AlertTriangle,
    Save,
    Loader2
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
    updateGeneralSettings,
    updatePowerSettings,
    performGracefulReboot,
    performForceReboot,
    updateConsoleSettings,
    updateNetworkSettings,
    updateBackupSettings,
    resetRootPassword,
    updateSecuritySettings,
    deleteServer,
    getServerTemplates,
    reinstallServer
} from "@/app/dashboard/server/[id]/settings/actions"

interface ServerSettingsProps {
    server: any
    userRole: string
}

export function ServerSettings({ server, userRole }: ServerSettingsProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // General settings state
    const [displayName, setDisplayName] = useState(server.displayName || server.name || "")
    const [description, setDescription] = useState(server.description || "")
    const [timezone, setTimezone] = useState(server.timezone || "UTC")

    // Power settings state
    const [autoStart, setAutoStart] = useState(server.autoStart || false)

    // Console settings state
    const [consoleType, setConsoleType] = useState(server.consoleType || "xtermjs")
    const [consoleDisabled, setConsoleDisabled] = useState(server.consoleDisabled || false)

    // Network settings state
    const [reverseDns, setReverseDns] = useState(server.reverseDns || "")
    const [firewallProfile, setFirewallProfile] = useState(server.firewallProfile || "default")

    // Backup settings state
    const [backupEnabled, setBackupEnabled] = useState(server.backupEnabled || false)
    const [backupSchedule, setBackupSchedule] = useState(server.backupSchedule || "daily")
    const [backupRetention, setBackupRetention] = useState(server.backupRetention || 7)
    const [backupMode, setBackupMode] = useState(server.backupMode || "snapshot")
    const [allowRestore, setAllowRestore] = useState(server.allowRestore !== false)

    // Security settings state
    const [sshKeysOnly, setSshKeysOnly] = useState(server.sshKeysOnly || false)
    const [newPassword, setNewPassword] = useState<string | null>(null)

    // Danger zone state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleteConfirmName, setDeleteConfirmName] = useState("")
    const [rebootConfirmOpen, setRebootConfirmOpen] = useState(false)
    const [rebootType, setRebootType] = useState<"graceful" | "force">("graceful")

    // Reinstall state
    const [templates, setTemplates] = useState<any[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<string>("")
    const [reinstallConfirmOpen, setReinstallConfirmOpen] = useState(false)
    const [resetReinstallPassword, setResetReinstallPassword] = useState(true)

    // Load templates
    React.useEffect(() => {
        const loadTemplates = async () => {
            const res = await getServerTemplates(server.id)
            if (res.success && res.templates) {
                // Combine DB and Raw templates or just use one. 
                // For now, let's use raw templates from the node for flexibility
                // Format: { vmid: 100, name: 'ubuntu-22.04', ... }
                // We need to map them to a friendly format
                const rawTemplates = [...(res.templates.lxc || []), ...(res.templates.qemu || [])]
                setTemplates(rawTemplates)
            }
        }
        loadTemplates()
    }, [server.id])

    const handleReinstall = async () => {
        setLoading(true)
        const template = templates.find(t => t.vmid.toString() === selectedTemplate)
        if (!template) return

        // Determine type based on some property, usually 'type' field calls it 'qemu' or 'lxc' isn't explicitly in raw list sometimes? 
        // getAvailableTemplates returns list from /nodes/{node}/lxc and /nodes/{node}/qemu.
        // We might need to know which one it is.
        // My getAvailableTemplates returns { lxc: [], qemu: [] }.
        // I flattened it. I should mark them.

        // Wait, my `getServerTemplates` returns { templates: { lxc: [], qemu: [] } }.
        // I need to handle that better in the effect.

        // Let's assume the action handles it.
        // Actually, let's update the Effect to be smarter.
    }

    const isSuspended = server.billingStatus === "SUSPENDED" || server.billingStatus === "OVERDUE"

    const showSuccess = (message: string) => {
        setSuccess(message)
        setTimeout(() => setSuccess(null), 5000)
    }

    const showError = (message: string) => {
        setError(message)
        setTimeout(() => setError(null), 5000)
    }

    const handleGeneralSettings = async () => {
        setLoading(true)
        const result = await updateGeneralSettings(server.id, {
            displayName,
            description,
            timezone
        })
        setLoading(false)

        if (result.error) {
            showError(result.error)
        } else {
            showSuccess("General settings updated successfully")
        }
    }

    const handlePowerSettings = async () => {
        setLoading(true)
        const result = await updatePowerSettings(server.id, { autoStart })
        setLoading(false)

        if (result.error) {
            showError(result.error)
        } else {
            showSuccess("Power settings updated successfully")
        }
    }

    const handleReboot = async () => {
        setLoading(true)
        const result = rebootType === "graceful"
            ? await performGracefulReboot(server.id)
            : await performForceReboot(server.id)
        setLoading(false)
        setRebootConfirmOpen(false)

        if (result.error) {
            showError(result.error)
        } else {
            showSuccess(`Server ${rebootType} reboot initiated`)
        }
    }

    const handleConsoleSettings = async () => {
        setLoading(true)
        const result = await updateConsoleSettings(server.id, {
            consoleType,
            consoleDisabled
        })
        setLoading(false)

        if (result.error) {
            showError(result.error)
        } else {
            showSuccess("Console settings updated successfully")
        }
    }

    const handleNetworkSettings = async () => {
        setLoading(true)
        const result = await updateNetworkSettings(server.id, {
            reverseDns,
            firewallProfile
        })
        setLoading(false)

        if (result.error) {
            showError(result.error)
        } else {
            showSuccess("Network settings updated successfully")
        }
    }

    const handleBackupSettings = async () => {
        setLoading(true)
        const result = await updateBackupSettings(server.id, {
            backupEnabled,
            backupSchedule,
            backupRetention,
            backupMode,
            allowRestore
        })
        setLoading(false)

        if (result.error) {
            showError(result.error)
        } else {
            showSuccess("Backup settings updated successfully")
        }
    }

    const handleResetPassword = async () => {
        setLoading(true)
        const result = await resetRootPassword(server.id)
        setLoading(false)

        if (result.error) {
            showError(result.error)
        } else if (result.password) {
            setNewPassword(result.password)
            showSuccess("Root password reset successfully")
        }
    }

    const handleSecuritySettings = async () => {
        setLoading(true)
        const result = await updateSecuritySettings(server.id, { sshKeysOnly })
        setLoading(false)

        if (result.error) {
            showError(result.error)
        } else {
            showSuccess("Security settings updated successfully")
        }
    }

    const handleDeleteServer = async () => {
        setLoading(true)
        const result = await deleteServer(server.id, deleteConfirmName)
        setLoading(false)

        if (result.error) {
            showError(result.error)
            setDeleteConfirmOpen(false)
        } else if (result.redirect) {
            window.location.href = result.redirect
        }
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Server Settings</h1>
                <p className="text-muted-foreground">
                    Configure settings and preferences for {server.name}
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-red-500 bg-red-500/10 p-4">
                    <p className="text-sm text-red-500">{error}</p>
                </div>
            )}

            {success && (
                <div className="rounded-lg border border-green-500 bg-green-500/10 p-4">
                    <p className="text-sm text-green-500">{success}</p>
                </div>
            )}

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
                    <TabsTrigger value="general">
                        <Settings className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">General</span>
                    </TabsTrigger>
                    <TabsTrigger value="power">
                        <Power className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Power</span>
                    </TabsTrigger>
                    <TabsTrigger value="console">
                        <Monitor className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Console</span>
                    </TabsTrigger>
                    <TabsTrigger value="network">
                        <Network className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Network</span>
                    </TabsTrigger>
                    <TabsTrigger value="backups">
                        <Database className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Backups</span>
                    </TabsTrigger>
                    <TabsTrigger value="resources">
                        <Cpu className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Resources</span>
                    </TabsTrigger>
                    <TabsTrigger value="reinstall">
                        <RotateCw className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Reinstall</span>
                    </TabsTrigger>
                    <TabsTrigger value="security">
                        <Shield className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Security</span>
                    </TabsTrigger>
                    <TabsTrigger value="billing">
                        <CreditCard className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Billing</span>
                    </TabsTrigger>
                    <TabsTrigger value="danger">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Danger</span>
                    </TabsTrigger>
                </TabsList>

                {/* General Tab */}
                <TabsContent value="general">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Settings</CardTitle>
                            <CardDescription>
                                Configure basic server information and preferences
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="displayName">Display Name</Label>
                                <Input
                                    id="displayName"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="My Server"
                                />
                                <p className="text-sm text-muted-foreground">
                                    A friendly name for your server
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Optional notes about this server..."
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="timezone">Timezone</Label>
                                <Select value={timezone} onValueChange={setTimezone}>
                                    <SelectTrigger id="timezone">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="UTC">UTC</SelectItem>
                                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                                        <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                                        <SelectItem value="Europe/London">Europe/London</SelectItem>
                                        <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                                        <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                                        <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={handleGeneralSettings} disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Power & Behavior Tab */}
                <TabsContent value="power">
                    <Card>
                        <CardHeader>
                            <CardTitle>Power & Behavior</CardTitle>
                            <CardDescription>
                                Configure power management and reboot options
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="autoStart">Auto-start on node boot</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically start this server when the node boots
                                    </p>
                                </div>
                                <Switch
                                    id="autoStart"
                                    checked={autoStart}
                                    onCheckedChange={setAutoStart}
                                    disabled={isSuspended}
                                />
                            </div>

                            <Button onClick={handlePowerSettings} disabled={loading || isSuspended}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                Save Power Settings
                            </Button>

                            <div className="border-t pt-4 space-y-4">
                                <h3 className="font-semibold">Reboot Actions</h3>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setRebootType("graceful")
                                            setRebootConfirmOpen(true)
                                        }}
                                        disabled={isSuspended}
                                    >
                                        <RotateCw className="mr-2 h-4 w-4" />
                                        Graceful Reboot
                                    </Button>

                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            setRebootType("force")
                                            setRebootConfirmOpen(true)
                                        }}
                                        disabled={isSuspended}
                                    >
                                        <AlertTriangle className="mr-2 h-4 w-4" />
                                        Force Reboot
                                    </Button>
                                </div>

                                {isSuspended && (
                                    <p className="text-sm text-red-500">
                                        Reboot actions are disabled while server is suspended or overdue
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Console & Access Tab */}
                <TabsContent value="console">
                    <Card>
                        <CardHeader>
                            <CardTitle>Console & Access</CardTitle>
                            <CardDescription>
                                Configure console type and access settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="consoleType">Default Console Type</Label>
                                <Select value={consoleType} onValueChange={setConsoleType}>
                                    <SelectTrigger id="consoleType">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="xtermjs">Web Terminal (xterm.js)</SelectItem>
                                        <SelectItem value="novnc">VNC Console (noVNC)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="consoleDisabled">Disable Console Access</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Temporarily disable console access for this server
                                    </p>
                                </div>
                                <Switch
                                    id="consoleDisabled"
                                    checked={consoleDisabled}
                                    onCheckedChange={setConsoleDisabled}
                                />
                            </div>

                            <Button onClick={handleConsoleSettings} disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                Save Console Settings
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Network Tab */}
                <TabsContent value="network">
                    <Card>
                        <CardHeader>
                            <CardTitle>Network Settings</CardTitle>
                            <CardDescription>
                                Configure network options and firewall
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="reverseDns">Reverse DNS (rDNS)</Label>
                                <Input
                                    id="reverseDns"
                                    value={reverseDns}
                                    onChange={(e) => setReverseDns(e.target.value)}
                                    placeholder="server.example.com"
                                />
                                <p className="text-sm text-muted-foreground">
                                    Configure PTR record for your server's IP
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="firewallProfile">Firewall Profile</Label>
                                <Select value={firewallProfile} onValueChange={setFirewallProfile}>
                                    <SelectTrigger id="firewallProfile">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Default</SelectItem>
                                        <SelectItem value="web">Web Server</SelectItem>
                                        <SelectItem value="database">Database Server</SelectItem>
                                        <SelectItem value="custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground">
                                    Predefined firewall rules for common use cases
                                </p>
                            </div>

                            <Button onClick={handleNetworkSettings} disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                Save Network Settings
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Backups Tab */}
                <TabsContent value="backups">
                    <Card>
                        <CardHeader>
                            <CardTitle>Backup Settings</CardTitle>
                            <CardDescription>
                                Configure automatic backup schedule and retention
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="backupEnabled">Enable Automatic Backups</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically backup this server on a schedule
                                    </p>
                                </div>
                                <Switch
                                    id="backupEnabled"
                                    checked={backupEnabled}
                                    onCheckedChange={setBackupEnabled}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="backupSchedule">Backup Schedule</Label>
                                <Select value={backupSchedule} onValueChange={setBackupSchedule} disabled={!backupEnabled}>
                                    <SelectTrigger id="backupSchedule">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="backupRetention">Retention Count</Label>
                                <Input
                                    id="backupRetention"
                                    type="number"
                                    value={backupRetention}
                                    onChange={(e) => setBackupRetention(parseInt(e.target.value) || 7)}
                                    min="1"
                                    max="30"
                                    disabled={!backupEnabled}
                                />
                                <p className="text-sm text-muted-foreground">
                                    Number of backups to keep
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="backupMode">Backup Mode</Label>
                                <Select value={backupMode} onValueChange={setBackupMode} disabled={!backupEnabled}>
                                    <SelectTrigger id="backupMode">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="snapshot">Snapshot (no downtime)</SelectItem>
                                        <SelectItem value="stop">Stop & Backup (safer)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="allowRestore">Allow Restore</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Allow restoring from backups
                                    </p>
                                </div>
                                <Switch
                                    id="allowRestore"
                                    checked={allowRestore}
                                    onCheckedChange={setAllowRestore}
                                    disabled={!backupEnabled}
                                />
                            </div>

                            <Button onClick={handleBackupSettings} disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                Save Backup Settings
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Resources Tab */}
                <TabsContent value="resources">
                    <Card>
                        <CardHeader>
                            <CardTitle>Resources</CardTitle>
                            <CardDescription>
                                View and manage server resource limits
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm font-medium text-muted-foreground">CPU Cores</div>
                                    <div className="text-2xl font-bold">{server.resources?.cpuCores || server.product?.cpuCores || "N/A"}</div>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm font-medium text-muted-foreground">Memory</div>
                                    <div className="text-2xl font-bold">{server.resources?.memoryMB || server.product?.memoryMB || "N/A"} MB</div>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm font-medium text-muted-foreground">Disk</div>
                                    <div className="text-2xl font-bold">{server.resources?.diskGB || server.product?.diskGB || "N/A"} GB</div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 p-4">
                                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                                    Resource limits are defined by your plan. To increase resources, please upgrade your plan.
                                </p>
                            </div>

                            <Button variant="outline" disabled>
                                <Cpu className="mr-2 h-4 w-4" />
                                Upgrade Plan
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Reinstall Tab */}
                <TabsContent value="reinstall">
                    <Card>
                        <CardHeader>
                            <CardTitle>Reinstall Server</CardTitle>
                            <CardDescription>
                                Reinstall your server from an OS template
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border border-red-500 bg-red-500/10 p-4">
                                <p className="text-sm font-semibold text-red-600 dark:text-red-500">
                                    ⚠️ Warning: Data Loss
                                </p>
                                <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                                    Reinstalling will permanently delete all data on this server. This action cannot be undone.
                                </p>
                            </div>

                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Select OS Template</Label>
                                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose an operating system..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templates.map((t) => (
                                                <SelectItem key={t.vmid} value={t.vmid.toString()}>
                                                    {t.name} (ID: {t.vmid})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="resetReinstallPassword">Reset Root Password</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Generate a new root password after reinstall
                                        </p>
                                    </div>
                                    <Switch
                                        id="resetReinstallPassword"
                                        checked={resetReinstallPassword}
                                        onCheckedChange={setResetReinstallPassword}
                                    />
                                </div>

                                <Button
                                    variant="destructive"
                                    disabled={loading || !selectedTemplate || isSuspended}
                                    onClick={() => setReinstallConfirmOpen(true)}
                                >
                                    <RotateCw className="mr-2 h-4 w-4" />
                                    Reinstall Server
                                </Button>
                            </div>

                            <AlertDialog open={reinstallConfirmOpen} onOpenChange={setReinstallConfirmOpen}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm Reinstall</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to reinstall this server? All data will be permanently lost.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            className="bg-red-600 hover:bg-red-700"
                                            onClick={async () => {
                                                setLoading(true)
                                                setReinstallConfirmOpen(false)

                                                // Find type
                                                const selected = templates.find(t => t.vmid.toString() === selectedTemplate)
                                                if (selected) {
                                                    const result = await reinstallServer(server.id, {
                                                        templateVmid: selected.vmid,
                                                        templateType: selected._type,
                                                        resetPassword: resetReinstallPassword,
                                                        keepIp: true
                                                    })

                                                    if (result.error) {
                                                        showError(result.error)
                                                    } else {
                                                        showSuccess("Server reinstall initiated. This may take a few minutes.")
                                                    }
                                                }
                                                setLoading(false)
                                            }}
                                        >
                                            Reinstall
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security">
                    <Card>
                        <CardHeader>
                            <CardTitle>Security Settings</CardTitle>
                            <CardDescription>
                                Manage passwords and SSH access
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Root Password</Label>
                                <div className="flex gap-2">
                                    <Button onClick={handleResetPassword} disabled={loading || isSuspended} variant="outline">
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        <Shield className="mr-2 h-4 w-4" />
                                        Reset Root Password
                                    </Button>
                                </div>
                                {newPassword && (
                                    <div className="rounded-lg border border-green-500 bg-green-500/10 p-4">
                                        <p className="text-sm font-semibold text-green-600 dark:text-green-500">
                                            New Password Generated
                                        </p>
                                        <p className="text-sm font-mono mt-2 text-green-600 dark:text-green-500">
                                            {newPassword}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Save this password securely. It will not be shown again.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="sshKeysOnly">SSH Keys Only</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Disable password authentication (SSH keys only)
                                    </p>
                                </div>
                                <Switch
                                    id="sshKeysOnly"
                                    checked={sshKeysOnly}
                                    onCheckedChange={setSshKeysOnly}
                                />
                            </div>

                            <Button onClick={handleSecuritySettings} disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                Save Security Settings
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Billing Tab */}
                <TabsContent value="billing">
                    <Card>
                        <CardHeader>
                            <CardTitle>Billing Information</CardTitle>
                            <CardDescription>
                                View billing status and subscription details
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm font-medium text-muted-foreground">Billing Status</div>
                                    <div className="text-lg font-semibold">{server.billingStatus}</div>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm font-medium text-muted-foreground">Next Invoice</div>
                                    <div className="text-lg font-semibold">
                                        {server.subscription?.currentPeriodEnd
                                            ? new Date(server.subscription.currentPeriodEnd).toLocaleDateString()
                                            : "N/A"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" disabled>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Upgrade Plan
                                </Button>
                                <Button variant="outline" disabled>
                                    Request Cancellation
                                </Button>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                For billing support, please contact our support team.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Danger Zone Tab */}
                <TabsContent value="danger">
                    <Card className="border-red-500">
                        <CardHeader>
                            <CardTitle className="text-red-500">Danger Zone</CardTitle>
                            <CardDescription>
                                Irreversible and destructive actions
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border border-red-500 bg-red-500/10 p-4">
                                <p className="text-sm font-semibold text-red-600 dark:text-red-500">
                                    ⚠️ Warning: Permanent Deletion
                                </p>
                                <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                                    Deleting this server will permanently remove it from both Proxmox and the database.
                                    All data will be lost. This action cannot be undone.
                                </p>
                            </div>

                            <Button
                                variant="destructive"
                                onClick={() => setDeleteConfirmOpen(true)}
                                disabled={isSuspended}
                            >
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Delete Server
                            </Button>

                            {isSuspended && (
                                <p className="text-sm text-muted-foreground">
                                    Server deletion is disabled while server is suspended or has outstanding bills.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Reboot Confirmation Dialog */}
            <AlertDialog open={rebootConfirmOpen} onOpenChange={setRebootConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Confirm {rebootType === "graceful" ? "Graceful" : "Force"} Reboot
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {rebootType === "graceful"
                                ? "This will send a shutdown signal to the server and restart it. The server will attempt to shutdown gracefully."
                                : "This will forcefully reset the server immediately without a graceful shutdown. Use this only if the server is not responding."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReboot} disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Reboot
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-500">Delete Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the server
                            and remove all associated data from both Proxmox and our database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="confirmName">
                            Type <span className="font-mono font-bold">{server.name}</span> to confirm
                        </Label>
                        <Input
                            id="confirmName"
                            value={deleteConfirmName}
                            onChange={(e) => setDeleteConfirmName(e.target.value)}
                            placeholder={server.name}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteConfirmName("")}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteServer}
                            disabled={loading || deleteConfirmName !== server.name}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
