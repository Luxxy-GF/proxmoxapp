"use client"

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useTransition } from "react"
import { deleteNode } from "@/app/dashboard/admin/actions"

export function DeleteNodeButton({ id, disabled }: { id: string, disabled: boolean }) {
    const [isPending, startTransition] = useTransition()

    return (
        <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
            disabled={disabled || isPending}
            onClick={() => {
                if (confirm("Are you sure you want to delete this node? This cannot be undone.")) {
                    startTransition(async () => {
                        await deleteNode(id)
                    })
                }
            }}
        >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
        </Button>
    )
}
