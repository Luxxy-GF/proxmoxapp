"use client"

import { Button } from "@/components/ui/button"
import { Power, Settings, MoreHorizontal, Activity, Plug, RefreshCw } from "lucide-react"
import { useState, useTransition } from "react"
import { powerAction, assignServerToNode } from "@/app/dashboard/admin/dedicated/actions"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface DedicatedNode {
    id: string;
    name: string;
}

interface DedicatedServerActionsProps {
    server: {
        id: string;
        hostname: string;
        dedicatedNodeId: string | null;
        dedicatedNode?: DedicatedNode | null;
    };
    nodes: DedicatedNode[];
    onUpdate?: () => void;
}

export function DedicatedServerActions({ server, nodes, onUpdate }: DedicatedServerActionsProps) {
    const [isPending, startTransition] = useTransition()
    const [assignOpen, setAssignOpen] = useState(false)
    const [selectedNode, setSelectedNode] = useState<string>(server.dedicatedNodeId || "")

    const handlePower = (action: 'on' | 'off' | 'reset' | 'cycle' | 'status') => {
        toast.promise(
            async () => {
                const res = await powerAction(server.id, action)
                if (res.error) throw new Error(res.error)
                return res
            },
            {
                loading: `Sending Power ${action.toUpperCase()}...`,
                success: (data: any) => {
                    if (action === 'status') return `Status: ${data.data.status}`
                    return `Power ${action} sent successfully`
                },
                error: (err) => `Failed: ${err.message}`
            }
        )
    }

    const handleAssign = () => {
        startTransition(async () => {
            const res = await assignServerToNode(server.id, selectedNode)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Node assigned successfully")
                setAssignOpen(false)
                onUpdate?.()
            }
        })
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Power className="mr-2 h-4 w-4" />
                            Power Control
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => handlePower('on')}>
                                <Plug className="mr-2 h-4 w-4 text-green-500" /> Power On
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePower('off')}>
                                <Plug className="mr-2 h-4 w-4 text-red-500" /> Power Off
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePower('reset')}>
                                <RefreshCw className="mr-2 h-4 w-4 text-orange-500" /> Force Reset
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePower('cycle')}>
                                <Activity className="mr-2 h-4 w-4" /> Power Cycle
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handlePower('status')}>
                                Check Status
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem onClick={() => setAssignOpen(true)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Assign Node
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign to Agent Node</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Select Dedicated Node</Label>
                            <Select value={selectedNode} onValueChange={setSelectedNode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a node..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {nodes.map(node => (
                                        <SelectItem key={node.id} value={node.id}>
                                            {node.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground">
                                This server will be managed by the selected Agent Controller.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssign} disabled={isPending || !selectedNode}>
                            {isPending && <Activity className="mr-2 h-4 w-4 animate-spin" />}
                            Save Assignment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
