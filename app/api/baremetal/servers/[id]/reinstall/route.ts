
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from 'crypto';
import { runIpmiCommand } from "@/lib/baremetal/ipmi";
import { decrypt } from "@/lib/baremetal/encryption";
import { logDedicatedEvent } from "@/lib/baremetal/utils";

const reinstallSchema = z.object({
    profileId: z.string(),
    diskLayoutId: z.string().optional(),
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
        const { profileId, diskLayoutId } = reinstallSchema.parse(json);

        const server = await prisma.dedicatedServer.findUnique({
            where: { id },
            include: {
                assignments: {
                    include: { connection: true }
                }
            }
        });

        if (!server) {
            return new NextResponse("Not Found", { status: 404 });
        }

        if (session.user.role !== "ADMIN" && server.userId !== session.user.id) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Validations: Check if profile exists, etc.

        // 1. Queue PXE Install
        const token = crypto.randomBytes(32).toString('hex');
        await prisma.pXEInstall.create({
            data: {
                serverId: server.id,
                profileId,
                diskLayoutId,
                state: 'QUEUED',
                token
            }
        });

        await logDedicatedEvent(server.id, 'INSTALL', `Reinstall queued (Profile: ${profileId}) by ${session.user.name}`);

        // 2. Set IPMI to PXE boot
        const ipmiAssignment = server.assignments.find(a => a.connection.type === 'IPMI');
        if (ipmiAssignment && ipmiAssignment.connection.encryptedConfig) {
            try {
                // Decrypt config
                const decryptedJson = decrypt(ipmiAssignment.connection.encryptedConfig);
                const ipmiConfig = JSON.parse(decryptedJson);

                await runIpmiCommand({
                    host: ipmiConfig.host,
                    user: ipmiConfig.user,
                    pass: ipmiConfig.pass
                }, ['chassis', 'bootdev', 'pxe']);

                // 3. Power Cycle
                // 3. Smart Power Control
                const result = await runIpmiCommand({
                    host: ipmiConfig.host,
                    user: ipmiConfig.user,
                    pass: ipmiConfig.pass
                }, ['chassis', 'power', 'status']);

                const isOff = result.output?.toLowerCase().includes('is off');

                if (isOff) {
                    await runIpmiCommand({
                        host: ipmiConfig.host,
                        user: ipmiConfig.user,
                        pass: ipmiConfig.pass
                    }, ['chassis', 'power', 'on']);
                } else {
                    await runIpmiCommand({
                        host: ipmiConfig.host,
                        user: ipmiConfig.user,
                        pass: ipmiConfig.pass
                    }, ['chassis', 'power', 'reset']);
                }

                await logDedicatedEvent(server.id, 'POWER', 'Triggered PXE boot and power cycle for reinstall');
            } catch (e) {
                console.error("Failed to execute IPMI actions for reinstall", e);
                // Don't fail the request, but log it. User might need to manually power cycle.
                await logDedicatedEvent(server.id, 'ERROR', 'Failed to auto-restart via IPMI. Manual reboot required.');
            }
        } else {
            await logDedicatedEvent(server.id, 'PXE', 'No IPMI connection found. Manual reboot required to start install.');
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse(JSON.stringify(error.errors), { status: 400 });
        }
        console.error("[BAREMETAL_REINSTALL_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
