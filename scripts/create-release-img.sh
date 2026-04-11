#!/bin/bash
# =============================================================================
# PiNetOS Release Image Generator
# =============================================================================
# Creates a fully structured Raspberry Pi disk image for release packaging.
# Designed to run in CI (ubuntu-latest) without root privileges.
#
# The image contains:
#   Partition 1 (FAT32, 64 MB) — Boot:   config.txt, cmdline.txt, uboot.env
#   Partition 2 (ext4, ~192 MB) — Rootfs: PiNetOS overlay (services, scripts,
#                                          K3s manifests, web desktop, CLI, configs,
#                                          first-boot provisioning)
#
# Dependencies:
#   - mtools   (mformat, mcopy)  — FAT32 boot partition (no root)
#   - e2fsprogs (mke2fs)         — ext4 rootfs partition (no root via -d flag)
#   - sfdisk                     — MBR partition table
#   - Node.js                    — version detection
#
# Usage:
#   bash scripts/create-release-img.sh [version]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VERSION="${1:-$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('${PROJECT_ROOT}/package.json','utf8')).version)")}"
IMAGE_NAME="PiNetOS-RaspberryPi.img"
IMAGE_PATH="${PROJECT_ROOT}/${IMAGE_NAME}"

# ---- Partition geometry (sectors of 512 bytes) ------------------------------
SECTOR=512
BOOT_START=2048                           # sector 2048   (1 MiB alignment)
BOOT_SECTORS=131072                       # 64 MiB  = 131072 sectors
ROOT_START=$(( BOOT_START + BOOT_SECTORS ))  # sector 133120
ROOT_SECTORS=393216                       # 192 MiB = 393216 sectors
TOTAL_SECTORS=$(( ROOT_START + ROOT_SECTORS ))
IMAGE_SIZE_MB=$(( TOTAL_SECTORS * SECTOR / 1024 / 1024 ))

BOOT_OFFSET=$(( BOOT_START * SECTOR ))
ROOT_OFFSET=$(( ROOT_START * SECTOR ))
ROOT_SIZE_BYTES=$(( ROOT_SECTORS * SECTOR ))

# Temporary files for partition images
ROOTFS_IMG="$(mktemp /tmp/pinet-rootfs-XXXXXX.img)"
OVERLAY_DIR="${PROJECT_ROOT}/rootfs-overlay"

cleanup() {
    rm -f "${ROOTFS_IMG}" 2>/dev/null || true
    rm -rf "${OVERLAY_DIR}" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== PiNetOS Release Image Generator ==="
echo "Version:     ${VERSION}"
echo "Output:      ${IMAGE_PATH}"
echo "Image size:  ${IMAGE_SIZE_MB} MB"
echo "Boot:        $(( BOOT_SECTORS * SECTOR / 1024 / 1024 )) MB (FAT32)"
echo "Rootfs:      $(( ROOT_SECTORS * SECTOR / 1024 / 1024 )) MB (ext4)"
echo ""

# =============================================================================
# Step 1 — Build the rootfs overlay
# =============================================================================
echo "[1/6] Building rootfs overlay..."
bash "${SCRIPT_DIR}/build-rootfs-overlay.sh" "${VERSION}" "${OVERLAY_DIR}"

# =============================================================================
# Step 2 — Create the raw disk image
# =============================================================================
echo "[2/6] Creating ${IMAGE_SIZE_MB} MB raw disk image..."
dd if=/dev/zero of="${IMAGE_PATH}" bs=1M count=${IMAGE_SIZE_MB} status=progress 2>&1

# =============================================================================
# Step 3 — Write MBR partition table
# =============================================================================
echo "[3/6] Writing MBR partition table..."
/usr/sbin/sfdisk "${IMAGE_PATH}" <<EOF
label: dos
unit: sectors

${IMAGE_NAME}1 : start=${BOOT_START},  size=${BOOT_SECTORS},  type=c
${IMAGE_NAME}2 : start=${ROOT_START},  size=${ROOT_SECTORS},  type=83
EOF

# =============================================================================
# Step 4 — Populate boot partition (FAT32 via mtools)
# =============================================================================
echo "[4/6] Populating boot partition (FAT32)..."

if command -v mformat &>/dev/null && command -v mcopy &>/dev/null; then
    echo "  -> Using mtools for FAT32 filesystem"

    # Format the boot partition region in-place
    mformat -i "${IMAGE_PATH}@@${BOOT_OFFSET}" -F -v BOOT ::

    # Copy boot configuration files
    if [ -f "${PROJECT_ROOT}/boot/config.txt" ]; then
        mcopy -i "${IMAGE_PATH}@@${BOOT_OFFSET}" "${PROJECT_ROOT}/boot/config.txt" ::/config.txt
        echo "  -> config.txt"
    fi
    if [ -f "${PROJECT_ROOT}/boot/cmdline.txt" ]; then
        mcopy -i "${IMAGE_PATH}@@${BOOT_OFFSET}" "${PROJECT_ROOT}/boot/cmdline.txt" ::/cmdline.txt
        echo "  -> cmdline.txt"
    fi
    if [ -f "${PROJECT_ROOT}/boot/uboot/uboot.env" ]; then
        mcopy -i "${IMAGE_PATH}@@${BOOT_OFFSET}" "${PROJECT_ROOT}/boot/uboot/uboot.env" ::/uboot.env
        echo "  -> uboot.env"
    fi
else
    echo "  -> WARNING: mtools not found — embedding boot config as raw data"
    echo "  -> Install mtools (apt-get install mtools) for proper FAT32 support"

    BOOT_DATA_OFFSET=$((BOOT_OFFSET + 512))
    if [ -f "${PROJECT_ROOT}/boot/config.txt" ]; then
        dd if="${PROJECT_ROOT}/boot/config.txt" of="${IMAGE_PATH}" bs=1 seek=${BOOT_DATA_OFFSET} conv=notrunc 2>/dev/null
        echo "  -> Embedded boot/config.txt"
    fi

    CMDLINE_OFFSET=$((BOOT_DATA_OFFSET + 8192))
    if [ -f "${PROJECT_ROOT}/boot/cmdline.txt" ]; then
        dd if="${PROJECT_ROOT}/boot/cmdline.txt" of="${IMAGE_PATH}" bs=1 seek=${CMDLINE_OFFSET} conv=notrunc 2>/dev/null
        echo "  -> Embedded boot/cmdline.txt"
    fi
fi

# =============================================================================
# Step 5 — Populate rootfs partition (ext4 via mke2fs -d)
# =============================================================================
echo "[5/6] Populating rootfs partition (ext4)..."

ROOT_SIZE_BLOCKS=$(( ROOT_SIZE_BYTES / 4096 ))

if command -v mke2fs &>/dev/null; then
    echo "  -> Using mke2fs -d to create ext4 from overlay directory"

    # Create a standalone ext4 filesystem image from the overlay directory
    mke2fs -t ext4 \
        -d "${OVERLAY_DIR}" \
        -b 4096 \
        -L rootfs \
        -m 1 \
        -O ^metadata_csum \
        -E root_owner=0:0 \
        "${ROOTFS_IMG}" \
        "${ROOT_SIZE_BLOCKS}" 2>&1

    # Write the ext4 partition image into the disk image at the correct offset
    dd if="${ROOTFS_IMG}" of="${IMAGE_PATH}" bs=4096 seek=$(( ROOT_OFFSET / 4096 )) conv=notrunc status=progress 2>&1
    echo "  -> Rootfs partition written ($(du -sh "${OVERLAY_DIR}" | cut -f1) overlay content)"
else
    echo "  -> WARNING: mke2fs not found — rootfs partition will be empty"
    echo "  -> Install e2fsprogs (apt-get install e2fsprogs) for ext4 support"
fi

# =============================================================================
# Step 6 — Write PiNetOS image signature
# =============================================================================
echo "[6/6] Writing PiNetOS image signature..."

# Write a signature block at byte offset 304 (inside MBR, after bootstrap code,
# before the standard partition table at offset 446)
SIGNATURE="PiNetOS v${VERSION} (arm64) -- https://github.com/WilliamMajanja/Minima-PiNet-Os"
printf "%-128s" "${SIGNATURE}" | dd of="${IMAGE_PATH}" bs=1 seek=304 conv=notrunc 2>/dev/null

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=== Image Generation Complete ==="
ls -lh "${IMAGE_PATH}"
echo ""
echo "Partition layout:"
/usr/sbin/sfdisk -l "${IMAGE_PATH}" 2>/dev/null || true
echo ""
echo "SHA-256: $(sha256sum "${IMAGE_PATH}" | cut -d' ' -f1)"
echo ""
echo "Flash this image to a MicroSD card (16 GB+) with Raspberry Pi Imager or dd."
echo "On first boot, PiNetOS will expand the rootfs and provision the system."
