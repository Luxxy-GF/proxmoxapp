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
        // Using JAVA (JNLP) console type - legacy Java applet viewer via noVNC
        const consoleSession = await startConsoleSession({
            serverId: id,
            type: 'JAVA',
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
