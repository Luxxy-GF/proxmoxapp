
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import crypto from "crypto";

const installSchema = z.object({
    profileId: z.string(),
    diskLayoutId: z.string().optional(),
    hostname: z.string().min(1),
    rootPassword: z.string().min(6), // We should hash this before storing if feasible, but usually preseed expects hash or cleartext. Let's store cleartext in userDataJson (encrypted at rest ideally) or hash it here if we know the algo.
    // For preseed, we usually need a SHA-512 hash.
    sshKeys: z.array(z.string()).optional(),
});

function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> } // Params is a Promise in Next.js 15
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const data = installSchema.parse(body);

        const server = await prisma.dedicatedServer.findUnique({
            where: { id }
        });

        if (!server) {
            return NextResponse.json({ error: "Server not found" }, { status: 404 });
        }

        // Check if there's already an active install
        const existingInstall = await prisma.pXEInstall.findFirst({
            where: {
                serverId: id,
                state: { in: ['QUEUED', 'RUNNING'] }
            }
        });

        if (existingInstall) {
            return NextResponse.json({ error: "Installation already in progress" }, { status: 409 });
        }

        // Create new install record
        const install = await prisma.pXEInstall.create({
            data: {
                serverId: id,
                profileId: data.profileId,
                diskLayoutId: data.diskLayoutId,
                state: 'QUEUED',
                token: generateToken(),
                userDataJson: {
                    hostname: data.hostname,
                    rootPassword: data.rootPassword, // WARNING: storing cleartext for now, should hash for production security
                    sshKeys: data.sshKeys || []
                },
                progress: 0,
                stage: 'QUEUED'
            }
        });

        // Update server status
        await prisma.dedicatedServer.update({
            where: { id },
            data: {
                status: 'INSTALLING',
                hostname: data.hostname // Update theoretical hostname
            }
        });

        // Optionally trigger restart via IPMI here if integrated
        // await triggerIpmiRestart(server.id);

        return NextResponse.json(install);

    } catch (error) {
        console.error("[INSTALL_POST]", error);
        return NextResponse.json({ error: "Failed to verify install request" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Cancel ALL active installs for this server to ensure clean state
        const { count } = await prisma.pXEInstall.updateMany({
            where: {
                serverId: id,
                state: { in: ['QUEUED', 'RUNNING'] }
            },
            data: {
                state: 'FAILED',
                finishedAt: new Date(),
                logText: "Cancelled by user (Cleanup)" // Note: updateMany cannot append text to existing field easily in Prisma without raw query, so we overwrite or just set it. 
                // To keep it simple and reliable, we just set a message. The previous log is lost but that's acceptable for a cancel/cleanup.
            }
        });

        if (count === 0) {
            return NextResponse.json({ error: "No active installation found" }, { status: 404 });
        }

        // Reset server status
        await prisma.dedicatedServer.update({
            where: { id },
            data: { status: 'ACTIVE' } // Return to active state (or OFFLINE?)
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("[INSTALL_DELETE]", error);
        return NextResponse.json({ error: "Failed to cancel installation" }, { status: 500 });
    }
}
