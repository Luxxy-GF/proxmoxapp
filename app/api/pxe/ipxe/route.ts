import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const paramMac = searchParams.get("mac");
    const mac = paramMac ? paramMac.replace(/-/g, ':').toLowerCase() : null;

    if (!mac) {
        // If no MAC provided (e.g. from initial dnsmasq chain), return a bootstrap script
        // that instructs iPXE to chainload this URL again WITH the MAC address.
        const host = req.headers.get("host") || "10.15.0.2:3000";
        const protocol = req.headers.get("x-forwarded-proto") || "http";
        const bootstrapUrl = `${protocol}://${host}/api/pxe/ipxe?mac=\${net0/mac}`;

        return new NextResponse(`#!ipxe\n\nchain ${bootstrapUrl} || shell\n`, {
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    try {
        const server = await prisma.dedicatedServer.findUnique({
            where: { macAddress: mac },
            include: {
                installs: {
                    where: { state: { in: ['QUEUED', 'RUNNING', 'INVENTORY_SCAN'] } },
                    orderBy: { startedAt: 'desc' },
                    take: 1,
                    include: {
                        profile: true
                    }
                }
            }
        });

        if (!server) {
            // Not recognized, exit to local boot
            return new NextResponse("#!ipxe\n\necho Unknown host\nexit", {
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        const activeInstall = server.installs[0];

        if (!activeInstall) {
            // No pending install, boot from local disk
            return new NextResponse("#!ipxe\n\necho No active install task. Booting local...\nsanboot --no-describe --drive 0x80", {
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        // Mark as RUNNING if it was QUEUED
        if (activeInstall.state === 'QUEUED') {
            await prisma.pXEInstall.update({
                where: { id: activeInstall.id },
                data: { state: 'RUNNING' }
            });
        }

        // For INVENTORY_SCAN, we don't change state to RUNNING, we keep it as INVENTORY_SCAN so config knows what to serve.

        const profile = activeInstall.profile;

        // Construct URLs
        // Note: In production you need the public URL of the Luxxy instance
        // process.env.NEXT_PUBLIC_APP_URL might be set to internal/incorrect URL
        const baseUrl = "http://10.15.0.2:3000";
        const configUrl = `${baseUrl}/api/pxe/config?mac=${mac}&token=${activeInstall.token}`;
        const callbackUrl = `${baseUrl}/api/pxe/callback?mac=${mac}&token=${activeInstall.token}`;

        let script = "#!ipxe\n\n";

        if (activeInstall.state === 'INVENTORY_SCAN') {
            script += `echo Starting Hardware Inventory Scan for ${server.hostname} (Ubuntu 22.04 Live Autoinstall)...\n`;

            // Cloud-Init URLs
            const userDataUrl = `${baseUrl}/api/pxe/cloudinit/${activeInstall.token}/user-data`;

            // Ubuntu 22.04 (Jammy) Netboot Assets
            // Hosted locally to avoid iPXE HTTPS issues
            // /inventory/vmlinuz and /inventory/initrd are in public/inventory/
            script += `kernel ${baseUrl}/inventory/vmlinuz\n`;
            script += `initrd ${baseUrl}/inventory/initrd\n`;

            // Boot arguments for Casper with Autoinstall
            // url: Points to the full Live Server ISO
            // autoinstall ds=nocloud-net;s=... : Points to our cloud-init config
            script += `imgargs vmlinuz initrd=initrd ip=dhcp url=https://releases.ubuntu.com/22.04/ubuntu-22.04.5-live-server-amd64.iso autoinstall ds=nocloud-net;s=${baseUrl}/api/pxe/cloudinit/${activeInstall.token}/ cloud-config-url=${userDataUrl}\n`;
            script += "boot\n";

        } else {
            script += `echo Starting install for ${server.hostname} (${profile.name})...\n`;

            if (profile.bootScriptTemplate) {
                // Use custom template
                script += profile.bootScriptTemplate
                    .replace('{{CONFIG_URL}}', configUrl)
                    .replace('{{CALLBACK_URL}}', callbackUrl);
            } else {
                // Default Logic
                if (profile.osFamily === 'UBUNTU') {
                    // Example Ubuntu Autoinstall
                    script += "kernel http://archive.ubuntu.com/ubuntu/dists/jammy/main/installer-amd64/current/legacy-images/netboot/ubuntu-installer/amd64/linux\n";
                    script += `initrd http://archive.ubuntu.com/ubuntu/dists/jammy/main/installer-amd64/current/legacy-images/netboot/ubuntu-installer/amd64/initrd.gz\n`;
                    script += `imgargs linux auto=true priority=critical url=${configUrl} interface=${mac}\n`;
                    script += "boot\n";
                } else if (profile.osFamily === 'DEBIAN') {
                    // Debian 13 (Trixie) - currently testing
                    script += "kernel http://ftp.debian.org/debian/dists/trixie/main/installer-amd64/current/images/netboot/debian-installer/amd64/linux\n";
                    script += "initrd http://ftp.debian.org/debian/dists/trixie/main/installer-amd64/current/images/netboot/debian-installer/amd64/initrd.gz\n";
                    script += `imgargs linux auto=true priority=critical url=${configUrl} interface=${mac}\n`;
                    script += "boot\n";
                } else {
                    script += "echo Unsupported OS Family\nexit\n";
                }
            }
        }

        return new NextResponse(script, {
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (error) {
        console.error("[PXE_IPXE_GET]", error);
        return new NextResponse("#!ipxe\n\necho Internal Error\nexit", { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
}
