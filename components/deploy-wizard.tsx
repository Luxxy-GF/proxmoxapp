"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Check, Loader2, Terminal, Server } from "lucide-react"
import { getDefaultNodeStorage, deployServer } from "@/app/dashboard/deploy/actions"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Disc } from "lucide-react"

interface WizardProps {
    groups: any[]
    products: any[]
    ipPools: any[]
    isos: any[]
}

export function DeployWizard({ groups, products, ipPools, isos }: WizardProps) {
    const [step, setStep] = useState(1)
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
    const [selectedIso, setSelectedIso] = useState<string | null>(null) // New state
    const [osType, setOsType] = useState<"template" | "iso">("template") // Tab state

    const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
    const [selectedPool, setSelectedPool] = useState<string | null>(null)
    const [selectedStorage, setSelectedStorage] = useState<string>("") // Storage State
    const [storageOptions, setStorageOptions] = useState<any[]>([]) // Storage List

    const [config, setConfig] = useState({ hostname: "", password: "" })
    const [isDeploying, setIsDeploying] = useState(false)
    const [error, setError] = useState("")
    const router = useRouter()

    // Fetch storage options when component mounts or tab changes to ISO
    useEffect(() => {
        if (osType === 'iso') {
            getDefaultNodeStorage().then(list => {
                setStorageOptions(list)
                // Default to local-lvm/zfs/ceph if available
                const preferred = list.find((s: any) => s.storage === 'local-lvm' || s.storage === 'local-zfs' || s.storage === 'ceph')
                if (preferred) setSelectedStorage(preferred.storage)
                else if (list.length > 0) setSelectedStorage(list[0].storage)
            })
        }
    }, [osType])

    const handleDeploy = async () => {
        if ((!selectedTemplate && !selectedIso) || !selectedProduct || !config.hostname) return

        setIsDeploying(true)
        setError("")

        // If template mode, isoId is null. If iso mode, templateId is null.
        const tId = osType === 'template' ? selectedTemplate : null
        const iId = osType === 'iso' ? selectedIso : null

        // Pass selectedStorage only if using ISO mode
        const storageVal = osType === 'iso' ? selectedStorage : undefined

        const result = await deployServer(tId, selectedProduct, config.hostname, config.password, selectedPool, iId, storageVal)

        if (result.error) {
            setError(result.error)
            setIsDeploying(false)
        } else {
            router.push("/dashboard")
        }
    }

    // Step 1: Select OS
    if (step === 1) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader>
                        <CardTitle>Select Operating System</CardTitle>
                        <CardDescription>Choose the OS image for your server.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={osType} onValueChange={(v) => {
                            setOsType(v as "template" | "iso")
                            // Reset selections when switching tabs? Optional.
                        }}>
                            <TabsList className="mb-6">
                                <TabsTrigger value="template">OS Templates</TabsTrigger>
                                <TabsTrigger value="iso">Custom ISO</TabsTrigger>
                            </TabsList>

                            <TabsContent value="template">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {groups.map(group => (
                                        <div key={group.id} className="col-span-full">
                                            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">{group.name}</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                                                            <img src={t.image} alt={t.name} className="w-12 h-12 object-contain" />
                                                        ) : (
                                                            <Terminal className="w-12 h-12 text-muted-foreground" />
                                                        )}
                                                        <span className="font-semibold">{t.name}</span>
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
                                </div>
                            </TabsContent>

                            <TabsContent value="iso">
                                {isos.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-950">
                                        <Disc className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                        <h3 className="text-lg font-medium">No ISOs Found</h3>
                                        <p className="text-muted-foreground mb-4">Upload an ISO image to deploy a custom server.</p>
                                        <Button variant="outline" onClick={() => router.push("/dashboard/isos")}>
                                            Manage ISOs
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {isos.map(iso => (
                                            <div
                                                key={iso.id}
                                                onClick={() => setSelectedIso(iso.id)}
                                                className={cn(
                                                    "cursor-pointer rounded-xl border-2 p-4 transition-all flex items-start gap-4",
                                                    selectedIso === iso.id ? "border-primary bg-primary/5" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                                                )}
                                            >
                                                <div className="p-2 rounded-full bg-zinc-900">
                                                    <Disc className="h-6 w-6 text-zinc-400" />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium truncate pr-2" title={iso.name}>{iso.name}</h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        {(Number(iso.size) / (1024 * 1024 * 1024)).toFixed(2)} GB • {iso.status}
                                                    </p>
                                                </div>
                                                {selectedIso === iso.id && (
                                                    <div className="ml-auto bg-primary rounded-full p-0.5 text-primary-foreground">
                                                        <Check className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-8 space-y-4 max-w-sm">
                                    <Label>Target Storage</Label>
                                    <Select value={selectedStorage} onValueChange={setSelectedStorage} disabled={storageOptions.length === 0}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select storage for VM disk" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {storageOptions.map((s: any) => (
                                                <SelectItem key={s.storage} value={s.storage}>
                                                    {s.storage} ({Math.round(s.avail / 1024 / 1024 / 1024)}GB Free)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">Select where the VM's main disk will be created.</p>
                                </div>

                            </TabsContent>
                        </Tabs>
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button onClick={() => setStep(2)} disabled={osType === 'template' ? !selectedTemplate : !selectedIso}>
                            Next: Select Plan
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    // Step 2: Select Plan
    if (step === 2) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader>
                        <CardTitle>Select Plan</CardTitle>
                        <CardDescription>Choose the resource allocation for your server.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {products.map(product => (
                            <div
                                key={product.id}
                                className={cn(
                                    "cursor-pointer rounded-xl border-2 p-6 hover:bg-zinc-900 transition-all flex flex-col gap-4 relative",
                                    selectedProduct === product.id ? "border-primary bg-primary/5" : "border-zinc-800 bg-zinc-950"
                                )}
                                onClick={() => setSelectedProduct(product.id)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-xl">{product.name}</h3>
                                        <p className="text-zinc-400 text-sm">{product.billingCycle}</p>
                                    </div>
                                    <span className="font-bold text-xl">${product.price}</span>
                                </div>
                                <ul className="space-y-2 text-sm text-zinc-300">
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> {product.cpuCores} vCPU Cores</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> {product.memoryMB} MB RAM</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> {product.diskGB} GB SSD</li>
                                </ul>
                            </div>
                        ))}
                    </CardContent>
                    <CardFooter className="justify-between">
                        <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                        <Button onClick={() => setStep(3)} disabled={!selectedProduct}>
                            Next: Network
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    // Step 3: Select Network (IP Pool)
    if (step === 3) {
        const totalIPs = (pool: any) => {
            const start = pool.startIP.split('.').reduce((acc: number, octet: string) => (acc << 8) + parseInt(octet), 0)
            const end = pool.endIP.split('.').reduce((acc: number, octet: string) => (acc << 8) + parseInt(octet), 0)
            return end - start + 1
        }

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader>
                        <CardTitle>Select Network</CardTitle>
                        <CardDescription>Choose an IP pool for your server's network configuration.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {ipPools.length === 0 ? (
                            <div className="bg-muted/50 border rounded-lg p-6 text-center">
                                <p className="text-muted-foreground">No IP pools available.</p>
                                <p className="text-sm text-muted-foreground mt-1">You can deploy without an IP pool (DHCP will be used).</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {ipPools.map((pool: any) => {
                                    const total = totalIPs(pool)
                                    const used = pool.allocations?.length || 0
                                    const available = total - used

                                    return (
                                        <div
                                            key={pool.id}
                                            className={cn(
                                                "cursor-pointer rounded-xl border-2 p-4 hover:bg-zinc-900 transition-all relative",
                                                selectedPool === pool.id ? "border-primary bg-primary/5" : "border-zinc-800 bg-zinc-950"
                                            )}
                                            onClick={() => setSelectedPool(pool.id)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-semibold text-lg">{pool.name}</h4>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        {pool.startIP} - {pool.endIP}
                                                    </p>
                                                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                                        <span>Node: {pool.node.name}</span>
                                                        <span>Gateway: {pool.gateway}</span>
                                                        {pool.vlan && <span>VLAN: {pool.vlan}</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-medium">{available}/{total} IPs</div>
                                                    <div className="text-xs text-muted-foreground">Available</div>
                                                </div>
                                            </div>
                                            {selectedPool === pool.id && (
                                                <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5 text-primary-foreground">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="justify-between">
                        <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                        <Button onClick={() => setStep(4)}>
                            Next: Configure
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    // Step 4: Configure
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-zinc-800 bg-zinc-950/50">
                <CardHeader>
                    <CardTitle>Configure Server</CardTitle>
                    <CardDescription>Finalize your server settings.</CardDescription>
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

                    {error && <p className="text-destructive text-sm font-medium">{error}</p>}
                </CardContent>
                <CardFooter className="justify-between">
                    <Button variant="ghost" onClick={() => setStep(3)} disabled={isDeploying}>Back</Button>
                    <Button onClick={handleDeploy} disabled={!config.hostname || isDeploying}>
                        {isDeploying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Provisioning...
                            </>
                        ) : (
                            "Deploy Server"
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
