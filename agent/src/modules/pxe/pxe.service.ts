import { Injectable, Logger } from '@nestjs/common';
import { StateService } from '../../core/state/state.service';
import { PXEServer, PXEInstall, PXEProfile, PXEConfig } from './pxe.types';
import * as crypto from 'crypto';

@Injectable()
export class PxeService {
    private readonly logger = new Logger(PxeService.name);

    constructor(private readonly stateService: StateService) { }

    // ===== Helper Methods =====

    private getPxeConfig(): PXEConfig | null {
        const config = this.stateService.getCurrentConfig();
        return config?.pxe as PXEConfig | null;
    }

    private findServerByMac(mac: string): PXEServer | null {
        const pxeConfig = this.getPxeConfig();
        if (!pxeConfig) return null;

        const normalizedMac = mac.toLowerCase().replace(/-/g, ':');
        return pxeConfig.servers.find(s => s.mac.toLowerCase() === normalizedMac) || null;
    }

    private findServerByToken(token: string): PXEServer | null {
        const pxeConfig = this.getPxeConfig();
        if (!pxeConfig) return null;

        return pxeConfig.servers.find(s => s.activeInstall?.token === token) || null;
    }

    private generatePassword(length = 16): string {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        const bytes = crypto.randomBytes(length);
        for (let i = 0; i < length; i++) {
            result += chars[bytes[i] % chars.length];
        }
        return result;
    }

    // ===== Boot Script Logic (from /api/pxe/ipxe/route.ts) =====

    getBootScript(mac: string | null): { script: string; contentType: string } {
        const pxeConfig = this.getPxeConfig();
        if (!pxeConfig) {
            return {
                script: '#!ipxe\n\necho Agent not synced with Panel\nsleep 5\nreboot\n',
                contentType: 'text/plain'
            };
        }

        const panelBaseUrl = pxeConfig.panelBaseUrl;

        // If no MAC provided, return bootstrap that chains back with MAC
        if (!mac) {
            // Agent serves PXE, so chain to self
            const agentPort = process.env.PORT || '3000';
            const bootstrapUrl = `http://\${next-server}:${agentPort}/pxe/boot?mac=\${net0/mac}`;
            return {
                script: `#!ipxe\n\nchain ${bootstrapUrl} || shell\n`,
                contentType: 'text/plain'
            };
        }

        const server = this.findServerByMac(mac);

        if (!server) {
            // Unknown host - exit to local boot
            return {
                script: '#!ipxe\n\necho Unknown host\nexit',
                contentType: 'text/plain'
            };
        }

        const activeInstall = server.activeInstall;

        if (!activeInstall) {
            // No pending install, boot from local disk
            return {
                script: '#!ipxe\n\necho No active install task. Booting local...\nsanboot --no-describe --drive 0x80',
                contentType: 'text/plain'
            };
        }

        const profile = activeInstall.profile;
        const agentPort = process.env.PORT || '3000';
        const agentBaseUrl = `http://\${next-server}:${agentPort}`;
        const configUrl = `${agentBaseUrl}/pxe/config?mac=${mac}&token=${activeInstall.token}`;
        const callbackUrl = `${panelBaseUrl}/api/pxe/callback?mac=${mac}&token=${activeInstall.token}`;

        let script = '#!ipxe\n\n';

        if (activeInstall.state === 'INVENTORY_SCAN') {
            // Inventory scan using Ubuntu 22.04 Live
            script += `echo Starting Hardware Inventory Scan for ${server.hostname} (Ubuntu 22.04 Live Autoinstall)...\n`;

            const userDataUrl = `${agentBaseUrl}/pxe/cloudinit/${activeInstall.token}/user-data`;

            // Ubuntu 22.04 (Jammy) Netboot Assets from Panel
            script += `kernel ${panelBaseUrl}/inventory/vmlinuz\n`;
            script += `initrd ${panelBaseUrl}/inventory/initrd\n`;

            // Boot arguments for Casper with Autoinstall
            script += `imgargs vmlinuz initrd=initrd ip=dhcp url=https://releases.ubuntu.com/22.04/ubuntu-22.04.5-live-server-amd64.iso autoinstall ds=nocloud-net;s=${agentBaseUrl}/pxe/cloudinit/${activeInstall.token}/ cloud-config-url=${userDataUrl}\n`;
            script += 'boot\n';

        } else {
            // Normal install
            script += `echo Starting install for ${server.hostname} (${profile.name})...\n`;

            if (profile.bootScriptTemplate) {
                // Use custom template
                script += profile.bootScriptTemplate
                    .replace('{{CONFIG_URL}}', configUrl)
                    .replace('{{CALLBACK_URL}}', callbackUrl);
            } else {
                // Default logic based on OS family
                if (profile.osFamily === 'UBUNTU') {
                    const version = profile.name?.includes('24.04') ? '24.04' : '22.04';
                    script += `kernel ${panelBaseUrl}/ubuntu/${version}/vmlinuz\n`;
                    script += `initrd ${panelBaseUrl}/ubuntu/${version}/initrd\n`;
                    script += `imgargs vmlinuz initrd=initrd auto=true priority=critical url=${configUrl} preseed/url=${configUrl}\n`;
                    script += 'boot\n';
                } else if (profile.osFamily === 'DEBIAN') {
                    script += 'kernel http://ftp.debian.org/debian/dists/trixie/main/installer-amd64/current/images/netboot/debian-installer/amd64/linux\n';
                    script += 'initrd http://ftp.debian.org/debian/dists/trixie/main/installer-amd64/current/images/netboot/debian-installer/amd64/initrd.gz\n';
                    script += `imgargs linux auto=true priority=critical url=${configUrl} interface=${mac}\n`;
                    script += 'boot\n';
                } else {
                    script += 'echo Unsupported OS Family\nexit\n';
                }
            }
        }

        return { script, contentType: 'text/plain' };
    }

    // ===== Preseed/Config Logic (from /api/pxe/config/route.ts) =====

    getPreseedConfig(mac: string, token: string): { content: string; contentType: string } | null {
        const server = this.findServerByMac(mac);
        if (!server || !server.activeInstall || server.activeInstall.token !== token) {
            return null;
        }

        const install = server.activeInstall;
        const pxeConfig = this.getPxeConfig();
        const panelBaseUrl = pxeConfig?.panelBaseUrl || 'http://10.15.0.2:3000';
        const callbackUrl = `${panelBaseUrl}/api/pxe/callback?mac=${mac}&token=${token}`;

        if (install.state === 'INVENTORY_SCAN') {
            // Return inventory preseed (minimal, cloud-init handles it)
            return {
                content: this.generateInventoryPreseed(server, callbackUrl, token),
                contentType: 'text/plain'
            };
        }

        // Generate preseed from profile templates
        const { content } = this.generatePreseedFromProfile(
            install.profile,
            server,
            panelBaseUrl,
            callbackUrl,
            token,
            install.userDataJson
        );

        return { content, contentType: 'text/plain' };
    }

    private generateInventoryPreseed(server: PXEServer, callbackUrl: string, token: string): string {
        // Minimal preseed for inventory scan - actual inventory is via cloud-init
        return `# Inventory Scan Preseed for ${server.hostname}
# This should not be used directly - cloud-init handles inventory
d-i debian-installer/locale string en_US
d-i keyboard-configuration/xkb-keymap select us
`;
    }

    private generatePreseedFromProfile(
        profile: PXEProfile,
        server: PXEServer,
        baseUrl: string,
        callbackUrl: string,
        token: string,
        userData: { rootPassword?: string; sshKeys?: string[] } | null | undefined
    ): { content: string; rootPassword: string } {
        const rootPassword = userData?.rootPassword || this.generatePassword();
        const sshKeys = userData?.sshKeys || [];

        const language = profile.language || 'en_US';
        const timezone = profile.timezone || 'UTC';
        const mirror = profile.mirrorUrl || 'http://deb.debian.org/debian';
        const packages = profile.defaultPackages || 'openssh-server';

        // Build preseed (exact copy from Panel)
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
d-i mirror/http/hostname string ${this.extractHostname(mirror)}
d-i mirror/http/directory string ${this.extractPath(mirror)}
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

        // Late command generation with lateCommandsTemplate support
        const callbackUrlFull = `${callbackUrl}&event=late_command`;

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
        const firstBootScriptContent = profile.firstBootScript || profile.customScripts;

        if (firstBootScriptContent) {
            let scriptContent = `#!/bin/bash
# Auto-generated first-boot script for ${server.hostname}
# This runs on first boot via systemd service

set -e
exec > >(tee -a /var/log/first-boot.log) 2>&1

echo "Starting first-boot script..."

`;
            // Variable replacement in first-boot script
            let userScripts = firstBootScriptContent;
            userScripts = userScripts.replace(/\$\{server\.primaryIpv4\}/g, server.primaryIpv4 || '');
            userScripts = userScripts.replace(/\$\{server\.gateway\}/g, server.gateway || '');
            userScripts = userScripts.replace(/\$\{server\.netmask\}/g, server.netmask || '');
            userScripts = userScripts.replace(/\$\{server\.hostname\}/g, server.hostname || '');
            userScripts = userScripts.replace(/\$\{server\.macAddress\}/g, server.mac || '');
            userScripts = userScripts.replace(/\$\{callbackUrl\}/g, callbackUrl);
            userScripts = userScripts.replace(/\$\{installToken\}/g, token);
            userScripts = userScripts.replace(/\$\{hostname\}/g, server.hostname || '');

            userScripts = userScripts.replace(/\$PRIMARY_IPV4/g, server.primaryIpv4 || '');
            userScripts = userScripts.replace(/\$GATEWAY/g, server.gateway || '');
            userScripts = userScripts.replace(/\$NETMASK/g, server.netmask || '');
            userScripts = userScripts.replace(/\$HOSTNAME/g, server.hostname || '');
            userScripts = userScripts.replace(/\$MAC_ADDRESS/g, server.mac || '');

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
        if (profile.lateCommandsTemplate) {
            // Use profile's late commands template with variable interpolation
            let templateLateCmd = profile.lateCommandsTemplate;

            // Replace all template variables
            templateLateCmd = templateLateCmd.replace(/\$\{sshKeyCmds\}/g, sshKeyCmds);
            templateLateCmd = templateLateCmd.replace(/\$\{scriptB64\}/g, scriptB64);
            templateLateCmd = templateLateCmd.replace(/\$\{unitB64\}/g, unitB64);
            templateLateCmd = templateLateCmd.replace(/\$\{server\.macAddress\}/g, server.mac || '');
            templateLateCmd = templateLateCmd.replace(/\$\{server\.primaryIpv4\}/g, server.primaryIpv4 || '');
            templateLateCmd = templateLateCmd.replace(/\$\{server\.gateway\}/g, server.gateway || '');
            templateLateCmd = templateLateCmd.replace(/\$\{server\.netmask\}/g, server.netmask || '');
            templateLateCmd = templateLateCmd.replace(/\$\{server\.hostname\}/g, server.hostname || '');
            templateLateCmd = templateLateCmd.replace(/\$\{callbackUrl\}/g, callbackUrl);
            templateLateCmd = templateLateCmd.replace(/\$\{installToken\}/g, token);
            templateLateCmd = templateLateCmd.replace(/\$\{hostname\}/g, server.hostname || '');

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
            lateCommands.push(`wget -q -O /dev/null "${callbackUrlFull}" || true`);
            lateCommandStr = lateCommands.join(' ; ');
        }

        if (lateCommandStr) {
            preseed += `# Late Commands\nd-i preseed/late_command string ${lateCommandStr}\n`;
        }

        return { content: preseed, rootPassword };
    }

    private buildFirstBootScript(server: PXEServer, profile: PXEProfile, callbackUrl: string): string {
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
        if (profile.customScripts) {
            let userScripts = profile.customScripts;

            // Replace template variables
            userScripts = userScripts.replace(/\$\{server\.primaryIpv4\}/g, server.primaryIpv4 || '');
            userScripts = userScripts.replace(/\$\{server\.gateway\}/g, server.gateway || '');
            userScripts = userScripts.replace(/\$\{server\.netmask\}/g, server.netmask || '');
            userScripts = userScripts.replace(/\$\{server\.hostname\}/g, server.hostname || '');
            userScripts = userScripts.replace(/\$\{server\.macAddress\}/g, server.mac || '');

            userScripts = userScripts.replace(/\$PRIMARY_IPV4/g, server.primaryIpv4 || '');
            userScripts = userScripts.replace(/\$GATEWAY/g, server.gateway || '');
            userScripts = userScripts.replace(/\$NETMASK/g, server.netmask || '');
            userScripts = userScripts.replace(/\$HOSTNAME/g, server.hostname || '');
            userScripts = userScripts.replace(/\$MAC_ADDRESS/g, server.mac || '');

            scriptContent += `# Custom first-boot commands\n${userScripts}\n\n`;
            scriptContent += `# Signal completion\nwget -q -O /dev/null "${callbackUrl}&event=success" || true\n`;
        }

        return scriptContent;
    }

    private buildSystemdUnit(): string {
        return `[Unit]
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
    }

    private extractHostname(url: string): string {
        try {
            return new URL(url).hostname;
        } catch {
            return 'deb.debian.org';
        }
    }

    private extractPath(url: string): string {
        try {
            const pathname = new URL(url).pathname;
            return pathname.length > 1 ? pathname : '/debian';
        } catch {
            return '/debian';
        }
    }

    // ===== Cloud-Init Logic (from /api/pxe/cloudinit/*/route.ts) =====

    getCloudInitUserData(token: string): { content: string; contentType: string } | null {
        const server = this.findServerByToken(token);
        if (!server || !server.activeInstall) {
            return null;
        }

        const pxeConfig = this.getPxeConfig();
        const callbackUrl = pxeConfig?.panelCallbackUrl || 'http://10.15.0.2:3000/api/pxe/callback';

        const inventoryScript = this.buildInventoryScript(server, token, callbackUrl);
        const scriptBase64 = Buffer.from(inventoryScript).toString('base64');

        const cloudConfig = `#cloud-config
autoinstall:
  version: 1
  identity:
    hostname: inventory-scan
    password: "$6$randomsalt$password"
    username: inventory
  ssh:
    install-server: true
    authorized-keys: []
    allow-pw: false
  early-commands:
    - mkdir -p /opt/inventory
    - echo '${scriptBase64}' | base64 -d > /opt/inventory/scan.sh
    - chmod +x /opt/inventory/scan.sh
    - /opt/inventory/scan.sh
`;

        return { content: cloudConfig, contentType: 'text/yaml' };
    }

    getCloudInitMetaData(token: string): { content: string; contentType: string } | null {
        const server = this.findServerByToken(token);
        if (!server) {
            return null;
        }

        return {
            content: `instance-id: i-${server.id}\nlocal-hostname: ${server.hostname}\n`,
            contentType: 'text/plain'
        };
    }

    private buildInventoryScript(server: PXEServer, token: string, callbackUrl: string): string {
        // Exact copy from Panel /api/pxe/cloudinit/[token]/user-data/route.ts
        return `#!/bin/bash
set -e

echo "Starting Inventory Scan..."

# Ensure jq is installed
echo "Installing dependencies..."
apt-get update -y
apt-get install -y jq lshw

echo "Collecting CPU..."
CPU_JSON=$(lshw -json -class cpu 2>/dev/null || echo "{}")

echo "Collecting RAM..."
MEM_JSON=$(lshw -json -class memory 2>/dev/null || echo "{}")

echo "Collecting Disks..."
DISK_JSON=$(lsblk -J -o NAME,SIZE,MODEL,TYPE,ROTA 2>/dev/null || echo "{}")

echo "Collecting Network..."
NET_JSON=$(ip -j addr 2>/dev/null || echo "{}")

echo "Collecting DMI..."

if command -v jq >/dev/null; then
    jq -n \\
      --argjson cpu "$CPU_JSON" \\
      --argjson ram "$MEM_JSON" \\
      --argjson disks "$DISK_JSON" \\
      --argjson net "$NET_JSON" \\
      --arg token "${token}" \\
      --arg mac "${server.mac}" \\
      '{
        mac: $mac,
        token: $token,
        status: "inventory",
        hardware: {
            cpu: $cpu, 
            ram: $ram, 
            disks: $disks, 
            net: $net,
            cpuModel: ($cpu[0].product // "Unknown"),
            cpuCores: ($cpu[0].configuration.cores // 0 | tonumber),
            ramMiB: ([$ram[] | .size] | add | . / 1024 / 1024 | floor),
            simpleDisks: $disks.blockdevices
        }
      }' > /tmp/payload.json
else
    echo "jq not found, using minimal fallback..."
    python3 -c "
import json, subprocess
def get_out(cmd):
    try: return subprocess.check_output(cmd, shell=True).decode()
    except: return '{}'

cpu = json.loads(get_out('lshw -json -class cpu') or '[]')
mem = json.loads(get_out('lshw -json -class memory') or '[]')
dsk = json.loads(get_out('lsblk -J -o NAME,SIZE,MODEL,TYPE,ROTA') or '{}')
net = json.loads(get_out('ip -j addr') or '[]')

if isinstance(mem, dict): mem = [mem]
total_ram = sum([int(m.get('size', 0)) for m in mem])

payload = {
    'mac': '${server.mac}',
    'token': '${token}',
    'status': 'inventory',
    'hardware': {
        'cpu': cpu,
        'ram': mem,
        'disks': dsk,
        'net': net,
        'cpuModel': cpu[0].get('product', 'Unknown') if isinstance(cpu, list) and cpu else 'Unknown',
        'cpuCores': cpu[0].get('configuration', {}).get('cores', 0) if isinstance(cpu, list) and cpu else 0,
        'ramMiB': total_ram // 1024 // 1024,
        'simpleDisks': dsk.get('blockdevices', [])
    }
}
with open('/tmp/payload.json', 'w') as f:
    json.dump(payload, f)
"
fi

echo "Sending Payload to ${callbackUrl}..."
curl -X POST -H "Content-Type: application/json" -d @/tmp/payload.json "${callbackUrl}"

echo "Done. Rebooting..."
reboot
`;
    }
}
