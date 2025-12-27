
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// This endpoint serves the #cloud-config YAML
export async function GET(
    req: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    // Validate token
    const install = await prisma.pXEInstall.findUnique({
        where: { token },
        include: { server: true }
    });

    if (!install) {
        return new NextResponse("Invalid Token", { status: 403 });
    }

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://coterm.luxxy.xyz"}/api/pxe/callback`;

    // Construct the inventory collection script
    // We use 'write_files' to put the script on disk, then 'runcmd' to execute it.
    // This allows meaningful error handling and complex piping.

    const inventoryScript = `#!/bin/bash
set -e

echo "Starting Inventory Scan..."

# Ensure jq is installed
echo "Installing dependencies..."
# We need to wait for network-online sometimes, but usually early-commands run after net.
# Attempt to install jq.
apt-get update -y
apt-get install -y jq lshw

# Collect Data
# We use tools likely present in Ubuntu Live Server: lshw, lsblk, dmidecode, ip

# 1. CPU
# lshw -json -class cpu (might be verbose, let's stick to /proc/cpuinfo for parsing or lshw if simple)
# The user asked for lshw -json, lsblk -J
# We fallback to standard files if tools miss.

echo "Collecting CPU..."
CPU_JSON=$(lshw -json -class cpu 2>/dev/null || echo "{}")

echo "Collecting RAM..."
MEM_JSON=$(lshw -json -class memory 2>/dev/null || echo "{}")

echo "Collecting Disks..."
DISK_JSON=$(lsblk -J -o NAME,SIZE,MODEL,TYPE,ROTA 2>/dev/null || echo "{}")

echo "Collecting Network..."
NET_JSON=$(ip -j addr 2>/dev/null || echo "{}")

echo "Collecting DMI..."
# dmidecode is text output, harder to parse to JSON directly without tools. 
# We'll just grab system info roughly or skip if too complex for bash-only json construction.
# DMI_SYS=$(dmidecode -t system)

# Construct Payload
# We use jq if available, otherwise manual construction is risky for big blobs.
# Ubuntu Live usually has jq.
if command -v jq >/dev/null; then
    jq -n \\
      --argjson cpu "$CPU_JSON" \\
      --argjson ram "$MEM_JSON" \\
      --argjson disks "$DISK_JSON" \\
      --argjson net "$NET_JSON" \\
      --arg token "${token}" \\
      --arg mac "${install.server.macAddress}" \\
      '{
        mac: $mac,
        token: $token,
        status: "inventory",
        hardware: {
            cpu: $cpu, 
            ram: $ram, 
            disks: $disks, 
            net: $net,
            # We also map to our simple schema for the dashboard
            cpuModel: ($cpu[0].product // "Unknown"),
            cpuCores: ($cpu[0].configuration.cores // 0 | tonumber),
            # Sum up all memory banks
            # lshw -class memory returns an array of banks or a single object.
            # We map to size, map to number, add them up.
            ramMiB: ([$ram[] | .size] | add | . / 1024 / 1024 | floor),
            # Flatten disks for simple view
            simpleDisks: $disks.blockdevices
        }
      }' > /tmp/payload.json
else
    # Fallback minimal JSON construction
    echo "jq not found, using minimal fallback..."
    # ... (omitted for brevity, assuming Ubuntu Live has Python3 or python3-json or perl)
    # Ubuntu 22.04 Live HAS python3.
    python3 -c "
import json, subprocess
def get_out(cmd):
    try: return subprocess.check_output(cmd, shell=True).decode()
    except: return '{}'

cpu = json.loads(get_out('lshw -json -class cpu') or '[]')
mem = json.loads(get_out('lshw -json -class memory') or '[]')
dsk = json.loads(get_out('lsblk -J -o NAME,SIZE,MODEL,TYPE,ROTA') or '{}')
net = json.loads(get_out('ip -j addr') or '[]')

# Handle mem being a list or dict
if isinstance(mem, dict): mem = [mem]
total_ram = sum([int(m.get('size', 0)) for m in mem])

payload = {
    'mac': '${install.server.macAddress}',
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

# Send Payload
echo "Sending Payload to ${callbackUrl}..."
curl -X POST -H "Content-Type: application/json" -d @/tmp/payload.json "${callbackUrl}"

echo "Done. Rebooting..."
reboot
`;

    // Cloud-Config YAML
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
  # We don't want to install to disk!
  # But autoinstall tries to install. 
  # We must use 'interactive-sections' or 'early-commands' and then fail/reboot before disk wipe?
  # actually 'interactive-sections: ["*"]' stops it?
  # OR we just run our script in 'early-commands' and reboot immediately so prompt never happens.
  early-commands:
    - mkdir -p /opt/inventory
    - echo '${Buffer.from(inventoryScript).toString('base64')}' | base64 -d > /opt/inventory/scan.sh
    - chmod +x /opt/inventory/scan.sh
    - /opt/inventory/scan.sh
`;

    return new NextResponse(cloudConfig, {
        headers: { 'Content-Type': 'text/yaml' }
    });
}
