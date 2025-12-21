"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState, useTransition } from "react"
import { updateUserBalance } from "@/app/dashboard/admin/actions"
import { Check } from "lucide-react"

export function UserBalanceForm({ userId, balance }: { userId: string, balance: number }) {
    const [val, setVal] = useState(balance)
    const [isPending, startTransition] = useTransition()
    const [changed, setChanged] = useState(false)

    const handleSave = () => {
        startTransition(async () => {
            await updateUserBalance(userId, Number(val))
            setChanged(false)
        })
    }

    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <span className="absolute left-2 top-2.5 text-muted-foreground text-xs">$</span>
                <Input
                    type="number"
                    value={val}
                    onChange={(e) => { setVal(Number(e.target.value)); setChanged(true); }}
                    className="w-24 pl-4 h-8"
                />
            </div>
            {changed && (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave} disabled={isPending}>
                    <Check className="h-4 w-4 text-green-500" />
                </Button>
            )}
        </div>
    )
}
