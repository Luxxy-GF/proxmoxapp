"use client"

import { useState, startTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Check, ChevronsRight, Server, User, Box, HardDrive, Cpu, Terminal, Network, Disc } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
// Import the server action directly. In Next.js App Router, this works in Client Components.
import { createServerAdmin, getNodeStorage } from "@/app/dashboard/admin/servers/new/actions"
import { ipToLong } from "@/lib/networking"

interface WizardProps {
    users: any[]
    nodes: any[]
    products: any[]
    groups: any[]
    ipPools: any[]
    isos: any[]
}

export function ServerCreationWizard({ users, nodes, products, groups, ipPools, isos }: WizardProps) {
    const [step, setStep] = useState(1)

    // Form State
    const [selectedUser, setSelectedUser] = useState<string>("")
    const [selectedNode, setSelectedNode] = useState<string>("")
    const [selectedProduct, setSelectedProduct] = useState<string>("")
    const [selectedTemplate, setSelectedTemplate] = useState<string>("")
    const [selectedIso, setSelectedIso] = useState<string>("") // ISO state
    const [osType, setOsType] = useState<"template" | "iso">("template") // Tab state

    const [selectedStorage, setSelectedStorage] = useState<string>("") // Storage state
    const [selectedPool, setSelectedPool] = useState<string>("") // IP Pool state
    const [availableStorage, setAvailableStorage] = useState<any[]>([]) // Storage list
    const [config, setConfig] = useState({ hostname: "", password: "", username: "root" })
    const [resources, setResources] = useState({ cores: 1, memory: 1024, disk: 20 })

    // Loading State
    const [isThinking, setIsThinking] = useState(false)

    // Helper to get selected objects
    const node = nodes.find(n => n.id === selectedNode)
    const user = users.find(u => u.id === selectedUser)

    // Filter pools by selected node
    const availablePools = ipPools.filter(p => p.nodeId === selectedNode)

    // Filter ISOs: Show Admin ISOs + Selected User ISOs
    // Assume Admin ISOs are owned by admin (role check via user object? or just userId?)
    // For now, simple filter: iso.userId === selectedUser OR (maybe check if ISO owner is admin explicitly if available)
    // Actually, admins should see ALL. But highlighting user's ISOs makes sense.
    // Let's just show all for simplicity, or filter by user?
    // "Custom ISO" implies user's iso. Let's filter by selectedUser.
    const userIsos = isos.filter(i => i.userId === selectedUser || i.userId === 'admin' /* fallback */)
    // If we want to allow picking ANY ISO, we can keep all `isos`.
    // Let's us `userIsos` for now as primary list.

    const nextStep = () => setStep(s => s + 1)
    const prevStep = () => setStep(s => s - 1)

    const handleProductSelect = (product: any) => {
        setSelectedProduct(product.id)
        setResources({
            cores: product.cpuCores,
            memory: product.memoryMB,
            disk: product.diskGB
        })
    }

    const handleDeploy = async () => {
        setIsThinking(true)
        try {
            const result = await createServerAdmin({
                userId: selectedUser,
                nodeId: selectedNode,
                productId: selectedProduct || undefined,
                templateId: osType === 'iso' ? undefined : selectedTemplate,
                isoId: osType === 'iso' ? selectedIso : undefined,
                poolId: selectedPool, // Pass pool ID
                hostname: config.hostname,
                password: config.password,
                username: config.username,
                resources: resources,
                storage: selectedStorage || undefined
            })

            if (result?.error) {
                alert(result.error)
                setIsThinking(false)
            } else {
                // Success - redirect is handled by server action via revalidatePath usually, 
                // but explicit navigation is safer for client components sometimes.
                // However, the action returns { success: true }
                window.location.href = "/dashboard/admin/servers"
            }
        } catch (e) {
            console.error(e)
            alert("An unknown error occurred")
            setIsThinking(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Stepper Header */}
            <div className="flex items-center justify-between px-4">
                {[
                    { id: 1, label: "Owner & Node", icon: Server },
                    { id: 2, label: "Resources", icon: Box },
                    { id: 3, label: "OS Template", icon: Terminal },
                    { id: 4, label: "Networking", icon: Network },
                    { id: 5, label: "Details", icon: HardDrive },
                    { id: 6, label: "Review", icon: Check },
                ].map((s, i) => (
                    <div key={s.id} className={cn("flex flex-col items-center gap-2", step === s.id ? "text-primary" : "text-muted-foreground")}>
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                            step === s.id ? "border-primary bg-primary/10" :
                                step > s.id ? "border-primary bg-primary text-primary-foreground" : "border-zinc-800 bg-zinc-900"
                        )}>
                            {step > s.id ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                        </div>
                        <span className="text-xs font-medium hidden md:block">{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Step 1: Owner & Node */}
            {step === 1 && (
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader>
                        <CardTitle>Select Owner & Node</CardTitle>
                        <CardDescription>Assign the server to a user and choose the infrastructure node.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* User Selection */}
                            <div className="space-y-3">
                                <Label>Server Owner</Label>
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger className="h-12">
                                        <SelectValue placeholder="Select a user..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map(u => (
                                            <SelectItem key={u.id} value={u.id}>
                                                <div className="flex flex-col text-left">
                                                    <span className="font-medium">{u.name}</span>
                                                    <span className="text-xs text-muted-foreground">{u.email}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {user && (
                                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
                                        <div className="bg-primary/20 w-8 h-8 rounded-full flex items-center justify-center text-primary">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Selected: {user.name}</p>
                                            <p className="text-xs text-muted-foreground">ID: {user.id}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Node Selection */}
                            <div className="space-y-3">
                                <Label>Infrastructure Node</Label>
                                <Select value={selectedNode} onValueChange={async (val) => {
                                    setSelectedNode(val)
                                    setSelectedStorage("")
                                    setSelectedPool("") // Reset pool when node changes
                                    // Fetch storage
                                    const result = await getNodeStorage(val)
                                    if (result.success) {
                                        setAvailableStorage(result.storage || [])
                                    }
                                }}>
                                    <SelectTrigger className="h-12">
                                        <SelectValue placeholder="Select a node..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {nodes.map(n => (
                                            <SelectItem key={n.id} value={n.id} disabled={n.status !== 'Online'}>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-2 h-2 rounded-full", n.status === 'Online' ? "bg-green-500" : "bg-red-500")} />
                                                    <span>{n.name} ({n.address})</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Storage Selection (Conditional) */}
                                {selectedNode && (
                                    <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                                        <Label className="mb-2 block">Target Storage</Label>
                                        <Select value={selectedStorage} onValueChange={setSelectedStorage}>
                                            <SelectTrigger className="h-12">
                                                <SelectValue placeholder="Select storage..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableStorage.map((s: any) => (
                                                    <SelectItem key={s.storage} value={s.storage}>
                                                        <div className="flex flex-col text-left">
                                                            <span className="font-medium">{s.storage}</span>
                                                            <span className="text-xs text-muted-foreground">{s.type} ({Math.round(s.avail / 1024 / 1024 / 1024)}GB free)</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {node && (
                                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">CPU Usage</span>
                                            <span className="font-medium">{node.cpuUsage?.toFixed(1)}%</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">RAM Usage</span>
                                            <span className="font-medium">{node.ramUsage?.toFixed(1)}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: `${node.ramUsage}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button onClick={nextStep} disabled={!selectedUser || !selectedNode || !selectedStorage}>
                            Next Step <ChevronsRight className="ml-2 w-4 h-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* Step 2: Resources */}
            {step === 2 && (
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader>
                        <CardTitle>Select Resources</CardTitle>
                        <CardDescription>Choose a product plan or define custom resources.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {/* Product Presets */}
                        <div>
                            <Label className="mb-4 block">Product Presets</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {products.map(product => (
                                    <div
                                        key={product.id}
                                        className={cn(
                                            "cursor-pointer rounded-xl border-2 p-6 hover:bg-zinc-900 transition-all flex flex-col gap-4 relative",
                                            selectedProduct === product.id ? "border-primary bg-primary/5" : "border-zinc-800 bg-zinc-950"
                                        )}
                                        onClick={() => handleProductSelect(product)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-xl">{product.name}</h3>
                                                <p className="text-zinc-400 text-sm">{product.billingCycle}</p>
                                            </div>
                                            <span className="font-bold text-xl">${product.price}</span>
                                        </div>
                                        <ul className="space-y-2 text-sm text-zinc-300">
                                            <li className="flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /> {product.cpuCores} vCPU Cores</li>
                                            <li className="flex items-center gap-2"><Box className="w-4 h-4 text-primary" /> {product.memoryMB} MB RAM</li>
                                            <li className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-primary" /> {product.diskGB} GB SSD</li>
                                        </ul>
                                        {selectedProduct === product.id && (
                                            <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5 text-primary-foreground">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 py-4">
                            <div className="h-px bg-zinc-800 flex-1" />
                            <span className="text-muted-foreground text-sm uppercase tracking-wider">Configuration</span>
                            <div className="h-px bg-zinc-800 flex-1" />
                        </div>

                        {/* Custom Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-3">
                                <Label>CPU Cores</Label>
                                <div className="relative">
                                    <Cpu className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        min={1}
                                        value={resources.cores}
                                        onChange={(e) => setResources({ ...resources, cores: parseInt(e.target.value) || 0 })}
                                        className="pl-9 h-12"
                                    />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <Label>Memory (MB)</Label>
                                <div className="relative">
                                    <Box className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        min={128}
                                        step={128}
                                        value={resources.memory}
                                        onChange={(e) => setResources({ ...resources, memory: parseInt(e.target.value) || 0 })}
                                        className="pl-9 h-12"
                                    />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <Label>Disk (GB)</Label>
                                <div className="relative">
                                    <HardDrive className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        min={1}
                                        value={resources.disk}
                                        onChange={(e) => setResources({ ...resources, disk: parseInt(e.target.value) || 0 })}
                                        className="pl-9 h-12"
                                    />
                                </div>
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter className="justify-between">
                        <Button variant="ghost" onClick={prevStep}>Back</Button>
                        <Button onClick={nextStep} disabled={resources.cores < 1 || resources.memory < 128 || resources.disk < 1}>
                            Next Step <ChevronsRight className="ml-2 w-4 h-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* Step 3: OS Selection */}
            {step === 3 && (
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader>
                        <CardTitle>Select Operating System</CardTitle>
                        <CardDescription>Choose the OS image for the server.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={osType} onValueChange={(v) => startTransition(() => setOsType(v as "template" | "iso"))}>
                            <TabsList className="mb-6 w-full justify-start">
                                <TabsTrigger value="template">OS Templates</TabsTrigger>
                                <TabsTrigger value="iso">Custom ISO</TabsTrigger>
                            </TabsList>

                            <TabsContent value="template" className="space-y-8 mt-0">
                                {groups.map(group => (
                                    <div key={group.id} className="space-y-3">
                                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pl-1 border-l-2 border-primary/50">{group.name}</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {group.templates.map((t: any) => (
                                                <div
                                                    key={t.id}
                                                    className={cn(
                                                        "cursor-pointer rounded-xl border-2 p-4 hover:bg-zinc-900 transition-all text-center flex flex-col items-center gap-3 relative",
                                                        selectedTemplate === t.id ? "border-primary bg-primary/5" : "border-zinc-800 bg-zinc-950"
                                                    )}
                                                    onClick={() => setSelectedTemplate(t.id)}
                                                >
                                                    {t.image ? (
                                                        <img src={t.image} alt={t.name} className="w-10 h-10 object-contain" />
                                                    ) : (
                                                        <Terminal className="w-10 h-10 text-muted-foreground" />
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-sm">{t.name}</span>
                                                        <span className="text-xs text-muted-foreground">ID: {t.vmid}</span>
                                                    </div>
                                                    {selectedTemplate === t.id && (
                                                        <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5 text-primary-foreground">
                                                            <Check className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </TabsContent>

                            <TabsContent value="iso" className="mt-0">
                                {isos.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl">
                                        <Disc className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                                        <p className="text-muted-foreground">No ISOs found.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {isos.map((iso: any) => (
                                            <div
                                                key={iso.id}
                                                className={cn(
                                                    "cursor-pointer rounded-xl border-2 p-4 hover:bg-zinc-900 transition-all text-center flex flex-col items-center gap-3 relative",
                                                    selectedIso === iso.id ? "border-primary bg-primary/5" : "border-zinc-800 bg-zinc-950"
                                                )}
                                                onClick={() => setSelectedIso(iso.id)}
                                            >
                                                <Disc className="w-10 h-10 text-zinc-400" />
                                                <div className="flex flex-col overflow-hidden w-full">
                                                    <span className="font-semibold text-sm truncate" title={iso.name}>{iso.name}</span>
                                                    <span className="text-xs text-muted-foreground">{(Number(iso.size) / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
                                                </div>
                                                {selectedIso === iso.id && (
                                                    <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5 text-primary-foreground">
                                                        <Check className="w-3 h-3" />
                                                    </div>
                                                )}
                                                {iso.userId === 'admin' && (
                                                    <span className="absolute top-2 left-2 text-[10px] bg-zinc-800 px-1 rounded text-zinc-400 border border-zinc-700">ADMIN</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                    <CardFooter className="justify-between">
                        <Button variant="ghost" onClick={prevStep}>Back</Button>
                        <Button onClick={nextStep} disabled={osType === 'template' ? !selectedTemplate : !selectedIso}>
                            Next Step <ChevronsRight className="ml-2 w-4 h-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* Step 4: Networking (New) */}
            {step === 4 && (
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader>
                        <CardTitle>Network Configuration</CardTitle>
                        <CardDescription>Assign an IP address pool for this server.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 max-w-xl">
                        {availablePools.length === 0 ? (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive space-y-2">
                                <h4 className="font-semibold">No Public IP Pools Found</h4>
                                <p className="text-sm opacity-90">There are no IP pools configured for this node. You must create an IP pool in Admin &gt; Networking before deploying.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <Label>Select IP Pool</Label>
                                <Select value={selectedPool} onValueChange={setSelectedPool}>
                                    <SelectTrigger className="h-16">
                                        <SelectValue placeholder="Select a pool..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availablePools.map(pool => (
                                            <SelectItem key={pool.id} value={pool.id}>
                                                <div className="flex flex-col text-left py-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{pool.name}</span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{pool.ipVersion}</span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {pool.bridge} {pool.vlan ? `(VLAN ${pool.vlan})` : ""} •
                                                        {pool._count?.allocations || 0} IPs used
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="justify-between">
                        <Button variant="ghost" onClick={prevStep}>Back</Button>
                        <Button onClick={nextStep} disabled={!selectedPool}>
                            Next Step <ChevronsRight className="ml-2 w-4 h-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* Step 5: Details */}
            {step === 5 && (
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader>
                        <CardTitle>Server Details</CardTitle>
                        <CardDescription>Configure hostname and access credentials.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 max-w-md">
                        <div className="space-y-2">
                            <Label>Hostname</Label>
                            <div className="flex">
                                <Input
                                    placeholder="my-server"
                                    value={config.hostname}
                                    onChange={(e) => setConfig({ ...config, hostname: e.target.value })}
                                    className="rounded-r-none border-r-0"
                                />
                                <div className="bg-zinc-900 border border-zinc-800 rounded-r-md px-3 flex items-center text-muted-foreground text-sm">
                                    .local
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">Only use letters, numbers, and hyphens.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Root Password</Label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={config.password}
                                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="justify-between">
                        <Button variant="ghost" onClick={prevStep}>Back</Button>
                        <Button onClick={nextStep} disabled={!config.hostname || !config.password}>
                            Next Step <ChevronsRight className="ml-2 w-4 h-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* Step 6: Review */}
            {step === 6 && (
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader>
                        <CardTitle>Review & Provision</CardTitle>
                        <CardDescription>Review configuration before creating the server.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Infrastructure</h3>
                                <dl className="space-y-2 text-sm">
                                    <div className="flex justify-between py-1 border-b border-zinc-800">
                                        <span className="text-zinc-400">Node</span>
                                        <span className="font-medium">{node?.name}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-zinc-800">
                                        <span className="text-zinc-400">Storage</span>
                                        <span className="font-medium">{selectedStorage || "Default"}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-zinc-800">
                                        <span className="text-zinc-400">Owner</span>
                                        <span className="font-medium">{user?.name}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-zinc-800">
                                        <span className="text-zinc-400">Hostname</span>
                                        <span className="font-medium">{config.hostname}</span>
                                    </div>
                                </dl>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Specifications</h3>
                                <dl className="space-y-2 text-sm">
                                    <div className="flex justify-between py-1 border-b border-zinc-800">
                                        <span className="text-zinc-400">Product</span>
                                        <span className="font-medium">{products.find(p => p.id === selectedProduct)?.name || "Custom"}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-zinc-800">
                                        <span className="text-zinc-400">Resources</span>
                                        <span className="font-medium">{resources.cores} vCPU / {resources.memory} MB RAM / {resources.disk} GB Disk</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-zinc-800">
                                        <span className="text-zinc-400">OS Image</span>
                                        <span className="font-medium">
                                            {osType === 'template' ? (
                                                groups.flatMap(g => g.templates).find((t: any) => t.id === selectedTemplate)?.name
                                            ) : (
                                                isos.find((i: any) => i.id === selectedIso)?.name + " (ISO)"
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-zinc-800">
                                        <span className="text-zinc-400">Network Pool</span>
                                        <span className="font-medium">
                                            {ipPools.find(p => p.id === selectedPool)?.name}
                                        </span>
                                    </div>
                                </dl>
                            </div>
                        </div>

                        <div className="bg-amber-900/10 border border-amber-900/20 rounded-lg p-4 flex items-start gap-3">
                            <div className="p-1 bg-amber-900/20 rounded text-amber-500">
                                <Terminal className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-amber-500">Provisioning Warning</h4>
                                <p className="text-xs text-amber-400/80 mt-1">
                                    Clicking "Deploy Server" will immediately provision resources on <strong>{node?.name}</strong>.
                                    This action interacts with live infrastructure.
                                </p>
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter className="justify-between">
                        <Button variant="ghost" onClick={prevStep}>Back</Button>
                        <Button onClick={handleDeploy} disabled={isThinking}>
                            {isThinking ? "Provisioning..." : "Deploy Server"}
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    )
}
