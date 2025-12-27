
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encrypt } from "@/lib/baremetal/encryption";
import { regenerateDnsmasqConfig } from "@/lib/pxe";

const updateServerSchema = z.object({
    hostname: z.string().min(1).optional(),
    primaryIpv4: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, "Invalid IPv4").optional().nullable(),
    gateway: z.string().optional().nullable(),
    netmask: z.string().optional().nullable(),
    nameservers: z.string().optional().nullable(),
    vlanId: z.number().int().optional().nullable(),
    rack: z.string().optional().nullable(),
    userId: z.string().optional().nullable(), // For admin assignment
    ipmiHost: z.string().optional(),
    ipmiUser: z.string().optional(),
    ipmiPass: z.string().optional(),
});

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    try {
        const server = await prisma.dedicatedServer.findUnique({
            where: { id },
            include: {
                hardware: true,
                assignments: {
                    include: {
                        connection: {
                            select: {
                                id: true,
                                type: true,
                                name: true,
                                description: true,
                                enabled: true
                                // Exclude encryptedConfig
                            }
                        }
                    }
                },
                installs: {
                    orderBy: { startedAt: 'desc' },
                    take: 5
                },
                events: {
                    orderBy: { createdAt: 'desc' },
                    take: 20
                }
            }
        });

        if (!server) {
            return new NextResponse("Not Found", { status: 404 });
        }

        // Role check
        if (session.user.role !== "ADMIN" && server.userId !== session.user.id) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        return NextResponse.json(server);
    } catch (error) {
        console.error("[BAREMETAL_SERVER_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    // Only admins can edit server core details for now
    if (!session?.user || session.user.role !== "ADMIN") {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const { id } = await params;

    try {
        const json = await req.json();
        const body = updateServerSchema.parse(json);

        const { ipmiHost, ipmiUser, ipmiPass, ...serverData } = body;

        // Transactional update to handle server data and IPMI connection safely
        const server = await prisma.$transaction(async (tx) => {
            // 1. Update Server Data
            const updatedServer = await tx.dedicatedServer.update({
                where: { id },
                data: serverData,
            });

            // 2. Handle IPMI Config if provided
            if (ipmiHost && ipmiUser && ipmiPass) {
                // Check if we already have an IPMI assignment
                const existingAssignment = await tx.connectionAssignment.findFirst({
                    where: {
                        serverId: id,
                        connection: { type: 'IPMI' }
                    },
                    include: { connection: true }
                });

                const encryptedConfig = encrypt(JSON.stringify({
                    host: ipmiHost,
                    user: ipmiUser,
                    pass: ipmiPass
                }));

                if (existingAssignment) {
                    // Update existing connection
                    await tx.connection.update({
                        where: { id: existingAssignment.connectionId },
                        data: {
                            encryptedConfig,
                            name: `IPMI for ${updatedServer.hostname}` // Keep name synced
                        }
                    });
                } else {
                    // Create new connection and assign
                    const newConn = await tx.connection.create({
                        data: {
                            type: 'IPMI',
                            name: `IPMI for ${updatedServer.hostname}`,
                            encryptedConfig,
                            enabled: true
                        }
                    });
                    await tx.connectionAssignment.create({
                        data: {
                            serverId: id,
                            connectionId: newConn.id,
                            role: 'PRIMARY'
                        }
                    });
                }
            }
            return updatedServer;
        });

        // Trigger DHCP Update if primary IP changed (or just always to be safe/simple)
        if (body.primaryIpv4 !== undefined) {
            await regenerateDnsmasqConfig();
        }

        return NextResponse.json(server);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse(JSON.stringify(error.errors), { status: 400 });
        }
        console.error("[BAREMETAL_SERVER_PATCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
