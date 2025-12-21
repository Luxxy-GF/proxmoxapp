import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { encrypt } from "@/lib/encryption"
import { auth } from "@/auth"

export async function GET(req: NextRequest) {
    const session = await auth()
    // Check admin role here
    // if (session?.user?.role !== 'ADMIN') return ...

    const nodes = await prisma.node.findMany({
        select: {
            id: true,
            name: true,
            address: true,
            proxmoxId: true,
            endpoint: true,
            status: true,
            cpuUsage: true,
            ramUsage: true,
            diskUsage: true,
            // Do NOT return secrets
        }
    })
    return NextResponse.json(nodes)
}

export async function POST(req: NextRequest) {
    const session = await auth()
    // Check admin role here

    try {
        const body = await req.json()
        const { name, address, proxmoxId, endpoint, tokenId, tokenSecret } = body

        const encryptedTokenId = encrypt(tokenId)
        const encryptedTokenSecret = encrypt(tokenSecret)

        const node = await prisma.node.create({
            data: {
                name,
                address,
                proxmoxId,
                endpoint,
                tokenId: encryptedTokenId,
                tokenSecret: encryptedTokenSecret,
                status: "Online" // Assume online initially, polling will update
            }
        })

        return NextResponse.json(node)
    } catch (error) {
        console.error(error)
        return new NextResponse("Error creating node", { status: 500 })
    }
}
