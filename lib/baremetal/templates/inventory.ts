
import { DedicatedServer } from "@prisma/client";

export function generateInventoryPreseed(
    server: DedicatedServer,
    callbackUrl: string,
    installToken: string
): string {
    // Inventory Detection Script
    // We utilize `early_command` or just run it and fail/reboot. 
    // Actually partman/early_command is a good place as it runs after network but before disk wipage.

    // Script to gather info:
    // CPU: grep 'model name' /proc/cpuinfo | head -1
    // Cores: grep -c ^processor /proc/cpuinfo
    // RAM: grep MemTotal /proc/meminfo
    // Disks: loops over /sys/block/sd* /nvme* etc

    // We construct a shell one-liner or small script
    const detectionScript = `
        CPU_MODEL=$(grep 'model name' /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs);
        CPU_CORES=$(grep -c ^processor /proc/cpuinfo);
        RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}');
        RAM_MB=$((RAM_KB / 1024));
        
        # Disk Detection (Simpler approach using list-devices if available, or sysfs)
        # We will try to get a simple JSON list of disks
        DISKS=$(list-devices disk | while read p; do
            SIZE=$(cat /sys/block/$(basename $p)/size 2>/dev/null);
            # 512 byte sectors usually
            SIZE_GB=$((SIZE * 512 / 1024 / 1024 / 1024));
            MODEL=$(cat /sys/block/$(basename $p)/device/model 2>/dev/null || echo "Unknown");
            echo "{\\"name\\": \\"$(basename $p)\\", \\"size\\": \\"$\{SIZE_GB}GB\\", \\"model\\": \\"$MODEL\\"}";
        done | paste -sd "," -);
        
        PAYLOAD="{\\"mac\\": \\"${server.macAddress}\\", \\"status\\": \\"inventory\\", \\"token\\": \\"${installToken}\\", \\"hardware\\": {\\"cpuModel\\": \\"$CPU_MODEL\\", \\"cpuCores\\": $CPU_CORES, \\"ramMiB\\": $RAM_MB, \\"disks\\": [$DISKS]}}";
        
        wget --no-check-certificate -qO- --post-data="$PAYLOAD" --header="Content-Type: application/json" "${callbackUrl}";
    `;

    return `
#_preseed_V1
#### Hardware Inventory Scan
#### DOES NOT INSTALL - JUST SCANS AND REBOOTS

### Localization
d-i debian-installer/locale string en_US
d-i keyboard-configuration/xkb-keymap select us

### Network configuration
d-i netcfg/choose_interface select auto
d-i netcfg/disable_autoconfig boolean false
d-i netcfg/get_hostname string inventory-scan
d-i netcfg/get_domain string local

### Mirror settings (Minimal needed to load installer components)
d-i mirror/country string manual
d-i mirror/http/hostname string deb.debian.org
d-i mirror/http/directory string /debian
d-i mirror/http/proxy string

### Detection & Callback (Run as early as possible after network)
# We use partman/early_command because it guarantees network is up and installer tools are ready.
# We then intentionally reboot to avoid installing.
d-i partman/early_command string \\
    ${detectionScript.replace(/\n/g, ' ').replace(/\s+/g, ' ')} \\
    reboot;

### Prevent actual partitioning/installing if script fails
d-i partman-auto/method string regular
d-i partman-auto/disk string /dev/null

### Finishing up
d-i finish-install/reboot_in_progress note
`;
}
