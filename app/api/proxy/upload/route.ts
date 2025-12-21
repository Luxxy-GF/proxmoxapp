import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import { getStorage } from "@/lib/proxmox"
import { NextRequest, NextResponse } from "next/server"
// Force refresh 1

// Max execution time for this route (if platform supports it)
export const maxDuration = 300 // 5 minutes

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const searchParams = req.nextUrl.searchParams
        const name = searchParams.get("name")
        const sizeStr = searchParams.get("size")
        const filename = searchParams.get("filename")
        const nodeName = searchParams.get("nodeName")
        const storageParam = searchParams.get("storage")
        const nodeIdParam = searchParams.get("nodeId")

        if (!name || !sizeStr || !filename || !nodeName || !storageParam || !nodeIdParam) {
            return NextResponse.json({ error: "Missing metadata or routing info" }, { status: 400 })
        }

        // 1. Resolve Specific Node (Verify it exists and is online)
        // Node ID is CUID (String), do not parse as Int
        const onlineNode = await prisma.node.findUnique({
            where: { id: nodeIdParam }
        })

        if (!onlineNode || onlineNode.status !== 'Online') {
            return NextResponse.json({ error: "Target node not found or offline" }, { status: 503 })
        }

        // 2. Prepare Upstream Request using the Passed Params
        // We trust the client has put these same values in the Body (which we piped)
        const storageName = storageParam
        const apiPath = `/nodes/${onlineNode.proxmoxId}/storage/${storageName}/upload`
        const targetUrl = `${onlineNode.endpoint}${apiPath}`.replace(/([^:])\/\/+/g, "$1/")

        const tokenId = decrypt(onlineNode.tokenId)
        const tokenSecret = decrypt(onlineNode.tokenSecret)

        // 3. Proxy the Stream using native fetch with Undici dispatcher
        // This provides the best of both worlds: streaming support and SSL control
        const { Agent, fetch: undiciFetch } = require("undici")

        const contentType = req.headers.get("content-type")
        const contentLength = req.headers.get("content-length")

        if (!contentType) return NextResponse.json({ error: "Missing Content-Type" }, { status: 400 })
        console.log(`[Proxy] Starting upload. Type: ${contentType}, Length: ${contentLength}`)

        const { Readable } = require("stream")
        const { pipeline } = require("stream")

        // @ts-ignore
        const nodeStream = Readable.fromWeb(req.body)

        return new Promise<NextResponse>((resolve) => {
            const lib = targetUrl.startsWith("https") ? require("https") : require("http")

            // Forward relevant headers
            const headers: any = {
                "Authorization": `PVEAPIToken=${tokenId}=${tokenSecret}`,
                "Content-Type": contentType,
                "Content-Length": contentLength,
            }

            // Copy other useful headers, but skip strict ones
            const excludedHeaders = ['host', 'connection', 'content-length', 'content-type', 'authorization', 'cookie']
            req.headers.forEach((value, key) => {
                if (!excludedHeaders.includes(key.toLowerCase())) {
                    headers[key] = value
                }
            })

            const options = {
                method: "POST",
                headers: headers,
                rejectUnauthorized: false,
            }

            const proxyReq = lib.request(targetUrl, options, (proxyRes: any) => {
                let responseBody = ""
                proxyRes.on("data", (chunk: any) => { responseBody += chunk })
                proxyRes.on("end", async () => {
                    console.log(`[Proxy] Response: ${proxyRes.statusCode} ${proxyRes.statusMessage}`)

                    if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
                        try {
                            const iso = await prisma.iso.create({
                                data: {
                                    name: name,
                                    filename: filename,
                                    size: BigInt(sizeStr),
                                    status: "READY",
                                    storage: storageName,
                                    nodeId: onlineNode.id,
                                    userId: session.user.id!,
                                    description: "Uploaded via Proxy"
                                }
                            })

                            resolve(NextResponse.json({
                                success: true,
                                iso: { ...iso, size: iso.size.toString() }
                            }))
                        } catch (dbError: any) {
                            console.error("DB Error after upload:", dbError)
                            resolve(NextResponse.json({ error: "Upload succeeded but DB failed: " + dbError.message }, { status: 500 }))
                        }
                    } else {
                        console.error("Proxmox Upload Failed:", proxyRes.statusCode, responseBody)
                        resolve(NextResponse.json({
                            error: `Proxmox Rejected (${proxyRes.statusCode}): ${responseBody}`,
                            details: responseBody
                        }, { status: proxyRes.statusCode || 500 }))
                    }
                })
            })

            proxyReq.on("error", (err: any) => {
                console.error("Proxy Request Error:", err)
                resolve(NextResponse.json({ error: "Proxy connection failed: " + err.message }, { status: 502 }))
            })

            // Use pipeline for better error handling (though req is not standard stream, pipe is okay)
            // Pipe the data
            nodeStream.pipe(proxyReq)
        })

    } catch (e: any) {
        console.error("Proxy Upload Error:", e)
        return NextResponse.json({ error: e.message || "Upload Proxy Failed" }, { status: 500 })
    }
}
