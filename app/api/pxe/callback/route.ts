
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { logDedicatedEvent } from "@/lib/baremetal/utils";

export async function POST(req: Request) {
    try {
        const json = await req.json();
        const { mac, token, status, message } = json;

        if (!mac || !token || !status) {
            return new NextResponse("Missing fields", { status: 400 });
        }

        const install = await prisma.pXEInstall.findUnique({
            where: { token },
            include: { server: true }
        });

        if (!install || install.server.macAddress !== mac) {
            return new NextResponse("Invalid Token", { status: 403 });
        }

        if (status === 'success') {
            await prisma.pXEInstall.update({
                where: { id: install.id },
                data: {
                    state: 'DONE',
                    progress: 100,
                    stage: 'complete',
                    finishedAt: new Date(),
                    lastCallbackAt: new Date(),
                    logText: message
                }
            });

            await prisma.dedicatedServer.update({
                where: { id: install.serverId },
                data: { status: 'ACTIVE' }
            });

            await logDedicatedEvent(install.serverId, 'INSTALL', 'Installation completed successfully.');

        } else if (status === 'fail' || status === 'failed') {
            await prisma.pXEInstall.update({
                where: { id: install.id },
                data: {
                    state: 'FAILED',
                    finishedAt: new Date(),
                    lastCallbackAt: new Date(),
                    logText: message
                }
            });
            await logDedicatedEvent(install.serverId, 'INSTALL', `Installation failed: ${message}`);

        } else if (status === 'inventory' && json.hardware) {
            // Handle Inventory Data
            const hw = json.hardware;
            // Upsert DedicatedHardware
            await prisma.dedicatedHardware.upsert({
                where: { serverId: install.serverId },
                create: {
                    serverId: install.serverId,
                    cpuModel: hw.cpuModel || "Unknown",
                    cpuCores: parseInt(hw.cpuCores) || 0,
                    ramMiB: parseInt(hw.ramMiB) || 0,
                    // Use simpleDisks if available (from our script), else try to parse blockdevices
                    disksJson: hw.simpleDisks || hw.disks?.blockdevices || [],
                    vendor: "Detected",
                    model: "Detected"
                },
                update: {
                    cpuModel: hw.cpuModel,
                    cpuCores: parseInt(hw.cpuCores),
                    ramMiB: parseInt(hw.ramMiB),
                    disksJson: hw.simpleDisks || hw.disks?.blockdevices || []
                }
            });

            // Mark install as DONE
            await prisma.pXEInstall.update({
                where: { id: install.id },
                data: {
                    state: 'DONE',
                    stage: 'INVENTORY_COMPLETE',
                    finishedAt: new Date(),
                    progress: 100,
                    logText: "Hardware Inventory Scan Complete"
                }
            });

            // Reset server to OFFLINE (or whatever prior state)
            await prisma.dedicatedServer.update({
                where: { id: install.serverId },
                data: { status: 'OFFLINE' }
            });

            await logDedicatedEvent(install.serverId, 'INVENTORY', 'Hardware inventory scan completed.');

        } else {
            // heartbeat or progress
            const updateData: any = {
                lastCallbackAt: new Date(),
                logText: message || install.logText,
            };

            if (json.stage) updateData.stage = json.stage;
            if (json.progress !== undefined) updateData.progress = parseInt(json.progress);

            await prisma.pXEInstall.update({
                where: { id: install.id },
                data: updateData
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("[PXE_CALLBACK_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
