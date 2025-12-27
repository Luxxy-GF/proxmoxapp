import { DedicatedServer } from "@prisma/client";
import { randomBytes } from "crypto";

function generatePassword(length = 16): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(randomBytes(length))
        .map((b) => chars[b % chars.length])
        .join("");
}

export interface UserData {
    hostname?: string;
    rootPassword?: string;
    sshKeys?: string[];
}

export function generateDebian13ProxmoxPreseed(
    server: DedicatedServer,
    callbackUrl: string,
    installToken: string,
    userData?: UserData
): { content: string; rootPassword: string } {
    const rootPassword = userData?.rootPassword || generatePassword(24);
    const hostname = userData?.hostname || server.hostname;

    // --- Networking ---
    // We need to determine the primary interface. 'auto' usually picks the first.
    // We will hardcode 'vmbr0' logic in the post-install script.

    // Initial Preseed Network (for installer)
    let netConfig = "";
    if (server.primaryIpv4 && server.gateway && server.netmask && server.nameservers) {
        netConfig = `
d-i netcfg/choose_interface select auto
d-i netcfg/disable_autoconfig boolean true
d-i netcfg/get_nameservers string ${server.nameservers}
d-i netcfg/get_ipaddress string ${server.primaryIpv4}
d-i netcfg/get_netmask string ${server.netmask}
d-i netcfg/get_gateway string ${server.gateway}
d-i netcfg/confirm_static boolean true
d-i netcfg/get_hostname string ${hostname}
`;
    } else {
        netConfig = `
d-i netcfg/choose_interface select auto
d-i netcfg/disable_autoconfig boolean false
d-i netcfg/get_hostname string ${hostname}
`;
    }

    // --- SSH Keys ---
    let sshKeyCmds = "";
    if (userData?.sshKeys && userData.sshKeys.length > 0) {
        const keys = userData.sshKeys.join("\\n");
        sshKeyCmds = `
    in-target mkdir -p /root/.ssh; \\
    in-target chmod 700 /root/.ssh; \\
    in-target /bin/sh -c "echo '${keys}' >> /root/.ssh/authorized_keys"; \\
    in-target chmod 600 /root/.ssh/authorized_keys; \\`;
    }

    // --- First Boot Script (The Heavy Lifter) ---
    // This script runs AFTER the first reboot, running inside the new system (Debian 13).
    // It detects if it's running the PVE kernel.
    // If not (unlikely if late_command works), it might fail or try to install it.
    // Because we install the kernel in late_command, it should boot into it.

    // Note: We need to properly escape $ variables for the preseed echo.
    const firstBootScript = `#!/bin/bash
# Log output to console and file for visibility
exec > >(tee -a /var/log/pve-install.log) 2>&1

echo "Starting Proxmox VE 9 Post-Install Setup..."

# Wait for Network (Race condition fix) - simplified but robust
echo "Waiting for network..."
for i in {1..30}; do
    if ip route | grep default >/dev/null; then
        echo "Network route found."
        # Try ping to verify actual flow
        if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
             echo "Internet connectivity confirmed."
             break
        fi
    fi
    sleep 2
done

# Signal Start (fail-safe)
curl -X POST -H "Content-Type: application/json" -d '{"mac": "${server.macAddress}", "status": "progress", "progress": "60", "stage": "installing_proxmox_packages", "token": "${installToken}"}' "${callbackUrl}" || true

# 0.5. PRE-INSTALL FIX: Configure /etc/hosts & Hostname
# Proxmox requires the hostname to resolve to the static IP, NOT 127.0.1.1, otherwise pve-cluster fails to start.
echo "Configuring /etc/hosts for Proxmox..."

# Ensure hostname is set
hostnamectl set-hostname ${hostname}

# Detect IP if not provided by template (fallback)
SERVER_IP="${server.primaryIpv4}"
if [ -z "$SERVER_IP" ]; then
    echo "No static IP in template, detecting..."
    # Robust IP detection: getting first non-loopback IPv4
    SERVER_IP=$(ip -4 addr show | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){3}' | grep -v '127.0.0.1' | head -n 1)
fi

# Write hosts file (only if we found an IP, otherwise stick to localhost to avoid total breakage, though PVE might hate it)
if [ -n "$SERVER_IP" ]; then
    cat > /etc/hosts <<EOF
127.0.0.1       localhost
$SERVER_IP   ${hostname}.luxxy.cloud ${hostname}

# The following lines are desirable for IPv6 capable hosts
::1     localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
EOF
fi

# 1. Install Proxmox VE Packages
echo "Installing Proxmox VE packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update || true
# postfix selection: Local only
echo "postfix postfix/main_mailer_type select Local only" | debconf-set-selections
echo "postfix postfix/mailname string ${hostname}" | debconf-set-selections

# install packages
curl -X POST -H "Content-Type: application/json" -d '{"mac": "${server.macAddress}", "status": "progress", "progress": "65", "stage": "downloading_packages", "token": "${installToken}"}' "${callbackUrl}" || true
apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" proxmox-ve postfix open-iscsi chrony || true

# 2. Cleanup Debian Kernel
echo "Removing standard Debian kernel..."
curl -X POST -H "Content-Type: application/json" -d '{"mac": "${server.macAddress}", "status": "progress", "progress": "80", "stage": "cleaning_debian_kernel", "token": "${installToken}"}' "${callbackUrl}" || true
apt-get remove -y linux-image-amd64 'linux-image-6.1*' || true
update-grub || true

# 3. Remove os-prober
apt-get remove -y os-prober || true

# 4. Network Configuration (Bridge)
echo "Configuring vmbr0..."
curl -X POST -H "Content-Type: application/json" -d '{"mac": "${server.macAddress}", "status": "progress", "progress": "85", "stage": "configuring_network", "token": "${installToken}"}' "${callbackUrl}" || true

# Detect Primary Interface (Physical)
# We look for the interface that has the default route, OR the first non-loopback interface if network is down.
PRIMARY_IF=$(ip route show default | awk '{print $5}' | head -n 1)
if [ -z "$PRIMARY_IF" ]; then
    # Fallback: First non-loopback link
    PRIMARY_IF=$(ip -o link show | awk -F': ' '$2 != "lo" {print $2}' | head -n 1)
fi

echo "Detected primary interface: $PRIMARY_IF"

if [ -n "$PRIMARY_IF" ]; then
    # Generate /etc/network/interfaces
    
    cat > /etc/network/interfaces <<EOF
auto lo
iface lo inet loopback

iface $PRIMARY_IF inet manual

auto vmbr0
EOF

${server.primaryIpv4
            ? `
    cat >> /etc/network/interfaces <<EOF
iface vmbr0 inet static
    address ${server.primaryIpv4}
    netmask ${server.netmask}
    gateway ${server.gateway}
    bridge_ports $PRIMARY_IF
    bridge_stp off
    bridge_fd 0
EOF
`
            : `
    cat >> /etc/network/interfaces <<EOF
iface vmbr0 inet dhcp
    bridge_ports $PRIMARY_IF
    bridge_stp off
    bridge_fd 0
EOF
`
        }

else
    echo "ERROR: Could not detect primary interface. Skipping network config rewrite."
fi

# 5. Success Callback
echo "Sending success callback..."
curl -X POST -H "Content-Type: application/json" -d '{"mac": "${server.macAddress}", "status": "success", "progress": "100", "stage": "complete", "message": "Proxmox VE Installed Successfully", "token": "${installToken}"}' "${callbackUrl}" || true

# 6. Disable Self
systemctl disable pve-install
rm /etc/systemd/system/pve-install.service
rm /usr/local/bin/pve-install.sh

echo "Done. Rebooting into final PVE state..."
reboot
`;

    // Systemd Unit for First Boot
    const firstBootUnit = `[Unit]
Description=Proxmox VE First Boot Install
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/pve-install.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
`;

    // --- Late Command ---
    // Actions:
    // 1. Add PVE Repos & Keys
    // 2. Install PVE Kernel
    // 3. Write FirstBoot script & Unit
    // 4. Enable Unit

    const scriptB64 = Buffer.from(firstBootScript).toString('base64');
    const unitB64 = Buffer.from(firstBootUnit).toString('base64');

    // NOTE: We MUST avoid '#' comments in the string below as they can break the preseed parser or shell execution
    // if flattened incorrectly. We use strict chaining.
    const lateCommand = `
    in-target env DEBIAN_FRONTEND=noninteractive apt-get install -y curl wget sudo ca-certificates gnupg; \\
    ${sshKeyCmds}
    in-target sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/g' /etc/ssh/sshd_config; \\
    in-target /bin/bash -c "printf 'Types: deb\\nURIs: http://download.proxmox.com/debian/pve\\nSuites: trixie\\nComponents: pve-no-subscription\\nSigned-By: /usr/share/keyrings/proxmox-archive-keyring.gpg\\n' > /etc/apt/sources.list.d/pve-install-repo.sources"; \\
    in-target wget https://enterprise.proxmox.com/debian/proxmox-archive-keyring-trixie.gpg -O /usr/share/keyrings/proxmox-archive-keyring.gpg; \\
    in-target env DEBIAN_FRONTEND=noninteractive apt-get update; \\
    in-target curl -X POST -H "Content-Type: application/json" -d '{"mac": "${server.macAddress}", "status": "progress", "progress": "40", "stage": "installing_pve_kernel", "token": "${installToken}"}' "${callbackUrl}" || true; \\
    in-target env DEBIAN_FRONTEND=noninteractive apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" proxmox-default-kernel; \\
    in-target /bin/bash -c "echo '${scriptB64}' | base64 -d > /usr/local/bin/pve-install.sh"; \\
    in-target chmod +x /usr/local/bin/pve-install.sh; \\
    in-target /bin/bash -c "echo '${unitB64}' | base64 -d > /etc/systemd/system/pve-install.service"; \\
    in-target mkdir -p /etc/systemd/system/multi-user.target.wants; \\
    in-target ln -s /etc/systemd/system/pve-install.service /etc/systemd/system/multi-user.target.wants/pve-install.service; \\
    in-target curl -X POST -H "Content-Type: application/json" -d '{"mac": "${server.macAddress}", "status": "progress", "progress": "50", "stage": "rebooting_to_pve", "token": "${installToken}"}' "${callbackUrl}" || true;
    `;

    // --- Disk Config ---
    const diskConfig = `
d-i partman-auto/disk string /dev/sda /dev/vda /dev/nvme0n1
d-i partman-auto/method string regular
d-i partman-auto/choose_recipe select atomic
d-i partman-partitioning/confirm_write_new_label boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_nooverwrite boolean true
    `;

    const preseed = `
#_preseed_V1
#### Proxmox VE 9 (Debian 13) Unattended Install
d-i debian-installer/locale string en_US
d-i keyboard-configuration/xkb-keymap select us

${netConfig}

d-i mirror/country string manual
d-i mirror/http/hostname string deb.debian.org
d-i mirror/http/directory string /debian
d-i mirror/http/proxy string

d-i passwd/root-login boolean true
d-i passwd/root-password password ${rootPassword}
d-i passwd/root-password-again password ${rootPassword}
d-i passwd/make-user boolean false

d-i clock-setup/utc boolean true
d-i time/zone string UTC
d-i clock-setup/ntp boolean true

d-i partman/early_command string \\
    wget --no-check-certificate -qO- --post-data='{"mac": "${server.macAddress}", "status": "progress", "progress": "10", "stage": "partitioning", "token": "${installToken}"}' --header="Content-Type: application/json" "${callbackUrl}"

${diskConfig}

d-i base-installer/install-recommends boolean false
d-i apt-setup/cdrom/set-first boolean false
d-i apt-setup/use_mirror boolean true

tasksel tasksel/first multiselect standard, ssh-server

d-i grub-installer/only_debian boolean true
d-i grub-installer/with_other_os boolean true
d-i grub-installer/bootdev string default

d-i finish-install/reboot_in_progress note

d-i preseed/late_command string \\
${lateCommand}
`;

    return { content: preseed, rootPassword };
}
