
import { prisma } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile } from "fs/promises";

const execAsync = promisify(exec);

export interface PXESettings {
    interface: string;
    dhcpRangeStart: string;
    dhcpRangeEnd: string;
    subnetMask: string;
    leaseTime: string;
    gateway: string;
    dnsServer: string;
    tftpRoot: string;
    httpBootUrl: string;
    enabled: boolean;
    staticHosts?: string; // Internal use for config generation
}

export function generateDnsmasqConfigContent(settings: PXESettings): string {
    if (!settings.enabled) {
        return "# PXE Boot disabled\n";
    }

    // Parse domain from httpBootUrl if possible
    let bootHostname = "proxmox-manager";
    try {
        if (settings.httpBootUrl) {
            bootHostname = new URL(settings.httpBootUrl).hostname;
        }
    } catch (e) { }

    return `# PXE Boot Configuration - Managed by Lumen Panel
# Do not edit manually - changes may be overwritten

# Network interface
interface=${settings.interface}
bind-interfaces

# DHCP Configuration
dhcp-range=${settings.dhcpRangeStart},${settings.dhcpRangeEnd},${settings.subnetMask},${settings.leaseTime}
dhcp-option=option:router,${settings.gateway}
dhcp-option=option:dns-server,${settings.dnsServer}

# TFTP Server
enable-tftp
tftp-root=${settings.tftpRoot}
# Explicit TFTP Server (Option 66)
dhcp-option=66,${bootHostname}

# iPXE Chainloading Detection
dhcp-userclass=set:ipxe,iPXE

# Architecture detection
dhcp-match=set:efi-x86_64,option:client-arch,7
dhcp-match=set:efi-x86_64,option:client-arch,9
dhcp-match=set:bios,option:client-arch,0

# Boot file selection:
# iPXE clients → HTTP boot script
dhcp-boot=tag:ipxe,${settings.httpBootUrl}

# Legacy PXE → chainload iPXE
dhcp-boot=tag:!ipxe,tag:efi-x86_64,ipxe.efi
dhcp-boot=tag:!ipxe,tag:bios,undionly.kpxe
dhcp-boot=tag:!ipxe,undionly.kpxe

# Logging
log-dhcp
log-facility=/var/log/dnsmasq-pxe.log

# Static Reservations (Dedicated Servers)
${settings.staticHosts || ""}
`;
}

export async function regenerateDnsmasqConfig() {
    try {
        const settings = await prisma.pXESettings.findFirst();
        if (!settings) return; // No settings to apply

        // Fetch dedicated servers for static mapping
        const dedicatedServers = await prisma.dedicatedServer.findMany({
            where: {
                macAddress: { not: "" }
            }
        });

        // Generate static host lines
        const staticHosts = dedicatedServers
            .filter(s => s.macAddress)
            .map(s => {
                if (s.primaryIpv4) {
                    return `dhcp-host=${s.macAddress},${s.primaryIpv4},${s.hostname}`;
                } else {
                    return `dhcp-host=${s.macAddress},${s.hostname}`;
                }
            })
            .join("\n");

        // Cast prisma settings to interface (roughly compatible)
        const configContent = generateDnsmasqConfigContent({
            ...settings,
            staticHosts
        } as unknown as PXESettings);

        await writeFile("/etc/dnsmasq.d/pxe.conf", configContent);

        // Restart dnsmasq
        // We use || true to prevent crash if service not found (dev env), but in prod it should run.
        await execAsync("systemctl restart dnsmasq || echo 'Failed to restart dnsmasq'");
        console.log("[PXE] Dnsmasq config regenerated and restarted.");

    } catch (error) {
        console.error("[PXE] Failed to regenerate dnsmasq config:", error);
        throw error;
    }
}
