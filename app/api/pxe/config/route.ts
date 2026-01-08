import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { logDedicatedEvent } from "@/lib/baremetal/utils";
import crypto from "crypto";

// Generate a random root password
function generatePassword(length = 16): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        result += chars[bytes[i] % chars.length];
    }
    return result;
}

// Generate preseed from profile templates
function generatePreseedFromProfile(
    profile: {
        installTemplate?: string | null;
        diskLayoutTemplate?: string | null;
        customScripts?: string | null;
        defaultPackages?: string | null;
        language?: string | null;
        timezone?: string | null;
        mirrorUrl?: string | null;
        [key: string]: unknown;
    },
    server: {
        hostname: string;
        macAddress: string;
        primaryIpv4?: string | null;
        gateway?: string | null;
        netmask?: string | null;
        [key: string]: unknown;
    },
    baseUrl: string,
    callbackUrl: string,
    token: string,
    userData: { rootPassword?: string; sshKeys?: string[] } | null
): { content: string; rootPassword: string } {
    const rootPassword = userData?.rootPassword || generatePassword();
    const sshKeys = userData?.sshKeys || [];

    const language = profile.language || 'en_US';
    const timezone = profile.timezone || 'UTC';
    const mirror = profile.mirrorUrl || 'http://deb.debian.org/debian';
    const packages = profile.defaultPackages || 'openssh-server';

    // Build preseed
    let preseed = `# Auto-generated Preseed Configuration
# Profile-based template

# Localization
d-i debian-installer/locale string ${language}
d-i keyboard-configuration/xkb-keymap select us
d-i time/zone string ${timezone}
d-i clock-setup/utc boolean true
d-i clock-setup/ntp boolean true

# Mirror
d-i mirror/country string manual
d-i mirror/http/hostname string ${new URL(mirror).hostname}
d-i mirror/http/directory string ${new URL(mirror).pathname.length > 1 ? new URL(mirror).pathname : '/debian'}
d-i mirror/http/proxy string

# Network - use the interface that's already configured
d-i netcfg/choose_interface select auto
`;

    if (server.primaryIpv4 && server.gateway && server.netmask) {
        preseed += `d-i netcfg/disable_autoconfig boolean true
d-i netcfg/disable_dhcp boolean true
d-i netcfg/get_ipaddress string ${server.primaryIpv4}
d-i netcfg/get_netmask string ${server.netmask}
d-i netcfg/get_gateway string ${server.gateway}
d-i netcfg/get_nameservers string 8.8.8.8
d-i netcfg/confirm_static boolean true
`;
    }

    preseed += `d-i netcfg/get_hostname string ${server.hostname}
d-i netcfg/get_domain string local

# Root account
d-i passwd/root-login boolean true
d-i passwd/root-password password ${rootPassword}
d-i passwd/root-password-again password ${rootPassword}
d-i passwd/make-user boolean false

`;

    // Add install template (apt setup, etc)
    if (profile.installTemplate) {
        preseed += `# Installation Template\n${profile.installTemplate}\n\n`;
    }

    // Add disk layout template
    if (profile.diskLayoutTemplate) {
        preseed += `# Disk Layout\n${profile.diskLayoutTemplate}\n\n`;
    } else {
        // Default simple partitioning
        preseed += `# Default Disk Layout
d-i partman-auto/method string regular
d-i partman-auto/choose_recipe select atomic
d-i partman-partitioning/confirm_write_new_label boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_nooverwrite boolean true

`;
    }

    // Packages
    preseed += `# Packages
tasksel tasksel/first multiselect minimal
d-i pkgsel/include string ${packages}
d-i pkgsel/upgrade select full-upgrade

# Grub
d-i grub-installer/only_debian boolean true
d-i grub-installer/bootdev string default

# Finish
d-i finish-install/reboot_in_progress note

`;

    // Late command for SSH keys and callback
    let lateCommands: string[] = [];

    // SSH keys
    if (sshKeys.length > 0) {
        lateCommands.push('mkdir -p /target/root/.ssh');
        lateCommands.push('chmod 700 /target/root/.ssh');
        for (const key of sshKeys) {
            // Escape quotes in SSH keys
            const escapedKey = key.replace(/"/g, '\\"');
            lateCommands.push(`echo "${escapedKey}" >> /target/root/.ssh/authorized_keys`);
        }
        lateCommands.push('chmod 600 /target/root/.ssh/authorized_keys');
    }

    // Custom scripts - use systemd service for first-boot execution
    if (profile.customScripts) {
        // Write script using base64 injection (safest way to handle special chars and avoid network/parser issues)
        let scriptContent = `#!/bin/bash
# Auto-generated first-boot script for ${server.hostname}
# Profile: ${profile.name}
# This runs on first boot via systemd service

set -e

# Logging
exec 1> /var/log/first-boot.log 2>&1

echo "Starting first-boot script..."

# Self-cleanup: disable service and remove script to prevent re-running
systemctl disable first-boot.service 2>/dev/null || true
rm -f /etc/systemd/system/first-boot.service
rm -f /root/first-boot.sh

`;
        if ((profile as any).customScripts) {
            let userScripts = (profile as any).customScripts as string;

            // Replace template variables
            const serverAny = server as any;
            userScripts = userScripts.replace(/\$\{server\.primaryIpv4\}/g, serverAny.primaryIpv4 || '');
            userScripts = userScripts.replace(/\$\{server\.gateway\}/g, serverAny.gateway || '');
            userScripts = userScripts.replace(/\$\{server\.netmask\}/g, serverAny.netmask || '');
            userScripts = userScripts.replace(/\$\{server\.hostname\}/g, serverAny.hostname || '');
            userScripts = userScripts.replace(/\$\{server\.macAddress\}/g, serverAny.macAddress || '');

            userScripts = userScripts.replace(/\$PRIMARY_IPV4/g, serverAny.primaryIpv4 || '');
            userScripts = userScripts.replace(/\$GATEWAY/g, serverAny.gateway || '');
            userScripts = userScripts.replace(/\$NETMASK/g, serverAny.netmask || '');
            userScripts = userScripts.replace(/\$HOSTNAME/g, serverAny.hostname || '');
            userScripts = userScripts.replace(/\$MAC_ADDRESS/g, serverAny.macAddress || '');

            scriptContent += `# Custom first-boot commands\n${userScripts}\n\n`;
            scriptContent += `# Signal completion\nwget -q -O /dev/null "${callbackUrl}&event=success" || true\n`;
        }

        const scriptBase64 = Buffer.from(scriptContent).toString('base64');
        lateCommands.push(`echo '${scriptBase64}' | base64 -d > /target/root/first-boot.sh`);
        lateCommands.push('chmod +x /target/root/first-boot.sh');

        // Create systemd service using base64 (consistent and reliable)
        const systemdUnit = `[Unit]
Description=First Boot Script
After=network-online.target
Wants=network-online.target
ConditionPathExists=/root/first-boot.sh

[Service]
Type=oneshot
ExecStart=/bin/bash /root/first-boot.sh
RemainAfterExit=yes
StandardOutput=journal+console

[Install]
WantedBy=multi-user.target`;
        const systemdB64 = Buffer.from(systemdUnit).toString('base64');
        lateCommands.push(`echo '${systemdB64}' | base64 -d > /target/etc/systemd/system/first-boot.service`);
        lateCommands.push('chroot /target systemctl enable first-boot.service');
    }

    // Callback
    lateCommands.push(`wget -q -O /dev/null "${callbackUrl}&event=late_command" || true`);

    if (lateCommands.length > 0) {
        preseed += `# Late Commands\nd-i preseed/late_command string ${lateCommands.join(' ; ')}\n`;
    }

    return { content: preseed, rootPassword };
}

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

        const baseUrl = "http://10.15.0.2:3000";
        const callbackUrl = `${baseUrl}/api/pxe/callback?mac=${mac}&token=${token}`;

        let content: string;
        let rootPassword: string | undefined;

        // If state is INVENTORY_SCAN, use inventory template
        if (install.state === 'INVENTORY_SCAN') {
            const { generateInventoryPreseed } = require("@/lib/baremetal/templates/inventory");
            content = generateInventoryPreseed(install.server, callbackUrl, token);
        } else {
            // Use profile templates
            const result = generatePreseedFromProfile(
                install.profile,
                install.server,
                baseUrl,
                callbackUrl,
                token,
                install.userDataJson as { rootPassword?: string; sshKeys?: string[] } | null
            );
            content = result.content;
            rootPassword = result.rootPassword;

            // Log the generated password
            await logDedicatedEvent(
                install.server.id,
                'INSTALL',
                `Generated root password for install: ${rootPassword}`,
                { rootPassword }
            );
        }

        return new NextResponse(content, {
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (error) {
        console.error("[PXE_CONFIG_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
