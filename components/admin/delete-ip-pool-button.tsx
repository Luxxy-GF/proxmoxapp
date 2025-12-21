"use client"

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useTransition } from "react"
import { deleteIPPool } from "@/app/dashboard/admin/networking/actions"

export function DeleteIPPoolButton({ id, disabled }: { id: string, disabled?: boolean }) {
    const [isPending, startTransition] = useTransition()

    return (
        <Button
            variant="ghost"
            size="icon"
            disabled={disabled || isPending}
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
                if (confirm("Are you sure you want to delete this specific IP pool? This action cannot be undone.")) {
                    startTransition(async () => {
                        await deleteIPPool(id)
                    })
                }
            }}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    )
}
