
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from 'crypto';
import { runIpmiCommand, runIpmiCommandWithRetry } from "@/lib/baremetal/ipmi";
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

                // Create credentials object
                const creds = {
                    host: ipmiConfig.host,
                    user: ipmiConfig.user,
                    pass: ipmiConfig.pass
                };

                // 3. FORCE OFF FIRST (Clean Slate)
                // If the server is ON, turn it OFF and wait.
                // This ensures the BMC is in a consistent state to accept boot flags.
                const powerStatus = await runIpmiCommandWithRetry(creds, ['chassis', 'power', 'status'], 2, 1000);
                const isOff = powerStatus.output?.toLowerCase().includes('is off');

                if (!isOff) {
                    await runIpmiCommandWithRetry(creds, ['chassis', 'power', 'off'], 3, 2000);
                    // Wait up to 20 seconds for it to actually turn off
                    const turnedOff = await import("@/lib/baremetal/ipmi").then(m => m.waitForPowerStatus(creds, 'off', 10, 2000));
                    if (!turnedOff) {
                        throw new Error("Failed to power off server for reinstall preparation");
                    }
                }

                // 4. Set bootdev to PXE (now that it's off)
                await runIpmiCommandWithRetry(creds, ['chassis', 'bootdev', 'pxe'], 3, 2000);

                // Wait for BMC to process the boot flag
                await new Promise(resolve => setTimeout(resolve, 3000));

                // 5. Power ON (Cold Boot)
                await runIpmiCommandWithRetry(creds, ['chassis', 'power', 'on'], 3, 2000);

                await logDedicatedEvent(server.id, 'POWER', 'Triggered clean reinstall (Force OFF -> Set PXE -> Power ON)');
            } catch (e: any) {
                console.error("Failed to execute IPMI actions for reinstall", e);
                // Don't fail the request, but log it.
                await logDedicatedEvent(server.id, 'ERROR', `Failed to auto-restart via IPMI: ${e.message || e}`);
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
