import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

interface RouteParams {
    params: Promise<{ token: string }>;
}

// GET /api/pxe/firstboot/[token] - Returns the first-boot script for the install
export async function GET(req: Request, { params }: RouteParams) {
    const { token } = await params;

    try {
        const install = await prisma.pXEInstall.findUnique({
            where: { token },
            include: {
                server: true,
                profile: true
            }
        });

        if (!install) {
            // Return 200 so wget saves the response body (404 causes empty file)
            return new NextResponse("#!/bin/bash\necho 'ERROR: Invalid token'\nexit 1", {
                status: 200,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        const profile = install.profile;
        const baseUrl = "http://10.15.0.2:3000";
        const callbackUrl = `${baseUrl}/api/pxe/callback?mac=${install.server.macAddress}&token=${token}&event=success`;

        // Build the first-boot script with self-cleanup
        let script = `#!/bin/bash
# Auto-generated first-boot script for ${install.server.hostname}
# Profile: ${profile.name}
# This runs on first boot via systemd service

set -e  # Exit on any error

# Self-cleanup: disable service and remove script to prevent re-running
systemctl disable first-boot.service 2>/dev/null || true
rm -f /etc/systemd/system/first-boot.service
rm -f /root/first-boot.sh

`;

        // Add the actual custom scripts (strip reboot commands - preseed reboots automatically)
        if ((profile as any).customScripts) {
            let scripts = (profile as any).customScripts as string;

            // Replace template variables with server-specific values
            const server = install.server as any;
            scripts = scripts.replace(/\$\{server\.primaryIpv4\}/g, server.primaryIpv4 || '');
            scripts = scripts.replace(/\$\{server\.gateway\}/g, server.gateway || '');
            scripts = scripts.replace(/\$\{server\.netmask\}/g, server.netmask || '');
            scripts = scripts.replace(/\$\{server\.hostname\}/g, server.hostname || '');
            scripts = scripts.replace(/\$\{server\.macAddress\}/g, server.macAddress || '');

            // Also support simpler $PRIMARY_IPV4 style variables
            scripts = scripts.replace(/\$PRIMARY_IPV4/g, server.primaryIpv4 || '');
            scripts = scripts.replace(/\$GATEWAY/g, server.gateway || '');
            scripts = scripts.replace(/\$NETMASK/g, server.netmask || '');
            scripts = scripts.replace(/\$HOSTNAME/g, server.hostname || '');
            scripts = scripts.replace(/\$MAC_ADDRESS/g, server.macAddress || '');

            // Note: reboot commands are allowed since this runs on a fully booted system

            script += `# Custom first-boot commands\n${scripts}\n\n`;
        }

        // Add success callback
        script += `# Signal completion\nwget -q -O /dev/null "${callbackUrl}" || true\n`;

        return new NextResponse(script, {
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (error) {
        console.error("[PXE_FIRSTBOOT_GET]", error);
        // Return 200 so wget saves the response body
        return new NextResponse("#!/bin/bash\necho 'ERROR: Server error'\nexit 1", {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
