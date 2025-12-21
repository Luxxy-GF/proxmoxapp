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
import { PlusCircle } from "lucide-react"
import { useActionState, useState, useEffect } from "react"
import { createProduct } from "@/app/dashboard/admin/actions"

const initialState = {
    message: "",
    errors: undefined,
    success: false,
}

export function AddProductDialog() {
    const [open, setOpen] = useState(false)
    const [state, formAction, isPending] = useActionState(createProduct, initialState)

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
                    Create Plan
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <form action={formAction}>
                    <DialogHeader>
                        <DialogTitle>Create Plan</DialogTitle>
                        <DialogDescription>
                            Define a new hosting plan available for users.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Plan Name</Label>
                            <Input id="name" name="name" placeholder="Standard VPS" required />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" placeholder="Great for small websites..." />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="price">Price</Label>
                                <Input id="price" name="price" type="number" step="0.01" min="0" placeholder="0.00" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="billingCycle">Billing Cycle</Label>
                                <Select name="billingCycle" defaultValue="MONTHLY">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select cycle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                                        <SelectItem value="YEARLY">Yearly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="cpuCores">CPU Cores</Label>
                                <Input id="cpuCores" name="cpuCores" type="number" min="1" defaultValue="1" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="memoryMB">RAM (MB)</Label>
                                <Input id="memoryMB" name="memoryMB" type="number" min="128" step="128" defaultValue="1024" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="diskGB">Disk (GB)</Label>
                                <Input id="diskGB" name="diskGB" type="number" min="1" defaultValue="20" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="type">Virtualization Type</Label>
                                <Select name="type" defaultValue="lxc">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lxc">LXC Container</SelectItem>
                                        <SelectItem value="qemu">QEMU VM (KVM)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {state?.error && (
                            <div className="text-sm font-medium text-destructive">
                                {state.error}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Creating..." : "Create Plan"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
