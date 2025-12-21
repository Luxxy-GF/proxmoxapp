"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, Plus, Save, GripVertical, Image as ImageIcon } from "lucide-react"
import { createTemplateGroup, createTemplate, deleteTemplateGroup, deleteTemplate, updateTemplate, updateTemplateGroup } from "@/app/dashboard/admin/templates/actions"

interface Template {
    id: string
    name: string
    vmid: number
    image: string | null
}

interface TemplateGroup {
    id: string
    name: string
    templates: Template[]
}

export function TemplateManager({ initialGroups }: { initialGroups: TemplateGroup[] }) {
    const [isPending, setIsPending] = useState(false)

    // Handlers
    const handleAddGroup = async () => {
        setIsPending(true)
        await createTemplateGroup("New Group")
        setIsPending(false)
    }

    const handleDeleteGroup = async (id: string) => {
        if (!confirm("Delete this group and all its templates?")) return
        setIsPending(true)
        await deleteTemplateGroup(id)
        setIsPending(false)
    }

    const handleGroupNameChange = async (id: string, name: string) => {
        // Debounce or just save on blur? For now, we'll expose a save method or auto-save on blur.
        // Let's rely on onBlur to save to DB.
        await updateTemplateGroup(id, name)
    }

    const handleAddTemplate = async (groupId: string) => {
        setIsPending(true)
        // Defaults: Name="New Template", VMID=0
        await createTemplate(groupId, "New Template", 0)
        setIsPending(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Templates</h2>
                <Button onClick={handleAddGroup} disabled={isPending}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add group
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {initialGroups.map((group) => (
                    <GroupCard
                        key={group.id}
                        group={group}
                        onDeleteGroup={handleDeleteGroup}
                        onSaveGroupName={handleGroupNameChange}
                        onAddTemplate={handleAddTemplate}
                    />
                ))}
            </div>

            {/* Save All button provided in design, but we can do real-time actions. 
                I'll allow individual saves for now as per "Save" button in screenshot.
            */}
        </div>
    )
}

function GroupCard({ group, onDeleteGroup, onSaveGroupName, onAddTemplate }: {
    group: TemplateGroup,
    onDeleteGroup: (id: string) => void,
    onSaveGroupName: (id: string, name: string) => void,
    onAddTemplate: (groupId: string) => void
}) {
    return (
        <Card className="bg-zinc-950 border-zinc-900">
            <CardHeader className="flex flex-row items-center space-y-0 gap-2 pb-2">
                <Input
                    defaultValue={group.name}
                    className="bg-transparent border-transparent hover:border-zinc-800 focus:border-ring font-semibold text-lg p-0 h-auto"
                    onBlur={(e) => onSaveGroupName(group.id, e.target.value)}
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 ml-auto"
                    onClick={() => onDeleteGroup(group.id)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {group.templates.map((template) => (
                    <TemplateRow key={template.id} template={template} />
                ))}

                <div className="flex justify-end pt-2">
                    <Button variant="outline" size="sm" onClick={() => onAddTemplate(group.id)}>
                        Add template
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function TemplateRow({ template }: { template: Template }) {
    const [isEditing, setIsEditing] = useState(false)

    // Local state for editing before save
    const [name, setName] = useState(template.name)
    const [vmid, setVmid] = useState(template.vmid)
    const [image, setImage] = useState(template.image || "")

    const handleSave = async () => {
        setIsEditing(true)
        await updateTemplate(template.id, { name, vmid: Number(vmid), image })
        setIsEditing(false)
    }

    const handleDelete = async () => {
        if (!confirm("Delete template?")) return
        await deleteTemplate(template.id)
    }

    // Determine icon color/opacity based on if image URL is set
    const hasImage = !!image && image.length > 0

    return (
        <div className="space-y-2 p-2 rounded-md bg-zinc-900/50 border border-zinc-900/50 hover:border-zinc-800 transition-colors">
            <div className="flex items-center gap-2">
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 bg-zinc-950 border-zinc-800"
                    placeholder="Name (e.g. 20.04)"
                    onBlur={handleSave}
                />
                {/* Image URL Toggle/Input */}
                <div className="relative group">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <GripVertical className="h-4 w-4" />
                    </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-900/50 hover:text-red-500 hover:bg-red-950/30" onClick={handleDelete}>
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <Input
                    value={vmid}
                    onChange={(e) => setVmid(Number(e.target.value))}
                    className="h-8 bg-zinc-950 border-zinc-800 w-24"
                    placeholder="VMID"
                    type="number"
                    onBlur={handleSave}
                />
                <Input
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    className="h-8 bg-zinc-950 border-zinc-800 flex-1"
                    placeholder="Logo URL (https://...)"
                    onBlur={handleSave}
                />
                {hasImage && <img src={image} alt="logo" className="w-6 h-6 object-contain rounded-sm bg-white/5 p-0.5" />}
            </div>
        </div>
    )
}
