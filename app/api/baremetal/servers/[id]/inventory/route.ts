
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST endpoint to trigger inventory scan
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const server = await prisma.dedicatedServer.findUnique({
            where: { id }
        });

        if (!server) {
            return NextResponse.json({ error: "Server not found" }, { status: 404 });
        }

        // Cancel any existing installs
        await prisma.pXEInstall.updateMany({
            where: {
                serverId: id,
                state: { in: ['QUEUED', 'RUNNING', 'INVENTORY_SCAN'] }
            },
            data: {
                state: 'FAILED',
                finishedAt: new Date(),
                logText: "Cancelled by new inventory scan"
            }
        });

        // We need a dummy profile ID or modify schema to make it optional. 
        // For now, let's grab the first available profile just to satisfy FK, or use a specific "INVENTORY" profile if we had one.
        // Better: Use a known valid profile but override behavior via state.
        const defaultProfile = await prisma.pXEProfile.findFirst({
            where: { enabled: true }
        });

        if (!defaultProfile) {
            return NextResponse.json({ error: "No PXE profiles available to bind (needed for schema)" }, { status: 500 });
        }

        // Create PXEInstall record with state INVENTORY_SCAN
        const install = await prisma.pXEInstall.create({
            data: {
                serverId: id,
                profileId: defaultProfile.id,
                state: 'INVENTORY_SCAN',
                token: require("crypto").randomBytes(32).toString("hex"),
                userDataJson: {}, // Empty
                progress: 0,
                stage: 'INVENTORY_START'
            }
        });

        // Update server status
        await prisma.dedicatedServer.update({
            where: { id },
            data: {
                status: 'INVENTORYING'
            }
        });

        // Return success
        return NextResponse.json({ success: true, installId: install.id });

    } catch (error) {
        console.error("[INVENTORY_POST]", error);
        return NextResponse.json({ error: "Failed to start inventory scan" }, { status: 500 });
    }
}
