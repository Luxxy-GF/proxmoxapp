import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { uploadIsoToStorage, getNodeStatus, getStorage } from "@/lib/proxmox"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const isos = await prisma.iso.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: { node: true }
    })

    // Mask sensitive node data
    const safeIsos = isos.map(iso => ({
        ...iso,
        size: iso.size.toString(), // Serialize BigInt
        node: {
            id: iso.node.id,
            name: iso.node.name
        }
    }))

    return NextResponse.json(safeIsos)
}

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const formData = await req.formData()
        const file = formData.get("file") as File
        const name = formData.get("name") as string
        const nodeId = formData.get("nodeId") as string

        if (!file || !name) {
            return NextResponse.json({ error: "Missing file or name" }, { status: 400 })
        }

        // Validate File Type
        if (!file.name.endsWith(".iso")) {
            return NextResponse.json({ error: "Only .iso files are allowed" }, { status: 400 })
        }

        // Validate Node
        // If nodeId is not provided, pick a default logic or fail?
        // Requirement says "user can upload". We need to know WHERE.
        // Frontend should let user select node or we default to first online.
        // Let's assume we pick a node if not provided, or better, Require it?
        // For simplicity, let's pick the first online node if not provided, 
        // OR better, we should probably just pick a node that has ISO storage.

        let targetNodeId = nodeId
        if (!targetNodeId) {
            const onlineNode = await prisma.node.findFirst({ where: { status: 'Online' } })
            if (!onlineNode) return NextResponse.json({ error: "No online infrastructure nodes found" }, { status: 503 })
            targetNodeId = onlineNode.id
        }

        const node = await prisma.node.findUnique({ where: { id: targetNodeId } })
        if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 })

        // Find Storage
        // We need a storage that supports 'iso'. 
        // Default to 'local' if available, otherwise search.
        const storageList = await getStorage(node)
        const isoStorage = storageList.find((s: any) => s.content.includes('iso') && s.type === 'dir') ||
            storageList.find((s: any) => s.content.includes('iso'))

        if (!isoStorage) {
            return NextResponse.json({ error: "No ISO storage found on this node" }, { status: 503 })
        }

        const storageName = isoStorage.storage

        // Note: Proxmox `filename` param in upload is strictly the filename, NOT path.
        // It will land in .../template/iso/filename.iso
        const storageFilename = file.name

        await uploadIsoToStorage(node, storageName, storageFilename, file)

        // Create DB Record
        const iso = await prisma.iso.create({
            data: {
                name: name,
                filename: storageFilename, // Store the actual filename on disk
                size: BigInt(file.size), // Prisma BigInt
                status: "READY",
                storage: storageName,
                nodeId: node.id,
                userId: session.user.id,
                description: `Uploaded via Lumen`
            }
        })

        // Handle BigInt serialization for JSON
        const responseIso = {
            ...iso,
            size: iso.size.toString()
        }

        return NextResponse.json(responseIso)

    } catch (error: any) {
        console.error("ISO Upload Error:", error)
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
    }
}
