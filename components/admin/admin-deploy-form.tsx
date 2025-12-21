"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createServerAdmin } from "@/app/dashboard/admin/servers/new/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface Props {
    users: any[]
    nodes: any[]
    products: any[]
    groups: any[]
}

export function AdminDeployForm({ users, nodes, products, groups }: Props) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const result = await createServerAdmin(formData)

        if (result?.error) {
            setError(result.error)
            setLoading(false)
        } else {
            router.push("/dashboard/admin/servers")
        }
    }

    // Flatten templates for easier selection logic if needed, 
    // but for UI, we probably want select groups.
    // For simplicity, let's just show all templates in one select or grouped select.

    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>User</Label>
                            <Select name="userId" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select User" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Node</Label>
                            <Select name="nodeId" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Node" />
                                </SelectTrigger>
                                <SelectContent>
                                    {nodes.map(n => (
                                        <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Product</Label>
                            <Select name="productId" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name} - ${p.price}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Template</Label>
                            <Select name="templateId" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select OS Template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {groups.map(g => (
                                        g.templates.map((t: any) => (
                                            <SelectItem key={t.id} value={t.id}>{g.name} - {t.name}</SelectItem>
                                        ))
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Hostname</Label>
                            <Input name="hostname" placeholder="server-name" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Root Password</Label>
                            <Input name="password" type="password" required />
                        </div>
                    </div>

                    {error && <p className="text-destructive text-sm font-medium">{error}</p>}

                </CardContent>
                <CardFooter className="justify-end bg-muted/50 py-4">
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
                        Provision Server
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}
