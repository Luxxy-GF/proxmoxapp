"use client"

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useTransition } from "react"
import { deleteProduct } from "@/app/dashboard/admin/actions"

export function DeleteProductButton({ id, disabled }: { id: string, disabled: boolean }) {
    const [isPending, startTransition] = useTransition()

    return (
        <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
            disabled={disabled || isPending}
            onClick={() => {
                if (confirm("Are you sure you want to delete this product?")) {
                    startTransition(async () => {
                        await deleteProduct(id)
                    })
                }
            }}
        >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
        </Button>
    )
}
