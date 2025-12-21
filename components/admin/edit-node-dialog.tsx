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
import { Pencil } from "lucide-react"
import { useActionState, useState, useEffect } from "react"
import { updateNode } from "@/app/dashboard/admin/actions"

const initialState = {
    message: "",
    errors: undefined,
    success: false,
}

interface EditNodeDialogProps {
    node: {
        id: string
        name: string
        address: string
        proxmoxId: string
        endpoint: string
        cotermEndpoint?: string | null
    }
}

export function EditNodeDialog({ node }: EditNodeDialogProps) {
    const [open, setOpen] = useState(false)
    const [state, formAction, isPending] = useActionState(updateNode, initialState)

    useEffect(() => {
        if (state?.success) {
            setOpen(false)
        }
    }, [state])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-muted">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form action={formAction}>
                    <input type="hidden" name="id" value={node.id} />
                    <DialogHeader>
                        <DialogTitle>Edit Node</DialogTitle>
                        <DialogDescription>
                            Update connection details. Leave secrets blank to keep existing ones.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Display Name</Label>
                            <Input id="name" name="name" defaultValue={node.name} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="address">Address / Host</Label>
                                <Input id="address" name="address" defaultValue={node.address} required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="proxmoxId">Proxmox Node ID</Label>
                                <Input id="proxmoxId" name="proxmoxId" defaultValue={node.proxmoxId} required />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="endpoint">API Endpoint</Label>
                            <Input id="endpoint" name="endpoint" defaultValue={node.endpoint} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="tokenId">New API Token ID (Optional)</Label>
                            <Input id="tokenId" name="tokenId" placeholder="Leave blank to keep unchanged" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="tokenSecret">New API Token Secret (Optional)</Label>
                            <Input id="tokenSecret" name="tokenSecret" type="password" placeholder="Leave blank to keep unchanged" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cotermEndpoint">Coterm Endpoint (Optional)</Label>
                            <Input
                                id="cotermEndpoint"
                                name="cotermEndpoint"
                                defaultValue={node.cotermEndpoint ?? ""}
                                placeholder="https://coterm.example.com"
                            />
                            <p className="text-xs text-muted-foreground">
                                Base URL for your Coterm deployment. Leave blank to disable console access.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cotermSecret">Coterm Token Secret (Optional)</Label>
                            <Input
                                id="cotermSecret"
                                name="cotermSecret"
                                type="password"
                                placeholder="Leave blank to keep existing secret"
                            />
                            <p className="text-xs text-muted-foreground">
                                Should match the <code>COTERM_TOKEN</code> value used by Coterm.
                            </p>
                        </div>
                        {state?.error && (
                            <div className="text-sm font-medium text-destructive">
                                {state.error}
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
