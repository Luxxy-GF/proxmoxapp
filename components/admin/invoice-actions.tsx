"use client"

import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import { updateInvoiceStatus } from "@/app/dashboard/admin/actions"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTransition } from "react"

export function InvoiceActions({ id, status }: { id: string, status: string }) {
    const [isPending, startTransition] = useTransition()

    const handleStatus = (newStatus: "PAID" | "CANCELLED" | "UNPAID") => {
        startTransition(async () => {
            await updateInvoiceStatus(id, newStatus)
        })
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
                <DropdownMenuItem onClick={() => handleStatus('PAID')}>Mark Paid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatus('UNPAID')}>Mark Unpaid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatus('CANCELLED')}>Cancel Invoice</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
