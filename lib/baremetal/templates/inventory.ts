
import { DedicatedServer } from "@prisma/client";

export function generateInventoryPreseed(
    server: DedicatedServer,
    callbackUrl: string,
    installToken: string
): string {
    // Comprehensive Hardware Inventory Collection Script
    // Uses dmidecode, lspci, and system tools to gather detailed component info

    const detectionScript = `
        # Install required tools
        apt-get update >/dev/null 2>&1;
        apt-get install -y dmidecode pciutils lshw jq >/dev/null 2>&1;
        
        # CPU Information
        CPU_MODEL=$(grep 'model name' /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs | sed 's/  */ /g');
        CPU_CORES=$(grep -c ^processor /proc/cpuinfo);
        CPU_SPEED=$(grep 'cpu MHz' /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs | awk '{printf "%.2f GHz", $1/1000}');
        
        # RAM Information
        RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}');
        RAM_MB=$((RAM_KB / 1024));
        
       # Individual RAM Modules via dmidecode
        RAM_MODULES=$(dmidecode -t memory | awk '
            /Memory Device$/,/^$/ {
                if ($0 ~ /Size:/ && $0 !~ /No Module Installed/ && $0 !~ /^[[:space:]]*Size: 0/) {
                    size = substr($0, index($0, ":") + 2);
                }
                if ($0 ~ /Locator:/ && $0 !~ /Bank Locator/) {
                    slot = substr($0, index($0, ":") + 2);
                }
                if ($0 ~ /Part Number:/) {
                    model = substr($0, index($0, ":") + 2);
                    gsub(/^[[:space:]]+|[[:space:]]+$/, "", model);
                }
                if ($0 ~ /Serial Number:/) {
                    serial = substr($0, index($0, ":") + 2);
                    gsub(/^[[:space:]]+|[[:space:]]+$/, "", serial);
                    if (size != "" && size !~ /No Module/) {
                        printf "{\\\"slot\\\":\\\"%s\\\",\\\"size\\\":\\\"%s\\\",\\\"model\\\":\\\"%s\\\",\\\"serial\\\":\\\"%s\\\"},", slot, size, model, serial;
                        size=""; slot=""; model=""; serial="";
                    }
                }
            }
        ' | sed 's/,$//')
        RAM_MODULES="[$RAM_MODULES]";
        
        # BIOS Information
        BIOS_VENDOR=$(dmidecode -s bios-vendor 2>/dev/null | head -1 | xargs);
        BIOS_VERSION=$(dmidecode -s bios-version 2>/dev/null | head -1 | xargs);
        BIOS_DATE=$(dmidecode -s bios-release-date 2>/dev/null | head -1 | xargs);
        
        # Mainboard Information  
        MB_MODEL=$(dmidecode -s baseboard-product-name 2>/dev/null | head -1 | xargs);
        MB_SERIAL=$(dmidecode -s baseboard-serial-number 2>/dev/null | head -1 | xargs);
        SYS_VENDOR=$(dmidecode -s system-manufacturer 2>/dev/null | head -1 | xargs);
        SYS_MODEL=$(dmidecode -s system-product-name 2>/dev/null | head -1 | xargs);
        SYS_SERIAL=$(dmidecode -s system-serial-number 2>/dev/null | head -1 | xargs);
        
        # Storage Controllers via lspci
        STORAGE_CONTROLLERS=$(lspci | grep -i -E 'raid|storage|sata|sas|scsi|nvme' | awk -F': ' '{
            model = $2;
            gsub(/"/, "\\\\\\"", model);
            vendor = $1;
            gsub(/^[0-9a-f:.]+[[:space:]]+/, "", vendor);
            gsub(/"/, "\\\\\\"", vendor);
            printf "{\\\"model\\\":\\\"%s\\\",\\\"vendor\\\":\\\"%s\\\"},", model, vendor;
        }' | sed 's/,$//')
        STORAGE_CONTROLLERS="[$STORAGE_CONTROLLERS]";
        
        # Network Interfaces via lspci and ip
        NICS=$(lspci | grep -i 'ethernet\\|network' | while read line; do
            MODEL=$(echo "$line" | awk -F': ' '{print $2}' | sed 's/"//g');
            VENDOR=$(echo "$line" | awk -F': ' '{print $1}' | sed 's/^[0-9a-f:.]\+[[:space:]]\+//g' | sed 's/"//g');
            
            # Try to find MAC for this device
            DEVICE=$(echo "$line" | awk '{print $1}');
            MAC=$(ip -br link | grep -i "$DEVICE" | awk '{print $3}' | head -1);
            if [ -z "$MAC" ]; then
                MAC=$(ip -br link | tail -n +2 | head -1 | awk '{print $3}');
            fi
            
            echo "{\\\"model\\\":\\\"$MODEL\\\",\\\"vendor\\\":\\\"$VENDOR\\\",\\\"mac\\\":\\\"$MAC\\\"}";
        done | paste -sd "," -)
        if [ -z "$NICS" ]; then
            # Fallback: get all non-loopback interfaces
            NICS=$(ip -br link | grep -v 'lo' | awk '{printf "{\\\"mac\\\":\\\"%s\\\",\\\"model\\\":\\\"Unknown\\\",\\\"vendor\\\":\\\"Unknown\\\"},", $3}' | sed 's/,$//')
        fi
        NICS="[$NICS]";
        
        # Disk Detection (Enhanced with serial numbers)
        DISKS=$(lsblk -d -o NAME,SIZE,MODEL,SERIAL -n -b -J 2>/dev/null | jq -c '[.blockdevices[] | select(.name | test("^(sd|nvme|vd)") ) | {name: .name, size: (.size | tonumber / 1024 / 1024 / 1024 | tostring + "GB"), model: (.model // "Unknown"), serial: (.serial // "-")}]' 2>/dev/null);
        if [ -z "$DISKS" ] || [ "$DISKS" = "null" ]; then
            # Fallback to simpler method
            DISKS=$(list-devices disk 2>/dev/null | while read p; do
                NAME=$(basename $p);
                SIZE=$(cat /sys/block/$NAME/size 2>/dev/null);
                SIZE_GB=$((SIZE * 512 / 1024 / 1024 / 1024));
                MODEL=$(cat /sys/block/$NAME/device/model 2>/dev/null | xargs || echo "Unknown");
                SERIAL=$(cat /sys/block/$NAME/device/serial 2>/dev/null | xargs || echo "-");
                echo "{\\\"name\\\":\\\"$NAME\\\",\\\"size\\\":\\\"${SIZE_GB}GB\\\",\\\"model\\\":\\\"$MODEL\\\",\\\"serial\\\":\\\"$SERIAL\\\"}";
            done | paste -sd "," -)
            DISKS="[$DISKS]";
        fi
        
        # Construct JSON Payload
        PAYLOAD=$(cat <<EOFPAYLOAD
{
  "mac": "${server.macAddress}",
  "status": "inventory",
  "token": "${installToken}",
  "hardware": {
    "cpuModel": "$CPU_MODEL",
    "cpuCores": $CPU_CORES,
    "cpuSpeed": "$CPU_SPEED",
    "ramMiB": $RAM_MB,
    "ramModules": $RAM_MODULES,
    "biosVendor": "$BIOS_VENDOR",
    "biosVersion": "$BIOS_VERSION",
    "biosDate": "$BIOS_DATE",
    "mainboardModel": "$MB_MODEL",
    "mainboardSerial": "$MB_SERIAL",
    "vendor": "$SYS_VENDOR",
    "model": "$SYS_MODEL",
    "serial": "$SYS_SERIAL",
    "storageControllers": $STORAGE_CONTROLLERS,
    "nics": $NICS,
    "disks": $DISKS
  }
}
EOFPAYLOAD
        )
        
        # Send to callback
        echo "$PAYLOAD" | wget --no-check-certificate -qO- --post-data=@- --header="Content-Type: application/json" "${callbackUrl}";
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
d-i partman/early_command string \\\\
    in-target /bin/bash -c '${detectionScript.replace(/\n/g, ' ').replace(/\s+/g, ' ')}' || true; \\\\
    reboot;

### Prevent actual partitioning/installing if script fails
d-i partman-auto/method string regular
d-i partman-auto/disk string /dev/null

### Finishing up
d-i finish-install/reboot_in_progress note
`;
}
