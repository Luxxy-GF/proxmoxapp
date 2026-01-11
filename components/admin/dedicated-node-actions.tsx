"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw, MoreHorizontal, Trash2 } from "lucide-react"
import { useTransition } from "react"
import { refreshDedicatedNodeStatus } from "@/app/dashboard/admin/dedicated/actions"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function DedicatedNodeActions({ id }: { id: string }) {
    const [isPending, startTransition] = useTransition()

    const handleRefresh = () => {
        startTransition(async () => {
            const result = await refreshDedicatedNodeStatus(id)
            if (result.error) {
                toast.error("Status Check Failed", { description: result.error })
            } else {
                toast.success(`Node is ${result.status}`)
            }
        })
    }

    // TODO: Implement Delete
    const handleDelete = () => {
        toast.info("Delete functionality coming soon")
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleRefresh} disabled={isPending}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                    Refresh Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Node
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
