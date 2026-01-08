"use client";

import { useMemo, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, RefreshCw, Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface InventoryPaneProps {
    server: any;
    onScan: () => Promise<void>;
    isAdmin?: boolean;
}

interface InventoryItem {
    id: string;
    component: string;
    model: string;
    value: string;
    serial: string;
}

export function InventoryPane({ server, onScan, isAdmin = false }: InventoryPaneProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);

    // Normalize Hardware Data - Comprehensive Component Expansion
    const inventory = useMemo(() => {
        const items: InventoryItem[] = [];
        const hw = server.hardware;

        if (!hw) return items;

        // Mainboard/Baseboard
        if (hw.mainboardModel) {
            items.push({
                id: 'mainboard-1',
                component: "Mainboard Model",
                model: hw.mainboardModel,
                value: hw.model || "—",
                serial: hw.mainboardSerial || "—",
            });
        } else if (hw.vendor || hw.model) {
            // Fallback System Info
            items.push({
                id: 'sys-1',
                component: "System",
                model: `${hw.vendor || ''} ${hw.model || 'Unknown Model'}`.trim(),
                value: "Chassis",
                serial: hw.serial || "—",
            });
        }

        // BIOS
        if (hw.biosVendor || hw.biosVersion) {
            items.push({
                id: 'bios-1',
                component: "BIOS",
                model: hw.biosVendor || "Unknown",
                value: hw.biosVersion || "Unknown",
                serial: hw.biosDate || "—",
            });
        }

        // Individual RAM Modules (Array of modules)
        if (Array.isArray(hw.ramModulesJson) && hw.ramModulesJson.length > 0) {
            hw.ramModulesJson.forEach((module: any, idx: number) => {
                if (module.model || module.size) {
                    items.push({
                        id: `ram-${idx}`,
                        component: "RAM",
                        model: module.model || "Unknown Module",
                        value: module.size || "Unknown Size",
                        serial: module.serial || "—",
                    });
                }
            });
        } else if (hw.ramMiB) {
            // Fallback to total RAM if detailed modules not available
            items.push({
                id: 'mem-1',
                component: "RAM",
                model: "System Memory",
                value: `${Math.round(hw.ramMiB / 1024)} GB Total`,
                serial: "—",
            });
        }

        // Storage Controllers
        if (Array.isArray(hw.storageControllersJson)) {
            hw.storageControllersJson.forEach((ctrl: any, idx: number) => {
                items.push({
                    id: `storage-ctrl-${idx}`,
                    component: "Storage Controller",
                    model: ctrl.model || "Unknown Controller",
                    value: ctrl.vendor || "—",
                    serial: "—",
                });
            });
        }

        // NICs - Network adapters with MAC addresses
        if (Array.isArray(hw.nicsJson) && hw.nicsJson.length > 0) {
            hw.nicsJson.forEach((nic: any, idx: number) => {
                items.push({
                    id: `nic-${idx}`,
                    component: "NIC",
                    model: nic.model || nic.product || "Network Adapter",
                    value: nic.vendor || nic.mac || "—",
                    serial: nic.mac || "—",
                });
            });
        }

        // CPU Model
        if (hw.cpuModel) {
            items.push({
                id: 'cpu-1',
                component: "CPU Model",
                model: hw.cpuModel,
                value: hw.cpuSpeed || (hw.cpuCores ? `${hw.cpuCores} Cores` : "—"),
                serial: "—",
            });
        }

        // Disks - Physical storage devices with serial numbers
        if (Array.isArray(hw.disksJson)) {
            hw.disksJson.forEach((d: any, idx: number) => {
                // Skip loopbacks and ramdisks
                if (d.name?.startsWith('loop') || d.name?.startsWith('ram') || d.name?.startsWith('sr')) return;

                items.push({
                    id: `disk-${idx}`,
                    component: "Disk",
                    model: d.model || "Unknown Disk",
                    value: d.size || "Unknown Size",
                    serial: d.serial || "—",
                });
            });
        }

        return items;
    }, [server.hardware]);

    const filteredInventory = inventory.filter(item =>
        item.component.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serial.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleScan = async () => {
        setLoading(true);
        try {
            await onScan();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold tracking-tight">Server Inventory</h2>
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search components..."
                            className="pl-9 h-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <>
                            <Button variant="outline" size="sm" onClick={handleScan} disabled={loading || server.status === 'INVENTORYING'}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${loading || server.status === 'INVENTORYING' ? 'animate-spin' : ''}`} />
                                Rediscover Hardware
                            </Button>
                            <Button size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                New Entry
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Main Inventory Table */}
            <Card className="bg-card border-border/50 shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-border/50">
                                <TableHead className="w-[200px]">Component</TableHead>
                                <TableHead className="min-w-[300px]">Model</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead>Serial</TableHead>
                                {isAdmin && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredInventory.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={isAdmin ? 5 : 4} className="h-24 text-center">
                                        {inventory.length === 0 ? "No hardware inventory available." : "No components match your search."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInventory.map((item) => (
                                    <TableRow key={item.id} className="group border-border/50 hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium text-foreground">{item.component}</TableCell>
                                        <TableCell>{item.model}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.value}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {item.serial !== "—" ? (
                                                <span className="select-all cursor-pointer hover:text-foreground" onClick={() => {
                                                    navigator.clipboard.writeText(item.serial);
                                                    toast.success("Serial copied");
                                                }}>
                                                    {item.serial}
                                                </span>
                                            ) : "—"}
                                        </TableCell>
                                        {isAdmin && (
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/10 hover:text-red-500">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
