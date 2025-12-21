"use client"

import { useTransition } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { updateFeatureFlag } from "@/app/dashboard/admin/actions"
import { toast } from "sonner"

interface FeatureToggleProps {
  flagKey: "store_enabled" | "deploy_enabled"
  label: string
  description?: string
  defaultChecked?: boolean
  disabled?: boolean
}

export default function FeatureToggle({ flagKey, label, description, defaultChecked, disabled }: FeatureToggleProps) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base">{label}</Label>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <Switch
          defaultChecked={defaultChecked}
          disabled={pending || disabled}
          onCheckedChange={(checked) => {
            startTransition(async () => {
              const form = new FormData()
              form.set("key", flagKey)
              form.set("enabled", checked ? "true" : "false")
              const res = await updateFeatureFlag(null, form)
              if (res?.error) {
                toast.error(res.error)
              } else {
                toast.success("Settings saved")
              }
            })
          }}
        />
      </div>
    </div>
  )
}
