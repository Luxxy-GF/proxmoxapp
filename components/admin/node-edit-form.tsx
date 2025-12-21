"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useActionState, useState, useEffect } from "react"
import { updateNode } from "@/app/dashboard/admin/actions"
import { Eye, EyeOff } from "lucide-react"

const initialState = {
    message: "",
    errors: undefined,
    success: false,
}

interface NodeEditFormProps {
    node: {
        id: string
        name: string
        address: string
        proxmoxId: string
        endpoint: string
        cotermEndpoint?: string | null
    }
}

export function NodeEditForm({ node }: NodeEditFormProps) {
    const [state, formAction, isPending] = useActionState(updateNode, initialState)
    const [showSecret, setShowSecret] = useState(false)
    const [showCotermSecret, setShowCotermSecret] = useState(false)

    return (
        <Card className="h-full">
            <form action={formAction} className="h-full flex flex-col justify-between">
                <input type="hidden" name="id" value={node.id} />
                <CardHeader>
                    <CardTitle>Node Details</CardTitle>
                    <CardDescription>
                        Update connection credentials for this Proxmox node.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" name="name" defaultValue={node.name} required />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="address">IP Address / Host</Label>
                        <Input id="address" name="address" defaultValue={node.address} required />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="proxmoxId">Proxmox Node ID</Label>
                        <Input id="proxmoxId" name="proxmoxId" defaultValue={node.proxmoxId} required />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="endpoint">API Endpoint</Label>
                        <Input id="endpoint" name="endpoint" defaultValue={node.endpoint} required />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="tokenId">Token ID (User@Realm!TokenName)</Label>
                        <Input id="tokenId" name="tokenId" placeholder="root@pam!lumen" title="Leave blank to keep existing" />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="tokenSecret">Token Secret</Label>
                        <div className="relative">
                            <Input
                                id="tokenSecret"
                                name="tokenSecret"
                                type={showSecret ? "text" : "password"}
                                placeholder="Leave blank to keep existing"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowSecret(!showSecret)}
                            >
                                {showSecret ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="cotermEndpoint">Coterm Endpoint</Label>
                        <Input
                            id="cotermEndpoint"
                            name="cotermEndpoint"
                            defaultValue={node.cotermEndpoint ?? ""}
                            placeholder="https://coterm.example.com"
                        />
                        <p className="text-xs text-muted-foreground">
                            The public URL of your Coterm proxy. Leave blank to disable console access.
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="cotermSecret">Coterm Token Secret</Label>
                        <div className="relative">
                            <Input
                                id="cotermSecret"
                                name="cotermSecret"
                                type={showCotermSecret ? "text" : "password"}
                                placeholder="Leave blank to keep existing"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowCotermSecret(!showCotermSecret)}
                            >
                                {showCotermSecret ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Must match the <code>COTERM_TOKEN</code> configured for Coterm.
                        </p>
                    </div>

                    {state?.error && (
                        <div className="text-sm font-medium text-destructive">
                            {state.error}
                        </div>
                    )}
                    {state?.success && (
                        <div className="text-sm font-medium text-green-500">
                            Node updated successfully.
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "Saving..." : "Save"}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
