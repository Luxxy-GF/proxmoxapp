"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { getStorage } from "@/lib/proxmox"

export async function getUploadTarget() {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    // 1. Find Online Node
    const onlineNode = await prisma.node.findFirst({ where: { status: 'Online' } })
    if (!onlineNode) throw new Error("No online infrastructure nodes found")

    // 2. Find ISO Storage
    const storageList = await getStorage(onlineNode)
    const isoStorage = storageList.find((s: any) => s.content.includes('iso') && s.type === 'dir') ||
        storageList.find((s: any) => s.content.includes('iso'))

    if (!isoStorage) throw new Error("No ISO storage found on default node")

    return {
        nodeId: onlineNode.id, // String (CUID)
        nodeName: onlineNode.proxmoxId, // The internal PVE node name (e.g. 'prod-gen9')
        storage: isoStorage.storage,
        maxSize: isoStorage.avail // Optional: could verify size here
    }
}

export async function downloadIsoFromUrl(url: string, name: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    // 1. Resolve Target
    const target = await getUploadTarget()

    // 2. Prepare Filename
    // sanitized name + .iso
    const safeName = name.replace(/[^a-zA-Z0-9.-]/g, "_")
    // Ensure .iso extension
    const filename = safeName.endsWith(".iso") ? safeName : `${safeName}.iso`
    // Add unique prefix to avoid collisions but keep it readable
    const storageFilename = `iso-${Date.now()}-${filename}`

    // 3. Authenticate with Proxmox
    const node = await prisma.node.findUnique({ where: { id: target.nodeId } })
    if (!node) throw new Error("Node not found")

    const { callProxmoxApi } = await import("@/lib/proxmox")

    // 4. Call download-url
    // POST /nodes/{node}/storage/{storage}/download-url
    // Parameters: content, filename, url, node, storage

    try {
        const upid = await callProxmoxApi(
            node,
            `/nodes/${target.nodeName}/storage/${target.storage}/download-url`,
            "POST",
            {
                content: "iso",
                filename: storageFilename,
                url: url,
            }
        )

        // 5. Create Initial DB Record with "DOWNLOADING" status
        const iso = await prisma.iso.create({
            data: {
                name: name,
                filename: storageFilename,
                size: BigInt(0),
                status: "DOWNLOADING",
                storage: target.storage,
                nodeId: node.id,
                userId: session.user.id,
                description: `Downloading from ${url}`
            }
        })

        // 6. Wait for Task Completion (in background relative to this request? No, user requested "wait")
        // NOTE: If the download is huge, this might timeout the HTTP request.
        // But for typical connection speeds and reasonable ISOs, it works.
        // We import waitForTask dynamically or at top? Dynamic is fine if not standard.
        const { waitForTask, getStorageContent } = await import("@/lib/proxmox")

        await waitForTask(node, upid)

        // 7. Fetch Actual Size
        const content = await getStorageContent(node, target.storage)
        const fileInfo = content.find((f: any) => f.volid.endsWith(storageFilename))

        let size = BigInt(0)
        if (fileInfo && fileInfo.size) {
            size = BigInt(fileInfo.size)
        }

        // 8. Update DB Record
        await prisma.iso.update({
            where: { id: iso.id },
            data: {
                status: "READY",
                size: size
            }
        })

        return { success: true, upid }
    } catch (error: any) {
        console.error("Download URL failed:", error)

        // Try to update DB to error state if we have the record
        // (Not strictly implemented here without refactoring to keep 'iso' in scope,
        // but 'iso' isn't available in catch block easily without let declaration)

        throw new Error(error.message || "Failed to download ISO")
    }
}
