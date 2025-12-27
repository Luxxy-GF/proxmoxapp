
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { decrypt } from "@/lib/baremetal/encryption";
import { runIpmiCommand, PowerState } from "@/lib/baremetal/ipmi";
import { logDedicatedEvent } from "@/lib/baremetal/utils";

const powerActionSchema = z.object({
    action: z.enum(['on', 'off', 'cycle', 'reset', 'soft', 'status']),
});

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    try {
        const json = await req.json();
        const { action } = powerActionSchema.parse(json);

        // Fetch server and IPMI connections
        const server = await prisma.dedicatedServer.findUnique({
            where: { id },
            include: {
                assignments: {
                    where: { connection: { type: 'IPMI', enabled: true } },
                    include: { connection: true },
                    orderBy: { role: 'asc' } // PRIMARY first
                }
            }
        });

        if (!server) {
            return new NextResponse("Not Found", { status: 404 });
        }

        // Auth check
        if (session.user.role !== "ADMIN" && server.userId !== session.user.id) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Check for IPMI connection
        const ipmiAssignment = server.assignments[0];
        if (!ipmiAssignment || !ipmiAssignment.connection.encryptedConfig) {
            return NextResponse.json({ error: "No IPMI connection assigned" }, { status: 400 });
        }

        // Decrypt config
        let ipmiConfig;
        try {
            const decryptedJson = decrypt(ipmiAssignment.connection.encryptedConfig);
            ipmiConfig = JSON.parse(decryptedJson);
        } catch (e) {
            console.error("Failed to decrypt IPMI config", e);
            return new NextResponse("Configuration Error", { status: 500 });
        }

        // Execute IPMI command
        // TODO: Handle remote agent if agentId is present
        const result = await runIpmiCommand({
            host: ipmiConfig.host,
            user: ipmiConfig.user,
            pass: ipmiConfig.pass
        }, ['chassis', 'power', action]);

        // Log event
        await logDedicatedEvent(server.id, 'POWER', `Power ${action} requested by ${session.user.name || session.user.email}`, {
            action,
            success: result.success,
            output: result.output,
            error: result.error
        });

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        }

        return NextResponse.json({ success: true, output: result.output });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse(JSON.stringify(error.errors), { status: 400 });
        }
        console.error("[BAREMETAL_POWER_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
