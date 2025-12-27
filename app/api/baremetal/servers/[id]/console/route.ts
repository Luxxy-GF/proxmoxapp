import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/baremetal/encryption";
import { startConsoleSession } from "@/lib/console";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { id } = await params;

        // 1. Fetch Server & IPMI Config
        const connectionAssignment = await prisma.connectionAssignment.findFirst({
            where: {
                serverId: id,
                connection: { type: 'IPMI' }
            },
            include: { connection: true }
        });

        if (!connectionAssignment || !connectionAssignment.connection.encryptedConfig) {
            return new NextResponse("IPMI not configured for this server", { status: 400 });
        }

        // 2. Decrypt Config
        const configStr = decrypt(connectionAssignment.connection.encryptedConfig);
        const config = JSON.parse(configStr);

        // 3. Start Console Session (Docker)
        // Todo: Detect if we want JAVA or HTML5. For now default to HTML5 (Chromium Kiosk)
        // or pass as query param?
        const consoleSession = await startConsoleSession({
            serverId: id,
            type: 'HTML5',
            bmcUrl: `https://${config.host}`, // Assume HTTPS
            bmcUser: config.user,
            bmcPass: config.pass
        });

        return NextResponse.json(consoleSession);

    } catch (e: any) {
        console.error("Console Start Error:", e);
        return new NextResponse(`Console Error: ${e.message}`, { status: 500 });
    }
}
