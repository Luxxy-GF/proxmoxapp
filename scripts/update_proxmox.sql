-- Update Proxmox VE 9 with comprehensive config
UPDATE "PXEProfile" SET 
  "osFamily" = 'DEBIAN',
  "templateType" = 'PRESEED',
  "releaseVersion" = '9',
  "mirrorUrl" = 'http://ftp.de.debian.org',
  "httpDirectory" = 'debian',
  "timezone" = 'UTC',
  "language" = 'en_US',
  "completionEvent" = 'AFTER_FIRST_BOOT_AFTER_SCRIPTS',
  "bootScriptTemplate" = 'kernel http://ftp.debian.org/debian/dists/trixie/main/installer-amd64/current/images/netboot/debian-installer/amd64/linux auto=true url={{CONFIG_URL}} priority=critical initrd=initrd.magic
initrd http://ftp.debian.org/debian/dists/trixie/main/installer-amd64/current/images/netboot/debian-installer/amd64/initrd.gz
boot',
  "diskLayoutTemplate" = 'd-i preseed/early_command string umount /media || true
d-i partman-auto/method string lvm
d-i partman-auto-lvm/guided_size string max
d-i partman-lvm/device_remove_lvm boolean true
d-i partman-lvm/confirm boolean true
d-i partman-lvm/confirm_nooverwrite boolean true
d-i partman-auto-lvm/new_vg_name string main
d-i partman-md/device_remove_md boolean true
d-i partman-md/confirm boolean true
d-i partman-partitioning/confirm_write_new_label boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_nooverwrite boolean true
d-i partman-basicmethods/method_only boolean false
d-i grub-installer/only_debian boolean true
d-i grub-installer/with_other_os boolean true
d-i grub-installer/bootdev string default',
  "installTemplate" = 'd-i apt-setup/services-select multiselect security, updates
d-i apt-setup/security_host string security.debian.org
d-i apt-setup/non-free-firmware boolean true
d-i apt-setup/non-free boolean true
d-i apt-setup/contrib boolean true
tasksel tasksel/first multiselect minimal
popularity-contest popularity-contest/participate boolean false',
  "customScripts" = 'echo "deb [arch=amd64] http://download.proxmox.com/debian/pve trixie pve-no-subscription" > /etc/apt/sources.list.d/pve-install-repo.list
wget https://enterprise.proxmox.com/debian/proxmox-release-trixie.gpg -O /etc/apt/trusted.gpg.d/proxmox-release-trixie.gpg
apt update
DEBIAN_FRONTEND=noninteractive apt full-upgrade -y --install-recommends
DEBIAN_FRONTEND=noninteractive apt install proxmox-ve postfix open-iscsi chrony -y --install-recommends
DEBIAN_FRONTEND=noninteractive apt remove os-prober -y
DEBIAN_FRONTEND=noninteractive apt install net-tools -y --install-recommends
update-grub

INTERFACE=$(route | grep ^default | grep -o [^ ]*$)
cat > /etc/network/interfaces.new << NETEOF
auto lo
iface lo inet loopback

auto $INTERFACE
iface $INTERFACE inet manual

auto vmbr0
iface vmbr0 inet static
    bridge_ports $INTERFACE
    bridge_stp off
    bridge_fd 0
NETEOF

mv /etc/network/interfaces.new /etc/network/interfaces
systemctl reboot -i',
  "defaultPackages" = 'openssh-server wget curl vim htop'
WHERE "name" LIKE '%Proxmox%';
