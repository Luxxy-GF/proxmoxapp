
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { RefreshCw, Server } from "lucide-react";

interface DedicatedServer {
    id: string;
    hostname: string;
    macAddress: string;
    status: string;
    createdAt: string;
}

export default function DedicatedPage() {
    const [servers, setServers] = useState<DedicatedServer[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchServers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/baremetal/servers");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setServers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServers();
    }, []);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dedicated Servers</h1>
                    <p className="text-muted-foreground">Manage your bare-metal infrastructure.</p>
                </div>
                <Button variant="outline" size="icon" onClick={fetchServers}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Hostname</TableHead>
                            <TableHead>IP / MAC</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Manage</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {servers.map((server) => (
                            <TableRow key={server.id}>
                                <TableCell className="font-medium flex items-center">
                                    <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                                    {server.hostname}
                                </TableCell>
                                <TableCell className="text-sm">
                                    <div className="font-mono text-muted-foreground">{server.macAddress}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={
                                        server.status === 'ACTIVE' ? 'default' :
                                            server.status === 'INSTALLING' ? 'secondary' : 'destructive'
                                    }>{server.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/dashboard/dedicated/${server.id}`}>
                                        <Button variant="ghost" size="sm">Dashboard</Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!loading && servers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                    You don't have any dedicated servers.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
