"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { PlusCircle, Loader2, Copy, Check } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    address: z.string().min(1, "Address is required"),
    location: z.string().optional(),
    description: z.string().optional(),
    port: z.coerce.number().min(1, "Valid port required").default(3000),
    apiKey: z.string().optional(),
})

export function AddDedicatedNodeDialog() {
    const [open, setOpen] = useState(false)
    const [createdToken, setCreatedToken] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const router = useRouter()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            address: "",
            location: "",
            description: "",
            port: 3000,
            apiKey: "",
        },
    })

    const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = form

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const response = await fetch("/api/baremetal/nodes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(values),
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(error || "Failed to create node")
            }

            const data = await response.json()
            setCreatedToken(data.tokenSecret)
            toast.success("Dedicated Node Created", {
                description: "The node has been successfully registered.",
            })
            router.refresh()
            // Don't close immediately, show the token
        } catch (error) {
            toast.error("Error", {
                description: error instanceof Error ? error.message : "Something went wrong",
            })
        }
    }

    const copyToken = () => {
        if (createdToken) {
            navigator.clipboard.writeText(createdToken)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleClose = () => {
        setOpen(false)
        setCreatedToken(null)
        reset()
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) handleClose()
            else setOpen(true)
        }}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Node
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Dedicated Node</DialogTitle>
                    <DialogDescription>
                        Register a new physical location or Agent controller.
                    </DialogDescription>
                </DialogHeader>

                {createdToken ? (
                    <div className="space-y-4 py-4">
                        <Alert className="bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400">
                            <AlertTitle className="flex items-center gap-2">Success!</AlertTitle>
                            <AlertDescription>
                                The node was created. Please copy the Agent Token below. It will not be shown again.
                            </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                            <Label>Agent Token</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    readOnly
                                    value={createdToken}
                                    className="font-mono bg-muted"
                                />
                                <Button size="icon" variant="outline" onClick={copyToken}>
                                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Add this to your agent's <code>.env</code> file as <code>AGENT_TOKEN</code>.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleClose}>Done</Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                placeholder="nyc-metal-01"
                                {...register("name")}
                            />
                            {errors.name && (
                                <p className="text-sm font-medium text-destructive">{errors.name.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    placeholder="10.0.10.5"
                                    {...register("address")}
                                />
                                {errors.address && (
                                    <p className="text-sm font-medium text-destructive">{errors.address.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="port">Port</Label>
                                <Input
                                    id="port"
                                    type="number"
                                    placeholder="3000"
                                    {...register("port")}
                                />
                                {errors.port && (
                                    <p className="text-sm font-medium text-destructive">{errors.port.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="apiKey">Manual API Key (Optional)</Label>
                            <Input
                                id="apiKey"
                                type="password"
                                placeholder="Secret key for Panel -> Agent auth"
                                {...register("apiKey")}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                placeholder="New York, NY"
                                {...register("location")}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Primary bare metal controller..."
                                {...register("description")}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Node
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
