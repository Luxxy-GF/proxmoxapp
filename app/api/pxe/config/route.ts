
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateDebian13Preseed } from "@/lib/baremetal/templates/debian13";
import { generateDebian13ProxmoxPreseed } from "@/lib/baremetal/templates/proxmox9";
import { logDedicatedEvent } from "@/lib/baremetal/utils";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const mac = searchParams.get("mac");
    const token = searchParams.get("token");

    if (!mac || !token) {
        return new NextResponse("Missing MAC or Token", { status: 400 });
    }

    try {
        const install = await prisma.pXEInstall.findUnique({
            where: { token },
            include: {
                server: true,
                profile: true,
                diskLayout: true
            }
        });

        if (!install || install.server.macAddress !== mac) {
            return new NextResponse("Invalid Token or MAC", { status: 403 });
        }

        // Generate Config
        // In a real impl, we would merge Profile defaults with DiskLayout and specific Server settings (IPs, hostname)

        // Placeholder: Return DiskLayout content or a minimal default
        let content = install.diskLayout?.content || "# No specific layout\n";

        // Helper to determine usage
        // If state is INVENTORY_SCAN, use inventory template
        if (install.state === 'INVENTORY_SCAN') {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coterm.luxxy.xyz";
            const callbackUrl = `${baseUrl}/api/baremetal/pxe/callback`; // Ensure this matches where we direct traffic
            // Correction: The other file uses /api/pxe/callback. Let's keep consistent.
            const legacyCallbackUrl = `${baseUrl}/api/pxe/callback`;

            // We need to import this dynamically or at the top
            const { generateInventoryPreseed } = require("@/lib/baremetal/templates/inventory");
            content = generateInventoryPreseed(install.server, legacyCallbackUrl, token);

        } else if (install.profile.osFamily === 'DEBIAN') {
            // Use configured APP_URL or fallback to the known working domain. 
            // User requested check on env var usage.
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coterm.luxxy.xyz";
            const callbackUrl = `${baseUrl}/api/pxe/callback`;

            let preseed, rootPassword;

            if (install.profile.name && install.profile.name.toLowerCase().includes('proxmox')) {
                // Use Proxmox 9 Template
                const res = generateDebian13ProxmoxPreseed(
                    install.server,
                    callbackUrl,
                    token,
                    install.userDataJson as any
                );
                preseed = res.content;
                rootPassword = res.rootPassword;
            } else {
                // Use Standard Debian 13 Template
                const res = generateDebian13Preseed(
                    install.server,
                    callbackUrl,
                    token,
                    install.userDataJson as any
                );
                preseed = res.content;
                rootPassword = res.rootPassword;
            }
            content = preseed;

            // Log the generated password (CRITICAL for user to know it)
            // We only log it once per generation request, which might be spammy if pxe retries, 
            // but necessary since we generate a NEW one each time.
            // Ideally we should persist this password or use a pre-set one, but per instructions we generate simple random.
            await logDedicatedEvent(
                install.server.id,
                'INSTALL',
                `Generated new root password for install: ${rootPassword}`,
                { rootPassword }
            );

        } else if (install.profile.osFamily === 'UBUNTU') {
            if (!content.startsWith('#cloud-config')) {
                content = "#cloud-config\n" + content;
            }
        }

        return new NextResponse(content, {
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (error) {
        console.error("[PXE_CONFIG_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
