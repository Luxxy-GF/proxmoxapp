import { prisma } from "../lib/db";

// Same script as before but adds DNS setup at the top
const script = `cat > /etc/apt/sources.list.d/pve-install.sources << EOF
Types: deb
URIs: http://download.proxmox.com/debian/pve
Suites: trixie
Components: pve-no-subscription
Signed-By: /usr/share/keyrings/proxmox-archive-keyring.gpg
EOF

# FIX DNS: Ensure we can resolve domains
echo "nameserver 1.1.1.1" > /etc/resolv.conf
echo "nameserver 8.8.8.8" >> /etc/resolv.conf

wget https://enterprise.proxmox.com/debian/proxmox-release-trixie.gpg -O /usr/share/keyrings/proxmox-archive-keyring.gpg
apt update
DEBIAN_FRONTEND=noninteractive apt full-upgrade -y --install-recommends
DEBIAN_FRONTEND=noninteractive apt install proxmox-ve postfix open-iscsi chrony -y --install-recommends
DEBIAN_FRONTEND=noninteractive apt remove os-prober -y
DEBIAN_FRONTEND=noninteractive apt install net-tools -y --install-recommends
update-grub

# Get the default interface
INTERFACE=\$(ip route | grep default | awk '{print \$5}')

# Configure network with static IP - write to .new file
cat > /etc/network/interfaces.new << NETEOF
auto lo
iface lo inet loopback

auto \$INTERFACE
iface \$INTERFACE inet manual

auto vmbr0
iface vmbr0 inet static
    address \$PRIMARY_IPV4
    netmask \$NETMASK
    gateway \$GATEWAY
    bridge_ports \$INTERFACE
    bridge_stp off
    bridge_fd 0
NETEOF

# Apply new network config after reboot
mv /etc/network/interfaces.new /etc/network/interfaces

# Reboot to apply changes
systemctl reboot`;

async function main() {
    const result = await prisma.pXEProfile.updateMany({
        where: { name: { contains: 'Proxmox' } },
        data: { customScripts: script }
    });
    console.log('Updated', result.count, 'profiles with DNS fix');
}

main().then(() => process.exit(0));
