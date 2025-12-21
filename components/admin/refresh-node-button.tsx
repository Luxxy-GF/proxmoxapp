"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useTransition } from "react"
import { refreshNode } from "@/app/dashboard/admin/actions"

export function RefreshNodeButton({ id }: { id: string }) {
    const [isPending, startTransition] = useTransition()

    return (
        <Button
            variant="ghost"
            size="icon"
            className="hover:bg-muted"
            disabled={isPending}
            onClick={() => {
                startTransition(async () => {
                    await refreshNode(id)
                })
            }}
        >
            <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            <span className="sr-only">Refresh</span>
        </Button>
    )
}
