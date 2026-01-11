"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, RefreshCw, Server, Network, Wifi, Settings2 } from "lucide-react";
import Link from "next/link";

interface IPPool {
    id: string;
    name: string;
    startIP: string;
    endIP: string;
    gateway: string;
    netmask: string;
    dns: string | null;
    enabled: boolean;
    dedicatedNode?: {
        id: string;
        name: string;
        status: string;
    } | null;
}

interface DedicatedNode {
    id: string;
    name: string;
    address: string;
    port: number;
    status: string;
}

interface DhcpHost {
    mac: string;
    ip: string;
    hostname: string;
    serverId: string;
    serverHostname: string;
    nodeName: string;
}

export default function DhcpManagementPage() {
    const [pools, setPools] = useState<IPPool[]>([]);
    const [nodes, setNodes] = useState<DedicatedNode[]>([]);
    const [hosts, setHosts] = useState<DhcpHost[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch IP Pools with their assigned dedicated nodes
            const poolsRes = await fetch("/api/admin/ip-pools");
            if (poolsRes.ok) {
                const poolsData = await poolsRes.json();
                setPools(poolsData);
            }

            // Fetch Dedicated Nodes
            const nodesRes = await fetch("/api/baremetal/nodes");
            if (nodesRes.ok) {
                const nodesData = await nodesRes.json();
                setNodes(nodesData);
            }

            // Fetch Dedicated Servers to build hosts list
            const serversRes = await fetch("/api/baremetal/servers");
            if (serversRes.ok) {
                const serversData = await serversRes.json();
                const hostsList: DhcpHost[] = serversData
                    .filter((s: any) => s.dedicatedNodeId && s.macAddress)
                    .map((s: any) => ({
                        mac: s.macAddress,
                        ip: s.primaryIpv4 || "DHCP",
                        hostname: s.hostname,
                        serverId: s.id,
                        serverHostname: s.hostname,
                        nodeName: s.dedicatedNode?.name || "Unknown"
                    }));
                setHosts(hostsList);
            }
        } catch (error) {
            toast.error("Failed to load DHCP data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Group pools by dedicated node
    const poolsByNode = nodes.map(node => ({
        node,
        pools: pools.filter(p => p.dedicatedNode?.id === node.id)
    }));

    // Hosts by node
    const hostsByNode = nodes.map(node => ({
        node,
        hosts: hosts.filter(h => h.nodeName === node.name)
    }));

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">DHCP Management</h1>
                    <p className="text-muted-foreground">
                        Manage DHCP subnets and static reservations synced to Agent nodes
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchData}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Link href="/dashboard/admin/networking">
                        <Button variant="outline">
                            <Network className="h-4 w-4 mr-2" /> IP Pools
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">
                        <Wifi className="h-4 w-4 mr-2" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="subnets">
                        <Network className="h-4 w-4 mr-2" /> Subnets
                    </TabsTrigger>
                    <TabsTrigger value="hosts">
                        <Server className="h-4 w-4 mr-2" /> Static Hosts
                    </TabsTrigger>
                    <TabsTrigger value="config">
                        <Settings2 className="h-4 w-4 mr-2" /> Config Preview
                    </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Active Nodes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {nodes.filter(n => n.status === 'ONLINE').length} / {nodes.length}
                                </div>
                                <p className="text-xs text-muted-foreground">Agents running DHCP</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">IP Subnets</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{pools.filter(p => p.enabled).length}</div>
                                <p className="text-xs text-muted-foreground">Enabled DHCP ranges</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Static Hosts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{hosts.length}</div>
                                <p className="text-xs text-muted-foreground">MAC-to-IP reservations</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Agent Status Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {nodes.map(node => (
                            <Card key={node.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg">{node.name}</CardTitle>
                                        <Badge variant={node.status === 'ONLINE' ? 'default' : 'destructive'}>
                                            {node.status}
                                        </Badge>
                                    </div>
                                    <CardDescription>{node.address}:{node.port}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Subnets:</span>
                                            <span>{pools.filter(p => p.dedicatedNode?.id === node.id).length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Hosts:</span>
                                            <span>{hosts.filter(h => h.nodeName === node.name).length}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Subnets Tab */}
                <TabsContent value="subnets">
                    <Card>
                        <CardHeader>
                            <CardTitle>DHCP Subnets</CardTitle>
                            <CardDescription>
                                IP pools assigned to dedicated nodes are synced as DHCP ranges
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Range</TableHead>
                                        <TableHead>Gateway</TableHead>
                                        <TableHead>DNS</TableHead>
                                        <TableHead>Agent Node</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pools.map(pool => (
                                        <TableRow key={pool.id}>
                                            <TableCell className="font-medium">{pool.name}</TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {pool.startIP} - {pool.endIP}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">{pool.gateway}</TableCell>
                                            <TableCell className="font-mono text-sm">{pool.dns || "8.8.8.8"}</TableCell>
                                            <TableCell>
                                                {pool.dedicatedNode ? (
                                                    <div className="flex items-center gap-2">
                                                        <Server className="h-4 w-4" />
                                                        {pool.dedicatedNode.name}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground italic">Not assigned</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={pool.enabled ? "default" : "secondary"}>
                                                    {pool.enabled ? "Enabled" : "Disabled"}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {pools.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                                No IP pools configured. <Link href="/dashboard/admin/networking" className="underline">Add one</Link>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Static Hosts Tab */}
                <TabsContent value="hosts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Static DHCP Reservations</CardTitle>
                            <CardDescription>
                                Servers with MAC addresses are automatically reserved in DHCP
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Hostname</TableHead>
                                        <TableHead>MAC Address</TableHead>
                                        <TableHead>IP Address</TableHead>
                                        <TableHead>Agent Node</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {hosts.map(host => (
                                        <TableRow key={host.mac}>
                                            <TableCell className="font-medium">{host.hostname}</TableCell>
                                            <TableCell className="font-mono text-sm">{host.mac}</TableCell>
                                            <TableCell className="font-mono text-sm">{host.ip}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Server className="h-4 w-4" />
                                                    {host.nodeName}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {hosts.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                                No servers assigned to agent nodes
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Config Preview Tab */}
                <TabsContent value="config">
                    <Card>
                        <CardHeader>
                            <CardTitle>Generated dnsmasq Config</CardTitle>
                            <CardDescription>
                                Preview of the configuration that would be synced to each Agent
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {nodes.map(node => {
                                const nodePools = pools.filter(p => p.dedicatedNode?.id === node.id && p.enabled);
                                const nodeHosts = hosts.filter(h => h.nodeName === node.name);

                                return (
                                    <div key={node.id} className="mb-6">
                                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                            <Server className="h-5 w-5" />
                                            {node.name}
                                            <Badge variant={node.status === 'ONLINE' ? 'default' : 'secondary'} className="ml-2">
                                                {node.status}
                                            </Badge>
                                        </h3>
                                        <pre className="bg-muted p-4 rounded-md text-sm font-mono overflow-x-auto">
                                            {`# Auto-generated by Agent. Do not edit manually.

${nodePools.map(pool => `# Subnet: ${pool.name}
dhcp-range=${pool.startIP},${pool.endIP},${pool.netmask},12h
dhcp-option=option:router,${pool.gateway}
dhcp-option=option:dns-server,${pool.dns || '8.8.8.8'}
`).join('\n')}
# Static Reservations
${nodeHosts.map(h => `dhcp-host=${h.mac.toLowerCase()},${h.ip},${h.hostname}`).join('\n')}

# PXE Boot Options
enable-tftp
tftp-root=/srv/tftp

dhcp-match=set:ipxe,175
dhcp-userclass=set:ipxe,iPXE

dhcp-option=option:server-ip-address,${node.address}

dhcp-boot=tag:!ipxe,undionly.kpxe
dhcp-boot=tag:!ipxe,tag:efi64,ipxe.efi

dhcp-boot=tag:ipxe,http://${node.address}:${node.port}/pxe/boot`}
                                        </pre>
                                    </div>
                                );
                            })}
                            {nodes.length === 0 && (
                                <p className="text-muted-foreground text-center py-6">
                                    No agent nodes configured
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
