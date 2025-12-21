"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Pencil } from "lucide-react"
import { useActionState, useState, useEffect } from "react"
import { updateIPPool } from "@/app/dashboard/admin/networking/actions"

const initialState = {
    message: "",
    errors: undefined,
    success: false,
}

export function EditIPPoolDialog({ pool, nodes }: { pool: any, nodes: any[] }) {
    const [open, setOpen] = useState(false)
    const updateAction = updateIPPool.bind(null, pool.id)
    const [state, formAction, isPending] = useActionState(updateAction, initialState)

    useEffect(() => {
        if (state?.success) {
            setOpen(false)
        }
    }, [state])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
                <form action={formAction}>
                    <DialogHeader>
                        <DialogTitle>Edit IP Pool</DialogTitle>
                        <DialogDescription>
                            Modify settings for {pool.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Pool Name</Label>
                                <Input id="name" name="name" defaultValue={pool.name} required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="nodeId">Node</Label>
                                <Select name="nodeId" required defaultValue={pool.nodeId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select node" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {nodes.map((node) => (
                                            <SelectItem key={node.id} value={node.id}>
                                                {node.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="ipVersion">IP Version</Label>
                                <Select name="ipVersion" defaultValue={pool.ipVersion}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select version" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="v4">IPv4</SelectItem>
                                        <SelectItem value="v6">IPv6</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="bridge">Bridge Interface</Label>
                                <Input id="bridge" name="bridge" defaultValue={pool.bridge} required />
                            </div>
                        </div>

                        <div className="p-4 border rounded-lg bg-muted/20 space-y-4">
                            <h4 className="font-medium text-sm text-muted-foreground">Network Configuration</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="startIP">Start IP</Label>
                                    <Input id="startIP" name="startIP" defaultValue={pool.startIP} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="endIP">End IP</Label>
                                    <Input id="endIP" name="endIP" defaultValue={pool.endIP} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="gateway">Gateway</Label>
                                    <Input id="gateway" name="gateway" defaultValue={pool.gateway} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="netmask">Netmask / CIDR</Label>
                                    <Input id="netmask" name="netmask" defaultValue={pool.netmask} required />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="vlan">VLAN Tag (Optional)</Label>
                                <Input id="vlan" name="vlan" type="number" defaultValue={pool.vlan ?? ""} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="mtu">MTU (Optional)</Label>
                                <Input id="mtu" name="mtu" type="number" defaultValue={pool.mtu ?? ""} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="dns">DNS (Optional)</Label>
                                <Input id="dns" name="dns" defaultValue={pool.dns ?? ""} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" name="notes" defaultValue={pool.notes ?? ""} />
                        </div>

                        {state?.error && (
                            <div className="text-sm font-medium text-destructive">
                                {state.error}
                            </div>
                        )}
                        {state?.errors && (
                            <div className="text-sm text-destructive">
                                <ul className="list-disc pl-4">
                                    {Object.entries(state.errors).map(([key, errors]: [string, any]) => (
                                        <li key={key}>{errors[0]}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
