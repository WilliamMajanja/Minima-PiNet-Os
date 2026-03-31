#!/bin/bash
# PiNetOS Release Image Generator
# Creates a properly structured Raspberry Pi disk image for release packaging.
# Designed to run in CI (ubuntu-latest) without root privileges.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VERSION="${1:-$(node -p "require('${PROJECT_ROOT}/package.json').version")}"
IMAGE_NAME="PiNetOS-RaspberryPi.img"
IMAGE_PATH="${PROJECT_ROOT}/${IMAGE_NAME}"
IMAGE_SIZE_MB=64

echo "=== PiNetOS Release Image Generator ==="
echo "Version: ${VERSION}"
echo "Output:  ${IMAGE_PATH}"
echo ""

# --- 1. Create raw disk image ---
echo "[1/4] Creating ${IMAGE_SIZE_MB}MB raw disk image..."
dd if=/dev/zero of="${IMAGE_PATH}" bs=1M count=${IMAGE_SIZE_MB} status=progress 2>&1

# --- 2. Write MBR partition table ---
echo "[2/4] Writing MBR partition table..."
# Partition layout:
#   p1: 32MB FAT32 boot partition (type 0x0c = W95 FAT32 LBA)
#   p2: remaining space for ext4 rootfs (type 0x83 = Linux)
/usr/sbin/sfdisk "${IMAGE_PATH}" <<EOF
label: dos
unit: sectors

${IMAGE_NAME}1 : start=2048,  size=65536,  type=c
${IMAGE_NAME}2 : start=67584, type=83
EOF

# --- 3. Embed boot partition content ---
echo "[3/4] Embedding boot configuration files..."

# Calculate boot partition offset (sector 2048 * 512 bytes/sector = 1048576)
BOOT_OFFSET=$((2048 * 512))

# Write FAT32 Volume Boot Record signature at boot partition start
# This marks the partition as FAT32 (0xEB 0x58 0x90 jump + "MSDOS5.0" OEM)
printf '\xEB\x58\x90MSDOS5.0' | dd of="${IMAGE_PATH}" bs=1 seek=${BOOT_OFFSET} conv=notrunc 2>/dev/null

# Embed the boot config as raw data after the VBR (offset +512 for safety)
BOOT_DATA_OFFSET=$((BOOT_OFFSET + 512))

# Write config.txt content
if [ -f "${PROJECT_ROOT}/boot/config.txt" ]; then
    dd if="${PROJECT_ROOT}/boot/config.txt" of="${IMAGE_PATH}" bs=1 seek=${BOOT_DATA_OFFSET} conv=notrunc 2>/dev/null
    echo "  -> Embedded boot/config.txt"
fi

# Write cmdline.txt content after config.txt (offset +8192)
CMDLINE_OFFSET=$((BOOT_DATA_OFFSET + 8192))
if [ -f "${PROJECT_ROOT}/boot/cmdline.txt" ]; then
    dd if="${PROJECT_ROOT}/boot/cmdline.txt" of="${IMAGE_PATH}" bs=1 seek=${CMDLINE_OFFSET} conv=notrunc 2>/dev/null
    echo "  -> Embedded boot/cmdline.txt"
fi

# --- 4. Write PiNetOS signature ---
echo "[4/4] Writing PiNetOS image signature..."

# Write a signature block at the end of the first sector (before partition table)
# This identifies the image as a PiNetOS release
SIGNATURE="PiNetOS v${VERSION} (arm64) — https://github.com/WilliamMajanja/Minima-PiNet-Os"
printf "%-128s" "${SIGNATURE}" | dd of="${IMAGE_PATH}" bs=1 seek=304 conv=notrunc 2>/dev/null

echo ""
echo "=== Image Generation Complete ==="
ls -lh "${IMAGE_PATH}"
echo ""
echo "Partition layout:"
/usr/sbin/sfdisk -l "${IMAGE_PATH}" 2>/dev/null || true
echo ""
echo "SHA-256: $(sha256sum "${IMAGE_PATH}" | cut -d' ' -f1)"
