"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trash2, UserPlus, Shield } from "lucide-react"
import { addSubuser, getSubusers, removeSubuser } from "./actions"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

export default function SubusersPage() {
    const params = useParams()
    const serverId = params.id as string

    const [subusers, setSubusers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [newUserEmail, setNewUserEmail] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Initial load
    useEffect(() => {
        loadSubusers()
    }, [serverId])

    async function loadSubusers() {
        const res = await getSubusers(serverId)
        if (res.success) {
            setSubusers(res.subusers || [])
        }
        setLoading(false)
    }

    async function handleAddUser(e: React.FormEvent) {
        e.preventDefault()
        setIsSubmitting(true)

        // Default permissions for now
        const formData = new FormData()
        formData.append("email", newUserEmail)

        const res = await addSubuser(serverId, formData)

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success("Subuser added successfully")
            setAddDialogOpen(false)
            setNewUserEmail("")
            loadSubusers()
        }
        setIsSubmitting(false)
    }

    async function handleRemoveUser(userId: string) {
        if (!confirm("Are you sure you want to remove this subuser?")) return

        const res = await removeSubuser(serverId, userId)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success("Subuser removed")
            loadSubusers()
        }
    }

    // Permission definitions (can be expanded later)
    const availablePermissions = [
        { id: "power", label: "Power Actions" },
        { id: "console", label: "Access Console" },
        { id: "settings", label: "Manage Settings" },
        { id: "billing", label: "View Billing" },
    ]

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Subusers</h1>
                    <p className="text-muted-foreground">
                        Manage users who have access to this server
                    </p>
                </div>

                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add Subuser
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Subuser</DialogTitle>
                            <DialogDescription>
                                Invite a user to access this server. They must already have an account.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleAddUser} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="user@example.com"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Permissions (Default: All for now)</Label>
                                <div className="text-xs text-muted-foreground">
                                    Granular permission control coming in next update.
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add User
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Authorized Users</CardTitle>
                    <CardDescription>
                        Users listed here have access to manage this server.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : subusers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                            <Shield className="h-8 w-8 opacity-50" />
                            <p>No subusers added yet.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Added</TableHead>
                                    <TableHead>Permissions</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subusers.map((sub) => (
                                    <TableRow key={sub.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={sub.user.image} />
                                                    <AvatarFallback>{sub.user.name?.[0] || sub.user.email?.[0]?.toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{sub.user.name || "Unknown"}</span>
                                                    <span className="text-xs text-muted-foreground">{sub.user.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {new Date(sub.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10">
                                                Full Access
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                                onClick={() => handleRemoveUser(sub.user.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
