"use client"

import { Button } from "@/components/ui/button"
import { Play, Square, Pause, Trash2, Power } from "lucide-react"
import { useTransition } from "react"
import { adminServerAction } from "@/app/dashboard/admin/actions"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AdminServerActions({ id, status }: { id: string, status: string }) {
    const [isPending, startTransition] = useTransition()

    const handleAction = (action: "start" | "stop" | "suspend" | "resume" | "delete") => {
        if (action === 'delete') {
            if (!confirm("Are you sure you want to FORCE DELETE this server? This is destructive and irreversible.")) return
        }
        startTransition(async () => {
            await adminServerAction(id, action)
        })
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isPending}>
                    <Power className="h-4 w-4 mr-2" />
                    Actions
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Power Control</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleAction("start")}>
                    <Play className="mr-2 h-4 w-4" /> Start
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction("stop")}>
                    <Square className="mr-2 h-4 w-4" /> Stop
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction("suspend")}>
                    <Pause className="mr-2 h-4 w-4" /> Suspend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction("resume")}>
                    <Play className="mr-2 h-4 w-4" /> Resume
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleAction("delete")}>
                    <Trash2 className="mr-2 h-4 w-4" /> Force Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
