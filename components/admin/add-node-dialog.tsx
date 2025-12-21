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
import { PlusCircle } from "lucide-react"
import { useActionState, useState, useEffect } from "react"
import { createNode } from "@/app/dashboard/admin/actions"

const initialState = {
    message: "",
    errors: undefined,
    success: false,
}

export function AddNodeDialog() {
    const [open, setOpen] = useState(false)
    const [state, formAction, isPending] = useActionState(createNode, initialState)

    useEffect(() => {
        if (state?.success) {
            setOpen(false)
        }
    }, [state])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Node
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form action={formAction}>
                    <DialogHeader>
                        <DialogTitle>Add Proxmox Node</DialogTitle>
                        <DialogDescription>
                            Connect a new Proxmox node to the panel. Credentials will be encrypted.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Display Name</Label>
                            <Input id="name" name="name" placeholder="US East 1" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="address">Address / Host</Label>
                                <Input id="address" name="address" placeholder="10.0.0.1" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="proxmoxId">Proxmox Node ID</Label>
                                <Input id="proxmoxId" name="proxmoxId" placeholder="pve1" required />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="endpoint">API Endpoint</Label>
                            <Input id="endpoint" name="endpoint" placeholder="https://10.0.0.1:8006/api2/json" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="tokenId">API Token ID</Label>
                            <Input id="tokenId" name="tokenId" placeholder="user@pam!token" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="tokenSecret">API Token Secret</Label>
                            <Input id="tokenSecret" name="tokenSecret" type="password" required />
                            <p className="text-xs text-muted-foreground">
                                Providing this token grants full administrative access.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cotermEndpoint">Coterm Endpoint (Optional)</Label>
                            <Input
                                id="cotermEndpoint"
                                name="cotermEndpoint"
                                placeholder="https://coterm.example.com"
                            />
                            <p className="text-xs text-muted-foreground">
                                Base URL of your Coterm deployment. Used to open browser consoles.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cotermSecret">Coterm Token Secret (Optional)</Label>
                            <Input
                                id="cotermSecret"
                                name="cotermSecret"
                                type="password"
                                placeholder="Use the same secret Coterm runs with"
                            />
                            <p className="text-xs text-muted-foreground">
                                Must match the <code>COTERM_TOKEN</code> configured for your Coterm proxy.
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
                            {isPending ? "Adding..." : "Add Node"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
