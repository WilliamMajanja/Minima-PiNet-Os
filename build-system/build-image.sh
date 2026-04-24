#!/bin/bash
# =============================================================================
# PiNetOS Full Production Image Builder
# =============================================================================
# Builds a complete 4 GB flashable Raspberry Pi image with a Debian root
# filesystem. Requires root privileges and loop device support.
#
# For CI-friendly (rootless) image generation, use:
#   scripts/create-release-img.sh
#
# Prerequisites:
#   sudo apt-get install debootstrap qemu-user-static parted dosfstools e2fsprogs
#
# Usage:
#   sudo ./build-image.sh [version]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VERSION="${1:-$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('${PROJECT_ROOT}/package.json','utf8')).version)")}"
IMAGE_NAME="PiNetOS-RaspberryPi.img"
IMAGE_PATH="${SCRIPT_DIR}/${IMAGE_NAME}"
IMAGE_SIZE="4G"
ROOTFS_DIR="${SCRIPT_DIR}/rootfs"

echo "=== PiNetOS Full Production Image Builder ==="
echo "Version: ${VERSION}"
echo "Output:  ${IMAGE_PATH}"
echo ""

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (sudo)." >&2
    echo "For rootless CI builds, use: scripts/create-release-img.sh" >&2
    exit 1
fi

# ---- 1. Build root filesystem (if not already present) ----------------------
if [ ! -d "${ROOTFS_DIR}/bin" ]; then
    echo "[1/5] Building root filesystem via debootstrap..."
    bash "${SCRIPT_DIR}/build-rootfs.sh"
else
    echo "[1/5] Root filesystem already present — skipping debootstrap."
fi

# ---- 2. Copy PiNetOS overlay into rootfs ------------------------------------
echo "[2/5] Installing PiNetOS overlay into rootfs..."

# Copy service files
mkdir -p "${ROOTFS_DIR}/etc/systemd/system"
cp "${PROJECT_ROOT}/PiNetOS/services/"*.service "${ROOTFS_DIR}/etc/systemd/system/" 2>/dev/null || true
cp "${PROJECT_ROOT}/system/services/"*.service "${ROOTFS_DIR}/etc/systemd/system/" 2>/dev/null || true
cp "${PROJECT_ROOT}/system/services/"*.timer "${ROOTFS_DIR}/etc/systemd/system/" 2>/dev/null || true

# Copy PiNetOS scripts and manifests
mkdir -p "${ROOTFS_DIR}/opt/pinet/scripts"
mkdir -p "${ROOTFS_DIR}/opt/pinet/k3s"
mkdir -p "${ROOTFS_DIR}/opt/pinet/desktop"
mkdir -p "${ROOTFS_DIR}/opt/pinet/config"
cp "${PROJECT_ROOT}/PiNetOS/scripts/"*.sh "${ROOTFS_DIR}/opt/pinet/scripts/" 2>/dev/null || true
chmod +x "${ROOTFS_DIR}/opt/pinet/scripts/"*.sh 2>/dev/null || true
cp "${PROJECT_ROOT}/k3s/"*.yaml "${ROOTFS_DIR}/opt/pinet/k3s/" 2>/dev/null || true

# Copy configuration files
mkdir -p "${ROOTFS_DIR}/etc/pinetos"
echo "${VERSION}" > "${ROOTFS_DIR}/etc/pinetos/version"
cp "${PROJECT_ROOT}/system/ota/ota.conf" "${ROOTFS_DIR}/etc/pinetos/" 2>/dev/null || true
mkdir -p "${ROOTFS_DIR}/etc/NetworkManager"
cp "${PROJECT_ROOT}/system/networking/NetworkManager.conf" "${ROOTFS_DIR}/etc/NetworkManager/" 2>/dev/null || true

# Copy CLI and OTA update script
mkdir -p "${ROOTFS_DIR}/usr/local/bin"
mkdir -p "${ROOTFS_DIR}/usr/local/lib"
cp "${PROJECT_ROOT}/bin/pinet" "${ROOTFS_DIR}/usr/local/bin/pinet" 2>/dev/null || true
chmod +x "${ROOTFS_DIR}/usr/local/bin/pinet" 2>/dev/null || true
cp "${PROJECT_ROOT}/bin/pinet-setup" "${ROOTFS_DIR}/usr/local/bin/pinet-setup" 2>/dev/null || true
chmod +x "${ROOTFS_DIR}/usr/local/bin/pinet-setup" 2>/dev/null || true
cp "${PROJECT_ROOT}/lib/"*.sh "${ROOTFS_DIR}/usr/local/lib/" 2>/dev/null || true
cp "${PROJECT_ROOT}/system/ota/pinet-ota-update.sh" "${ROOTFS_DIR}/usr/local/bin/pinet-ota-update" 2>/dev/null || true
chmod +x "${ROOTFS_DIR}/usr/local/bin/pinet-ota-update" 2>/dev/null || true

# Copy web desktop runtime (Python backend + Jinja frontend)
for f in run.py requirements.txt .env.example package.json pinet-config.json; do
    [ -f "${PROJECT_ROOT}/${f}" ] && cp "${PROJECT_ROOT}/${f}" "${ROOTFS_DIR}/opt/pinet/desktop/"
done
for d in backend frontend lib scripts; do
    [ -d "${PROJECT_ROOT}/${d}" ] && cp -r "${PROJECT_ROOT}/${d}" "${ROOTFS_DIR}/opt/pinet/desktop/${d}"
done

echo "  -> PiNetOS overlay installed."

# ---- 3. Create the disk image with partitions -------------------------------
echo "[3/5] Creating ${IMAGE_SIZE} disk image..."
fallocate -l "${IMAGE_SIZE}" "${IMAGE_PATH}"

parted -s "${IMAGE_PATH}" mklabel msdos
parted -s "${IMAGE_PATH}" mkpart primary fat32 1MiB 256MiB
parted -s "${IMAGE_PATH}" mkpart primary ext4 256MiB 100%

# ---- 4. Format and populate partitions via loop devices ---------------------
echo "[4/5] Formatting and populating partitions..."
LOOP_DEV=$(losetup -fP --show "${IMAGE_PATH}")
BOOT_DEV="${LOOP_DEV}p1"
ROOT_DEV="${LOOP_DEV}p2"

mkfs.vfat -F 32 -n BOOT "${BOOT_DEV}"
mkfs.ext4 -L rootfs "${ROOT_DEV}"

MOUNT_DIR="$(mktemp -d /tmp/pinet-mnt-XXXXXX)"
mount "${ROOT_DEV}" "${MOUNT_DIR}"
mkdir -p "${MOUNT_DIR}/boot"
mount "${BOOT_DEV}" "${MOUNT_DIR}/boot"

# Copy rootfs
echo "  -> Copying root filesystem..."
cp -a "${ROOTFS_DIR}/"* "${MOUNT_DIR}/"

# Copy boot files
cp "${PROJECT_ROOT}/boot/config.txt" "${MOUNT_DIR}/boot/" 2>/dev/null || true
cp "${PROJECT_ROOT}/boot/cmdline.txt" "${MOUNT_DIR}/boot/" 2>/dev/null || true
cp "${PROJECT_ROOT}/boot/uboot/uboot.env" "${MOUNT_DIR}/boot/" 2>/dev/null || true

# Write fstab
ROOT_PARTUUID=$(blkid -s PARTUUID -o value "${ROOT_DEV}")
BOOT_PARTUUID=$(blkid -s PARTUUID -o value "${BOOT_DEV}")
cat > "${MOUNT_DIR}/etc/fstab" <<FSTAB
PARTUUID=${ROOT_PARTUUID}  /      ext4  defaults,noatime  0  1
PARTUUID=${BOOT_PARTUUID}  /boot  vfat  defaults          0  2
FSTAB

# Unmount
sync
umount "${MOUNT_DIR}/boot"
umount "${MOUNT_DIR}"
losetup -d "${LOOP_DEV}"
rmdir "${MOUNT_DIR}"

# ---- 5. Write PiNetOS signature --------------------------------------------
echo "[5/5] Writing PiNetOS image signature..."
SIGNATURE="PiNetOS v${VERSION} (arm64) -- https://github.com/WilliamMajanja/Minima-PiNet-Os"
printf "%-128s" "${SIGNATURE}" | dd of="${IMAGE_PATH}" bs=1 seek=304 conv=notrunc 2>/dev/null

echo ""
echo "=== Full Production Image Complete ==="
ls -lh "${IMAGE_PATH}"
echo ""
echo "SHA-256: $(sha256sum "${IMAGE_PATH}" | cut -d' ' -f1)"
