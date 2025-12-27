
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encrypt } from "@/lib/baremetal/encryption";

const createConnectionSchema = z.object({
    type: z.enum(['IPMI', 'DHCP', 'PXE']),
    name: z.string().min(1),
    description: z.string().optional(),
    config: z.record(z.any()), // JSON config to be encrypted
    agentId: z.string().optional(),
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const json = await req.json();
        const body = createConnectionSchema.parse(json);

        // Encrypt the config
        const encryptedConfig = encrypt(JSON.stringify(body.config));

        const connection = await prisma.connection.create({
            data: {
                type: body.type,
                name: body.name,
                description: body.description,
                encryptedConfig,
                agentId: body.agentId,
            },
        });

        // Return without sensitive config
        return NextResponse.json({
            id: connection.id,
            type: connection.type,
            name: connection.name,
            description: connection.description
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse(JSON.stringify(error.errors), { status: 400 });
        }
        console.error("[BAREMETAL_CONNECTIONS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const connections = await prisma.connection.findMany({
            select: {
                id: true,
                type: true,
                name: true,
                description: true,
                agentId: true,
                enabled: true,
                createdAt: true,
                // Exclude encryptedConfig
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(connections);
    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
