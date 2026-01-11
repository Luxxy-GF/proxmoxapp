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
        firstBootScript?: string | null;
        lateCommandsTemplate?: string | null;
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

    // Late command generation
    const profileAny = profile as any;
    const serverAny = server as any;

    // Build SSH key commands for template replacement
    let sshKeyCmds = '';
    if (sshKeys.length > 0) {
        const keyCmds: string[] = [];
        keyCmds.push('in-target mkdir -p /root/.ssh');
        keyCmds.push('in-target chmod 700 /root/.ssh');
        for (const key of sshKeys) {
            const escapedKey = key.replace(/'/g, "'\\''");
            keyCmds.push(`in-target /bin/sh -c "echo '${escapedKey}' >> /root/.ssh/authorized_keys"`);
        }
        keyCmds.push('in-target chmod 600 /root/.ssh/authorized_keys');
        sshKeyCmds = keyCmds.join('; \\\n    ') + '; \\';
    }

    // Build first-boot script and systemd unit
    let scriptB64 = '';
    let unitB64 = '';
    const firstBootScriptContent = profileAny.firstBootScript || profileAny.customScripts;

    if (firstBootScriptContent) {
        let scriptContent = `#!/bin/bash
# Auto-generated first-boot script for ${server.hostname}
# This runs on first boot via systemd service

set -e
exec > >(tee -a /var/log/first-boot.log) 2>&1

echo "Starting first-boot script..."

`;
        // Variable replacement in first-boot script
        let userScripts = firstBootScriptContent as string;
        userScripts = userScripts.replace(/\$\{server\.primaryIpv4\}/g, serverAny.primaryIpv4 || '');
        userScripts = userScripts.replace(/\$\{server\.gateway\}/g, serverAny.gateway || '');
        userScripts = userScripts.replace(/\$\{server\.netmask\}/g, serverAny.netmask || '');
        userScripts = userScripts.replace(/\$\{server\.hostname\}/g, serverAny.hostname || '');
        userScripts = userScripts.replace(/\$\{server\.macAddress\}/g, serverAny.macAddress || '');
        userScripts = userScripts.replace(/\$\{callbackUrl\}/g, callbackUrl);
        userScripts = userScripts.replace(/\$\{installToken\}/g, token);
        userScripts = userScripts.replace(/\$\{hostname\}/g, serverAny.hostname || '');

        scriptContent += userScripts;
        scriptContent += `

# Self-cleanup
systemctl disable pve-install.service 2>/dev/null || systemctl disable first-boot.service 2>/dev/null || true
rm -f /etc/systemd/system/pve-install.service /etc/systemd/system/first-boot.service
rm -f /usr/local/bin/pve-install.sh /usr/local/bin/first-boot.sh

echo "First-boot script complete."
`;
        scriptB64 = Buffer.from(scriptContent).toString('base64');

        const systemdUnit = `[Unit]
Description=First Boot Script
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash /usr/local/bin/pve-install.sh
RemainAfterExit=yes
StandardOutput=journal+console

[Install]
WantedBy=multi-user.target`;
        unitB64 = Buffer.from(systemdUnit).toString('base64');
    }

    // Check if profile has lateCommandsTemplate
    let lateCommandStr = '';
    if (profileAny.lateCommandsTemplate) {
        // Use profile's late commands template with variable interpolation
        let templateLateCmd = profileAny.lateCommandsTemplate as string;

        // Replace all template variables
        templateLateCmd = templateLateCmd.replace(/\$\{sshKeyCmds\}/g, sshKeyCmds);
        templateLateCmd = templateLateCmd.replace(/\$\{scriptB64\}/g, scriptB64);
        templateLateCmd = templateLateCmd.replace(/\$\{unitB64\}/g, unitB64);
        templateLateCmd = templateLateCmd.replace(/\$\{server\.macAddress\}/g, serverAny.macAddress || '');
        templateLateCmd = templateLateCmd.replace(/\$\{server\.primaryIpv4\}/g, serverAny.primaryIpv4 || '');
        templateLateCmd = templateLateCmd.replace(/\$\{server\.gateway\}/g, serverAny.gateway || '');
        templateLateCmd = templateLateCmd.replace(/\$\{server\.netmask\}/g, serverAny.netmask || '');
        templateLateCmd = templateLateCmd.replace(/\$\{server\.hostname\}/g, serverAny.hostname || '');
        templateLateCmd = templateLateCmd.replace(/\$\{callbackUrl\}/g, callbackUrl);
        templateLateCmd = templateLateCmd.replace(/\$\{installToken\}/g, token);
        templateLateCmd = templateLateCmd.replace(/\$\{hostname\}/g, serverAny.hostname || '');

        lateCommandStr = templateLateCmd;
    } else {
        // Fallback: build late commands array (old behavior)
        const lateCommands: string[] = [];

        // SSH keys
        if (sshKeys.length > 0) {
            lateCommands.push('mkdir -p /target/root/.ssh');
            lateCommands.push('chmod 700 /target/root/.ssh');
            for (const key of sshKeys) {
                const escapedKey = key.replace(/"/g, '\\"');
                lateCommands.push(`echo "${escapedKey}" >> /target/root/.ssh/authorized_keys`);
            }
            lateCommands.push('chmod 600 /target/root/.ssh/authorized_keys');
        }

        // First-boot script
        if (scriptB64) {
            lateCommands.push(`echo '${scriptB64}' | base64 -d > /target/usr/local/bin/pve-install.sh`);
            lateCommands.push('chmod +x /target/usr/local/bin/pve-install.sh');
            lateCommands.push(`echo '${unitB64}' | base64 -d > /target/etc/systemd/system/pve-install.service`);
            lateCommands.push('chroot /target systemctl enable pve-install.service');
        }

        // Callback
        lateCommands.push(`wget -q -O /dev/null "${callbackUrl}&event=late_command" || true`);
        lateCommandStr = lateCommands.join(' ; ');
    }

    if (lateCommandStr) {
        preseed += `# Late Commands\nd-i preseed/late_command string ${lateCommandStr}\n`;
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
