
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { logDedicatedEvent } from "@/lib/baremetal/utils";

// GET handler for preseed late_command callbacks (wget)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const mac = searchParams.get("mac");
    const token = searchParams.get("token");
    const event = searchParams.get("event") || "heartbeat";

    if (!mac || !token) {
        return new NextResponse("Missing mac or token", { status: 400 });
    }

    try {
        const install = await prisma.pXEInstall.findUnique({
            where: { token },
            include: { server: true }
        });

        if (!install || install.server.macAddress !== mac) {
            return new NextResponse("Invalid Token", { status: 403 });
        }

        // Update based on event type
        if (event === "late_command") {
            // Late command callback - installation is finishing
            await prisma.pXEInstall.update({
                where: { id: install.id },
                data: {
                    stage: "late_command",
                    lastCallbackAt: new Date(),
                }
            });
            await logDedicatedEvent(install.serverId, 'INSTALL', 'Late command executed, installation finishing...');
        } else if (event === "success" || event === "complete") {
            // Final success callback
            await prisma.pXEInstall.update({
                where: { id: install.id },
                data: {
                    state: 'DONE',
                    progress: 100,
                    stage: 'complete',
                    finishedAt: new Date(),
                    lastCallbackAt: new Date(),
                }
            });
            await prisma.dedicatedServer.update({
                where: { id: install.serverId },
                data: { status: 'ACTIVE' }
            });
            await logDedicatedEvent(install.serverId, 'INSTALL', 'Installation completed successfully.');
        } else {
            // Generic heartbeat
            await prisma.pXEInstall.update({
                where: { id: install.id },
                data: { lastCallbackAt: new Date() }
            });
        }

        return new NextResponse("OK", { status: 200 });
    } catch (error) {
        console.error("[PXE_CALLBACK_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

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
            // Upsert DedicatedHardware with all detailed fields
            await prisma.dedicatedHardware.upsert({
                where: { serverId: install.serverId },
                create: {
                    serverId: install.serverId,
                    cpuModel: hw.cpuModel || "Unknown",
                    cpuCores: parseInt(hw.cpuCores) || 0,
                    cpuSpeed: hw.cpuSpeed || null,
                    ramMiB: parseInt(hw.ramMiB) || 0,
                    ramModulesJson: hw.ramModules || [],
                    biosVendor: hw.biosVendor || null,
                    biosVersion: hw.biosVersion || null,
                    biosDate: hw.biosDate || null,
                    mainboardModel: hw.mainboardModel || null,
                    mainboardSerial: hw.mainboardSerial || null,
                    storageControllersJson: hw.storageControllers || [],
                    nicsJson: hw.nics || [],
                    disksJson: hw.disks?.blockdevices || hw.disks || [],
                    vendor: hw.vendor || "Detected",
                    model: hw.model || "Detected",
                    serial: hw.serial || null
                },
                update: {
                    cpuModel: hw.cpuModel || "Unknown",
                    cpuCores: parseInt(hw.cpuCores) || 0,
                    cpuSpeed: hw.cpuSpeed || null,
                    ramMiB: parseInt(hw.ramMiB) || 0,
                    ramModulesJson: hw.ramModules || [],
                    biosVendor: hw.biosVendor || null,
                    biosVersion: hw.biosVersion || null,
                    biosDate: hw.biosDate || null,
                    mainboardModel: hw.mainboardModel || null,
                    mainboardSerial: hw.mainboardSerial || null,
                    storageControllersJson: hw.storageControllers || [],
                    nicsJson: hw.nics || [],
                    disksJson: hw.disks?.blockdevices || hw.disks || [],
                    vendor: hw.vendor || null,
                    model: hw.model || null,
                    serial: hw.serial || null
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
