import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";


const createNodeSchema = z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    location: z.string().optional(),
    description: z.string().optional(),
    port: z.number().default(3000),
    apiKey: z.string().optional(),
});

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const nodes = await prisma.dedicatedNode.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                _count: {
                    select: { servers: true }
                }
            }
        });

        return NextResponse.json(nodes);
    } catch (error) {
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
        const body = createNodeSchema.parse(json);

        // Generate a secure token for the agent
        const tokenSecret = crypto.randomUUID();

        const node = await prisma.dedicatedNode.create({
            data: {
                name: body.name,
                address: body.address,
                location: body.location,
                description: body.description,
                port: body.port,
                apiKey: body.apiKey,
                tokenSecret: tokenSecret,
                status: 'OFFLINE'
            }
        });

        return NextResponse.json(node);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse(JSON.stringify(error.errors), { status: 400 });
        }
        return new NextResponse("Internal Error", { status: 500 });
    }
}
