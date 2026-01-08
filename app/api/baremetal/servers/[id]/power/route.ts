
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
        // Log event (Skip status checks, only log changes/control actions)
        if (action !== 'status') {
            const severity = result.success ? 'INFO' : 'ERROR';
            const msg = result.success
                ? `Power ${action} initiated by ${session.user.email}`
                : `Power ${action} failed: ${result.error || 'Check IPMI connectivity'}`;

            await logDedicatedEvent(server.id, 'POWER', msg, {
                action,
                output: result.output,
                error: result.error
            }, severity);
        }

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
        // Fetch server and IPMI connections
        const server = await prisma.dedicatedServer.findUnique({
            where: { id },
            include: {
                assignments: {
                    where: { connection: { type: 'IPMI', enabled: true } },
                    include: { connection: true },
                    orderBy: { role: 'asc' }
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
            // Return 'unknown' instead of error for UI status check
            return NextResponse.json({ status: 'unknown', error: "No IPMI connection assigned" });
        }

        // Decrypt config
        let ipmiConfig;
        try {
            const decryptedJson = decrypt(ipmiAssignment.connection.encryptedConfig);
            ipmiConfig = JSON.parse(decryptedJson);
        } catch (e) {
            console.error("Failed to decrypt IPMI config", e);
            return NextResponse.json({ status: 'unknown', error: "Configuration Error" });
        }

        // Execute IPMI command
        const result = await runIpmiCommand({
            host: ipmiConfig.host,
            user: ipmiConfig.user,
            pass: ipmiConfig.pass
        }, ['chassis', 'power', 'status']);

        if (!result.success) {
            return NextResponse.json({ status: 'unknown', error: result.error });
        }

        // Parse: "Chassis Power is on" or "Chassis Power is off"
        const output = result.output.toLowerCase();
        const isOn = output.includes("power is on");

        return NextResponse.json({
            status: isOn ? 'on' : 'off',
            raw: result.output.trim()
        });

    } catch (error) {
        console.error("[BAREMETAL_POWER_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
