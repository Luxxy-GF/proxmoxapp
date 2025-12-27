import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile } from "fs/promises";
import { regenerateDnsmasqConfig } from "@/lib/pxe";

const execAsync = promisify(exec);

// GET - Retrieve current PXE settings
export async function GET() {
    try {
        // Get settings from database, create default if not exists
        let settings = await prisma.pXESettings.findFirst();

        if (!settings) {
            settings = await prisma.pXESettings.create({
                data: {}  // Uses defaults from schema
            });
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error fetching PXE settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch PXE settings" },
            { status: 500 }
        );
    }
}

// PUT - Update PXE settings and regenerate dnsmasq config
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        // Get existing settings
        let settings = await prisma.pXESettings.findFirst();

        if (!settings) {
            settings = await prisma.pXESettings.create({
                data: body
            });
        } else {
            settings = await prisma.pXESettings.update({
                where: { id: settings.id },
                data: body
            });
        }

        // Regenerate dnsmasq configuration using shared lib
        await regenerateDnsmasqConfig();

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error updating PXE settings:", error);
        return NextResponse.json(
            { error: "Failed to update PXE settings" },
            { status: 500 }
        );
    }
}


