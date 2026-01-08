"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreHorizontal, Pencil, Copy, Power, Trash2, Server, Wrench, HardDrive, AlertTriangle } from "lucide-react";

interface PXEProfile {
    id: string;
    name: string;
    templateType: string;
    osFamily: string;
    tags: string[];
    enabled: boolean;
    serverTargetType: string;
    isDestructive: boolean;
    updatedAt: string;
}

export default function PXEManagerPage() {
    const router = useRouter();
    const [profiles, setProfiles] = useState<PXEProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState<PXEProfile | null>(null);

    const fetchProfiles = async () => {
        try {
            const res = await fetch("/api/admin/pxe/profiles");
            if (res.ok) {
                const data = await res.json();
                setProfiles(data);
            }
        } catch (error) {
            console.error("Failed to fetch profiles:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleDuplicate = async (profile: PXEProfile) => {
        try {
            const res = await fetch(`/api/admin/pxe/profiles/${profile.id}/duplicate`, {
                method: "POST",
            });
            if (res.ok) {
                fetchProfiles();
            }
        } catch (error) {
            console.error("Failed to duplicate:", error);
        }
    };

    const handleToggleEnabled = async (profile: PXEProfile) => {
        try {
            await fetch(`/api/admin/pxe/profiles/${profile.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: !profile.enabled }),
            });
            fetchProfiles();
        } catch (error) {
            console.error("Failed to toggle:", error);
        }
    };

    const handleDelete = async () => {
        if (!profileToDelete) return;
        try {
            await fetch(`/api/admin/pxe/profiles/${profileToDelete.id}`, {
                method: "DELETE",
            });
            fetchProfiles();
        } catch (error) {
            console.error("Failed to delete:", error);
        } finally {
            setDeleteDialogOpen(false);
            setProfileToDelete(null);
        }
    };

    // Filter profiles by tab
    const osProfiles = profiles.filter(
        (p) => ["KICKSTART", "PRESEED", "WINDOWS"].includes(p.templateType) && p.enabled
    );
    const rescueProfiles = profiles.filter(
        (p) => p.templateType === "RESCUE" && p.enabled
    );
    const utilityProfiles = profiles.filter(
        (p) => p.templateType === "UTILITY" && !p.isDestructive && p.enabled
    );
    const diskWipeProfiles = profiles.filter(
        (p) => p.templateType === "UTILITY" && p.isDestructive && p.enabled
    );
    const disabledProfiles = profiles.filter((p) => !p.enabled);

    const ProfileTable = ({ data }: { data: PXEProfile[] }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Offered For</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No profiles found
                        </TableCell>
                    </TableRow>
                ) : (
                    data.map((profile) => (
                        <TableRow key={profile.id}>
                            <TableCell className="font-medium">{profile.name}</TableCell>
                            <TableCell>
                                <Badge variant="outline">{profile.templateType}</Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                    {profile.tags.slice(0, 3).map((tag) => (
                                        <Badge key={tag} variant="secondary" className="text-xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                    {profile.tags.length > 3 && (
                                        <Badge variant="secondary" className="text-xs">
                                            +{profile.tags.length - 3}
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={profile.enabled ? "default" : "secondary"}>
                                    {profile.enabled ? "Enabled" : "Disabled"}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <span className="text-sm text-muted-foreground">
                                    {profile.serverTargetType}
                                </span>
                            </TableCell>
                            <TableCell>
                                <span className="text-sm text-muted-foreground">
                                    {new Date(profile.updatedAt).toLocaleDateString()}
                                </span>
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/admin/pxe/${profile.id}`)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDuplicate(profile)}>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Duplicate
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleToggleEnabled(profile)}>
                                            <Power className="mr-2 h-4 w-4" />
                                            {profile.enabled ? "Disable" : "Enable"}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-500"
                                            onClick={() => {
                                                setProfileToDelete(profile);
                                                setDeleteDialogOpen(true);
                                            }}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">PXE Manager</h1>
                    <p className="text-muted-foreground">Manage PXE boot profiles for bare-metal provisioning</p>
                </div>
                <Button onClick={() => router.push("/dashboard/admin/pxe/new")}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Profile
                </Button>
            </div>

            <Tabs defaultValue="os" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="os" className="gap-2">
                        <Server className="h-4 w-4" />
                        Operating Systems
                        <Badge variant="secondary" className="ml-1">{osProfiles.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="rescue" className="gap-2">
                        <Wrench className="h-4 w-4" />
                        Rescue Systems
                        <Badge variant="secondary" className="ml-1">{rescueProfiles.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="utility" className="gap-2">
                        <HardDrive className="h-4 w-4" />
                        Utilities & Tools
                        <Badge variant="secondary" className="ml-1">{utilityProfiles.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="diskwipe" className="gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Disk Wipe
                        <Badge variant="secondary" className="ml-1">{diskWipeProfiles.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="disabled" className="gap-2">
                        <Power className="h-4 w-4" />
                        Disabled
                        <Badge variant="secondary" className="ml-1">{disabledProfiles.length}</Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="os">
                    <Card>
                        <CardHeader>
                            <CardTitle>Operating System Profiles</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ProfileTable data={osProfiles} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rescue">
                    <Card>
                        <CardHeader>
                            <CardTitle>Rescue System Profiles</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ProfileTable data={rescueProfiles} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="utility">
                    <Card>
                        <CardHeader>
                            <CardTitle>Utilities & Tools</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ProfileTable data={utilityProfiles} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="diskwipe">
                    <Card>
                        <CardHeader>
                            <CardTitle>Disk Wipe Profiles</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ProfileTable data={diskWipeProfiles} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="disabled">
                    <Card>
                        <CardHeader>
                            <CardTitle>Disabled Profiles</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ProfileTable data={disabledProfiles} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Profile</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{profileToDelete?.name}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
