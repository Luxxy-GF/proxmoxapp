import { DedicatedServer } from "@prisma/client";
import { randomBytes } from "crypto";

// Helper to generate a random password
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

export function generateUbuntu2404Preseed(
    server: DedicatedServer,
    callbackUrl: string,
    installToken: string,
    userData?: UserData
): { content: string; rootPassword: string } {
    // Use provided password or generate new one
    const rootPassword = userData?.rootPassword || generatePassword(24);
    const hostname = userData?.hostname || server.hostname;

    // SSH Key Injection Logic
    let sshKeyCmds = "";
    if (userData?.sshKeys && userData.sshKeys.length > 0) {
        const keys = userData.sshKeys.join("\\n");
        sshKeyCmds = `
    in-target mkdir -p /root/.ssh; \\\\
    in-target chmod 700 /root/.ssh; \\\\
    in-target /bin/sh -c "echo '${keys}' >> /root/.ssh/authorized_keys"; \\\\
    in-target chmod 600 /root/.ssh/authorized_keys; \\\\`;
    }

    // Network Config Logic
    let netConfig = "";
    if (server.primaryIpv4 && server.gateway && server.netmask && server.nameservers) {
        // Static Config
        netConfig = `
# Static Network Configuration
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
        // DHCP Config
        netConfig = `
# DHCP Network Configuration
d-i netcfg/choose_interface select auto
d-i netcfg/disable_autoconfig boolean false
d-i netcfg/get_hostname string ${hostname}
d-i netcfg/get_domain string local
`;
    }

    // Disk Partitioning
    const diskConfig = `
# Disk Partitioning
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
#### Ubuntu 24.04 LTS (Noble Numbat) Unattended Install

### Localization
d-i debian-installer/locale string en_US.UTF-8
d-i keyboard-configuration/xkb-keymap select us

### Network configuration
${netConfig}

### Mirror settings
d-i mirror/country string manual
d-i mirror/http/hostname string archive.ubuntu.com
d-i mirror/http/directory string /ubuntu
d-i mirror/http/proxy string

### Account setup
# Root password
d-i passwd/root-login boolean true
d-i passwd/root-password password ${rootPassword}
d-i passwd/root-password-again password ${rootPassword}
d-i passwd/make-user boolean false

### Clock and time zone settings
d-i clock-setup/utc boolean true
d-i time/zone string UTC
d-i clock-setup/ntp boolean true

### Progress Reporting (Partitioning)
d-i partman/early_command string \\\\
    wget --no-check-certificate -qO- --post-data='{"mac": "${server.macAddress}", "status": "progress", "progress": "10", "stage": "partitioning", "token": "${installToken}"}' --header="Content-Type: application/json" "${callbackUrl}"

d-i partman/late_command string \\\\
    wget --no-check-certificate -qO- --post-data='{"mac": "${server.macAddress}", "status": "progress", "progress": "30", "stage": "installing_base", "token": "${installToken}"}' --header="Content-Type: application/json" "${callbackUrl}"

### Partitioning
${diskConfig}

### Base system installation
d-i base-installer/install-recommends boolean false

### Apt setup
d-i apt-setup/universe boolean true
d-i apt-setup/multiverse boolean true

### Package selection
tasksel tasksel/first multiselect standard, openssh-server

# Individual packages
d-i pkgsel/include string curl wget sudo ca-certificates

### Boot loader installation
d-i grub-installer/only_debian boolean true
d-i grub-installer/with_other_os boolean true
d-i grub-installer/bootdev string default

### Finishing up
d-i finish-install/reboot_in_progress note

### Late Command (Callback & SSH & Post-Install)
d-i preseed/late_command string \\\\
    in-target sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/g' /etc/ssh/sshd_config; \\\\
    ${sshKeyCmds}
    in-target systemctl restart ssh; \\\\
    in-target curl -X POST -H "Content-Type: application/json" -d '{"mac": "${server.macAddress}", "status": "progress", "progress": "90", "stage": "finalizing", "token": "${installToken}"}' "${callbackUrl}"; \\\\
    in-target curl -X POST -H "Content-Type: application/json" -d '{"mac": "${server.macAddress}", "status": "success", "progress": "100", "stage": "complete", "token": "${installToken}"}' "${callbackUrl}";

`;

    return { content: preseed, rootPassword };
}
