#!/bin/bash
# ============================================================
# PROXMOX VE FIRST-BOOT PROVISIONING SCRIPT
# ============================================================
# This script runs ONCE on first boot via systemd.
# It installs Proxmox VE, configures networking, and self-disables.
# ============================================================

# ------------------------------------------------------------
# PHASE 1: DNS FIX (APT requires working DNS)
# ------------------------------------------------------------
echo "[1/6] Fixing DNS resolution..."

# Backup original resolv.conf
cp /etc/resolv.conf /etc/resolv.conf.bak.firstboot 2>/dev/null || true

# Inject known-good public DNS
cat > /etc/resolv.conf << "DNS_EOF"
# Temporary DNS for firstboot provisioning
nameserver 8.8.8.8
nameserver 1.1.1.1
DNS_EOF

# Wait for network to be fully ready
sleep 5

# Verify DNS works
for i in 1 2 3 4 5; do
    if ping -c1 -W5 download.proxmox.com > /dev/null 2>&1; then
        echo "DNS OK on attempt $i"
        break
    fi
    echo "DNS check failed, retrying ($i/5)..."
    sleep 3
done

# ------------------------------------------------------------
# PHASE 2: CONFIGURE PROXMOX APT REPOSITORY
# ------------------------------------------------------------
echo "[2/6] Adding Proxmox VE repository..."

# Detect Debian codename (bookworm/trixie)
CODENAME=$(grep VERSION_CODENAME /etc/os-release | cut -d= -f2)
if [[ -z "$CODENAME" ]]; then
    CODENAME="bookworm"
fi

echo "Detected Debian codename: $CODENAME"

# Remove any existing Proxmox repos first
rm -f /etc/apt/sources.list.d/pve-enterprise.list 2>/dev/null || true
rm -f /etc/apt/sources.list.d/pve-install-repo.list 2>/dev/null || true

# Add Proxmox VE no-subscription repository
echo "deb [arch=amd64] http://download.proxmox.com/debian/pve ${CODENAME} pve-no-subscription" > /etc/apt/sources.list.d/pve-install-repo.list

# Download and install Proxmox GPG key BEFORE apt update
echo "Downloading Proxmox GPG key..."
wget -q "http://download.proxmox.com/debian/proxmox-release-${CODENAME}.gpg" -O /etc/apt/trusted.gpg.d/proxmox-release-${CODENAME}.gpg

if [[ ! -s /etc/apt/trusted.gpg.d/proxmox-release-${CODENAME}.gpg ]]; then
    echo "ERROR: Failed to download Proxmox GPG key. Trying alternative method..."
    curl -fsSL "http://download.proxmox.com/debian/proxmox-release-${CODENAME}.gpg" -o /etc/apt/trusted.gpg.d/proxmox-release-${CODENAME}.gpg
fi

# Verify key was downloaded
if [[ -s /etc/apt/trusted.gpg.d/proxmox-release-${CODENAME}.gpg ]]; then
    echo "GPG key installed successfully."
else
    echo "ERROR: GPG key download failed. Aborting."
    exit 1
fi

echo "Proxmox repository configured."

# ------------------------------------------------------------
# PHASE 3: SYSTEM UPDATE AND PROXMOX INSTALLATION
# ------------------------------------------------------------
echo "[3/6] Updating system and installing Proxmox VE..."

export DEBIAN_FRONTEND=noninteractive

# Update package lists
apt-get update -y

# Full system upgrade
apt-get dist-upgrade -y \
    -o Dpkg::Options::="--force-confdef" \
    -o Dpkg::Options::="--force-confold"

# Install Proxmox VE kernel and core packages
apt-get install -y \
    -o Dpkg::Options::="--force-confdef" \
    -o Dpkg::Options::="--force-confold" \
    proxmox-ve postfix open-iscsi chrony

# Remove conflicting Debian kernel (Proxmox provides its own)
apt-get remove -y linux-image-amd64 'linux-image-6.*' 2>/dev/null || true
apt-get autoremove -y

echo "Proxmox VE installed."

# ------------------------------------------------------------
# PHASE 4: CONFIGURE STATIC NETWORKING WITH vmbr0
# ------------------------------------------------------------
echo "[4/6] Configuring static networking..."

# Get current network configuration from DHCP
PRIMARY_IFACE=$(ip route | grep default | head -1 | awk '{print $5}')
CURRENT_IP=$(ip -4 addr show dev "$PRIMARY_IFACE" | grep inet | head -1 | awk '{print $2}')
IP_ADDR=$(echo "$CURRENT_IP" | cut -d/ -f1)
PREFIX=$(echo "$CURRENT_IP" | cut -d/ -f2)
GATEWAY=$(ip route | grep default | head -1 | awk '{print $3}')

# Validate we have required values
if [[ -z "$IP_ADDR" ]] || [[ -z "$GATEWAY" ]] || [[ -z "$PRIMARY_IFACE" ]]; then
    echo "ERROR: Failed to detect network configuration."
    echo "IP=$IP_ADDR GW=$GATEWAY IFACE=$PRIMARY_IFACE"
    exit 1
fi

# Write Proxmox-compatible network config
cat > /etc/network/interfaces << NETEOF
# Loopback
auto lo
iface lo inet loopback

# Physical interface (bridged)
auto ${PRIMARY_IFACE}
iface ${PRIMARY_IFACE} inet manual

# Proxmox bridge
auto vmbr0
iface vmbr0 inet static
    address ${IP_ADDR}/${PREFIX}
    gateway ${GATEWAY}
    bridge-ports ${PRIMARY_IFACE}
    bridge-stp off
    bridge-fd 0
    dns-nameservers 8.8.8.8 1.1.1.1
NETEOF

echo "Network configured: ${IP_ADDR}/${PREFIX} via vmbr0 (${PRIMARY_IFACE})"

# ------------------------------------------------------------
# PHASE 5: FINALIZE
# ------------------------------------------------------------
echo "[5/6] Finalizing configuration..."

# Restore original DNS if backup exists
if [[ -f /etc/resolv.conf.bak.firstboot ]]; then
    mv /etc/resolv.conf.bak.firstboot /etc/resolv.conf
fi

# Update GRUB
update-grub

# ------------------------------------------------------------
# PHASE 6: REBOOT
# ------------------------------------------------------------
echo "[6/6] Scheduling reboot..."

echo "========================================"
echo "FIRST-BOOT PROVISIONING COMPLETE"
echo "Rebooting in 10 seconds..."
echo "========================================"

sleep 10
systemctl reboot
