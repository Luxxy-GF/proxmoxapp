"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getUploadTarget, downloadIsoFromUrl } from "@/app/dashboard/isos/actions"
import { Loader2, Trash2, HardDrive, Upload, Disc, Link as LinkIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

export default function IsoPage() {
    const [isos, setIsos] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadOpen, setUploadOpen] = useState(false)

    // Upload State
    const [file, setFile] = useState<File | null>(null)
    const [isoName, setIsoName] = useState("")

    // Download URL State
    const [url, setUrl] = useState("")
    const [urlName, setUrlName] = useState("")
    const [activeTab, setActiveTab] = useState("file")

    const fetchIsos = async () => {
        try {
            const res = await fetch("/api/isos")
            if (res.ok) {
                const data = await res.json()
                setIsos(data)
            }
        } catch (e) {
            console.error(e)
            toast.error("Failed to load ISOs")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchIsos()
    }, [])

    const handleUrlDownload = async () => {
        if (!url || !urlName) return

        setIsUploading(true)
        try {
            await downloadIsoFromUrl(url, urlName)
            toast.success("Download started on Proxmox node")
            setUploadOpen(false)
            setUrl("")
            setUrlName("")
            fetchIsos()
        } catch (error: any) {
            toast.error(error.message || "Download failed")
        } finally {
            setIsUploading(false)
        }
    }

    const handleUpload = async () => {
        if (!file || !isoName) return

        if (!file.name.endsWith(".iso")) {
            toast.error("File must be an .iso image")
            return
        }

        setIsUploading(true)
        setUploadProgress(0)

        try {
            // 1. Get Target Node/Storage
            // This ensures we send the correct 'node' and 'storage' fields in the body
            // which Proxmox requires to match the URL.
            const target = await getUploadTarget()

            // 2. Prepare Storage Filename
            const safeOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
            const storageFilename = `iso-${Date.now()}-${Math.floor(Math.random() * 1000)}-${safeOriginalName}`

            // 3. Prepare FormData for Proxmox (Order is important: fields first, then file)
            const formData = new FormData()
            formData.append("content", "iso")
            formData.append("filename", storageFilename)
            formData.append("file", file, storageFilename)

            // 4. Send using XHR to /api/proxy/upload
            const xhr = new XMLHttpRequest()

            // Pass metadata AND routing info in query string so Proxy knows where to go
            const params = new URLSearchParams({
                name: isoName,
                size: file.size.toString(),
                filename: storageFilename,
                nodeName: target.nodeName,
                storage: target.storage,
                nodeId: target.nodeId.toString()
            })

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100
                    setUploadProgress(percentComplete)
                }
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    toast.success("ISO uploaded successfully")
                    setUploadOpen(false)
                    setFile(null)
                    setIsoName("")
                    setUploadProgress(0)
                    fetchIsos()
                } else {
                    let errorMessage = "Upload failed"
                    try {
                        const response = JSON.parse(xhr.responseText)
                        if (response.error) errorMessage = response.error
                        // Optional: Show details in console or toast
                    } catch (e) {
                        errorMessage = `Upload failed (${xhr.status}): ${xhr.responseText.substring(0, 100)}`
                    }
                    toast.error(errorMessage)
                }
                setIsUploading(false)
            }

            xhr.onerror = () => {
                toast.error("Network error occurred")
                setIsUploading(false)
            }

            xhr.open("POST", `/api/proxy/upload?${params.toString()}`)
            xhr.send(formData)

        } catch (err: any) {
            toast.error(err.message || "Failed to initialize upload")
            setIsUploading(false)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return

        // Optimistic update
        const oldIsos = [...isos]
        setIsos(isos.filter(i => i.id !== id))
        toast.message(`Deleting ${name}...`)

        try {
            const res = await fetch(`/api/isos/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Delete failed")
            toast.success("ISO deleted")
        } catch (e) {
            toast.error("Failed to delete ISO")
            setIsos(oldIsos) // Rollback
        }
    }

    const formatSize = (bytes: string | number) => {
        const b = BigInt(bytes)
        const mb = Number(b) / (1024 * 1024)
        if (mb > 1024) {
            return `${(mb / 1024).toFixed(2)} GB`
        }
        return `${mb.toFixed(0)} MB`
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">ISO Library</h1>
                    <p className="text-muted-foreground">Manage your custom operating system images.</p>
                </div>
                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload ISO
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Custom ISO</DialogTitle>
                            <DialogDescription>
                                Import a bootable ISO image to use for your servers.
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="file">Upload File</TabsTrigger>
                                <TabsTrigger value="url">Download from URL</TabsTrigger>
                            </TabsList>

                            <div className="py-4">
                                <TabsContent value="file" className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Display Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="e.g. ubuntu-22.04-desktop"
                                            value={isoName}
                                            onChange={(e) => setIsoName(e.target.value)}
                                            disabled={isUploading}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="file">ISO File</Label>
                                        <div className="grid w-full max-w-sm items-center gap-1.5">
                                            <Input
                                                id="file"
                                                type="file"
                                                accept=".iso"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0]
                                                    if (f) {
                                                        setFile(f)
                                                        if (!isoName) setIsoName(f.name.replace(".iso", ""))
                                                    }
                                                }}
                                                disabled={isUploading}
                                                className="cursor-pointer"
                                            />
                                        </div>
                                        {file && (
                                            <p className="text-xs text-muted-foreground">
                                                Selected: {file.name} ({(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB)
                                            </p>
                                        )}
                                    </div>

                                    {isUploading && (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs">
                                                <span>Uploading...</span>
                                                <span>{Math.round(uploadProgress)}%</span>
                                            </div>
                                            <Progress value={uploadProgress} />
                                            {uploadProgress > 95 && (
                                                <p className="text-xs text-muted-foreground animate-pulse">Finalizing on server...</p>
                                            )}
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="url" className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="urlName">Display Name</Label>
                                        <Input
                                            id="urlName"
                                            placeholder="e.g. Ubuntu 22.04"
                                            value={urlName}
                                            onChange={(e) => setUrlName(e.target.value)}
                                            disabled={isUploading}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="url">ISO URL</Label>
                                        <Input
                                            id="url"
                                            placeholder="https://releases.ubuntu.com/.../ubuntu.iso"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            disabled={isUploading}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Proxmox will download the file directly from this URL.
                                        </p>
                                    </div>

                                    {isUploading && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Triggering download on Proxmox...</span>
                                        </div>
                                    )}
                                </TabsContent>
                            </div>
                        </Tabs>


                        <DialogFooter>
                            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={isUploading}>
                                Cancel
                            </Button>
                            <Button
                                onClick={activeTab === 'file' ? handleUpload : handleUrlDownload}
                                disabled={isUploading || (activeTab === 'file' ? (!file || !isoName) : (!url || !urlName))}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {activeTab === 'file' ? 'Uploading...' : 'Starting Download'}
                                    </>
                                ) : (
                                    <>
                                        {activeTab === 'file' ? <Upload className="mr-2 h-4 w-4" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                                        {activeTab === 'file' ? 'Upload' : 'Download'}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-zinc-800 bg-zinc-950/50">
                <CardHeader className="px-6 py-4 border-b border-zinc-800">
                    <CardTitle className="text-lg">Your Images</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : isos.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <Disc className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No ISOs found. Upload one to get started.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-zinc-800">
                                    <TableHead>Name</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Storage</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isos.map(iso => (
                                    <TableRow key={iso.id} className="border-zinc-800 hover:bg-zinc-900/50">
                                        <TableCell className="font-medium flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-zinc-900 flex items-center justify-center text-zinc-400">
                                                <Disc className="w-4 h-4" />
                                            </div>
                                            {iso.name}
                                        </TableCell>
                                        <TableCell>{formatSize(iso.size)}</TableCell>
                                        <TableCell className="text-muted-foreground">{iso.storage}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(iso.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(iso.id, iso.name)}
                                            >
                                                <Trash2 className="w-4 h-4" />
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
