
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createServerSchema = z.object({
    hostname: z.string().min(1),
    macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "Invalid MAC address"),
    nodeId: z.string().optional(),
    rack: z.string().optional(),
});

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const isAdmin = session.user.role === "ADMIN";

        const servers = await prisma.dedicatedServer.findMany({
            where: isAdmin ? {} : { userId: session.user.id },
            include: {
                hardware: true,
                dedicatedNode: true,
                user: {
                    select: { name: true, email: true }
                },
                installs: {
                    where: { state: { in: ['QUEUED', 'RUNNING'] } },
                    orderBy: { startedAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(servers);
    } catch (error) {
        console.error("[BAREMETAL_SERVERS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const json = await req.json();
        const body = createServerSchema.parse(json);

        const server = await prisma.dedicatedServer.create({
            data: {
                hostname: body.hostname,
                macAddress: body.macAddress,
                nodeId: body.nodeId,
                rack: body.rack,
                status: 'OFFLINE',
                hardware: {
                    create: {
                        cpuModel: 'Unknown',
                        cpuCores: 0,
                        ramMiB: 0
                    }
                }
            },
        });

        return NextResponse.json(server);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse(JSON.stringify(error.errors), { status: 400 });
        }
        console.error("[BAREMETAL_SERVERS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
