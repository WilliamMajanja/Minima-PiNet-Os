#!/usr/bin/env bash
# =============================================================================
# PiNetOS Image Flashing Utility
# Supports: Linux, macOS
# Windows users: use Win32DiskImager or Raspberry Pi Imager
#
# Usage: ./tools/flash.sh <image.img[.gz]> [target-device]
# Examples:
#   ./tools/flash.sh PiNetOS-RaspberryPi5.img            # auto-detect SD card
#   ./tools/flash.sh PiNetOS-RaspberryPi5.img /dev/sdb   # explicit device
#   ./tools/flash.sh PiNetOS-RaspberryPi5.img.gz         # auto-decompress
# =============================================================================
set -euo pipefail

# ---- Colour helpers ---------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
section() { echo -e "\n${BLUE}${BOLD}=== $* ===${NC}\n"; }

# ---- OS detection -----------------------------------------------------------
OS="$(uname -s)"

# ---- Usage ------------------------------------------------------------------
usage() {
    cat << EOF
${BOLD}PiNetOS Image Flasher${NC}

Usage: $0 <image.img[.gz]> [target-device]

Arguments:
  image.img       Path to the PiNetOS image file (.img or .img.gz)
  target-device   Target block device (e.g. /dev/sdb, /dev/mmcblk0)
                  If omitted, the script will attempt to auto-detect
                  removable storage devices.

Options:
  --verify        Verify the written image after flashing (slow but safe)
  --help          Show this help message

Examples (Linux):
  $0 PiNetOS-RaspberryPi5.img /dev/sdb
  $0 PiNetOS-RaspberryPi5.img.gz         # auto-detect

Examples (macOS):
  $0 PiNetOS-RaspberryPi5.img /dev/disk2
  $0 PiNetOS-RaspberryPi5.img.gz

EOF
    exit 0
}

# ---- Argument parsing -------------------------------------------------------
IMAGE_FILE=""
TARGET_DEV=""
VERIFY=false

for arg in "$@"; do
    case "${arg}" in
        --verify) VERIFY=true ;;
        --help|-h) usage ;;
        *)
            if [[ -z "${IMAGE_FILE}" ]]; then IMAGE_FILE="${arg}"
            elif [[ -z "${TARGET_DEV}" ]]; then TARGET_DEV="${arg}"
            fi
            ;;
    esac
done

[[ -z "${IMAGE_FILE}" ]] && usage
[[ -f "${IMAGE_FILE}" ]] || error "Image file not found: ${IMAGE_FILE}"

# ---- Decompress if needed ---------------------------------------------------
TEMP_IMAGE=""
if [[ "${IMAGE_FILE}" == *.gz ]]; then
    info "Compressed image detected. Decompressing..."
    TEMP_IMAGE="$(mktemp /tmp/pinetos-XXXXXXXX.img)"
    trap "rm -f '${TEMP_IMAGE}'" EXIT
    gunzip -c "${IMAGE_FILE}" > "${TEMP_IMAGE}"
    IMAGE_FILE="${TEMP_IMAGE}"
    info "Decompressed to: ${IMAGE_FILE}"
fi

IMAGE_SIZE_BYTES="$(stat -c%s "${IMAGE_FILE}" 2>/dev/null || stat -f%z "${IMAGE_FILE}")"
IMAGE_SIZE_HUMAN="$(numfmt --to=iec-i --suffix=B "${IMAGE_SIZE_BYTES}" 2>/dev/null || echo "${IMAGE_SIZE_BYTES} bytes")"
info "Image size: ${IMAGE_SIZE_HUMAN}"

# ---- Auto-detect removable device -------------------------------------------
detect_removable_linux() {
    local devices=()
    while IFS= read -r dev; do
        local rm; rm="$(cat "/sys/block/${dev}/removable" 2>/dev/null || echo 0)"
        local size; size="$(cat "/sys/block/${dev}/size" 2>/dev/null || echo 0)"
        # Only include removable devices with non-trivial size (> 1 GB)
        if [[ "${rm}" == "1" ]] && [[ $((size * 512)) -gt $((1024 * 1024 * 1024)) ]]; then
            devices+=("/dev/${dev}")
        fi
    done < <(ls /sys/block/ | grep -E '^(sd[a-z]|mmcblk[0-9])$')
    echo "${devices[@]:-}"
}

detect_removable_mac() {
    diskutil list | grep -E '/dev/disk[0-9]+' | awk '{print $1}' | \
        while read -r disk; do
            if diskutil info "${disk}" 2>/dev/null | grep -q "Removable Media: *Yes"; then
                echo "${disk}"
            fi
        done
}

if [[ -z "${TARGET_DEV}" ]]; then
    info "No target device specified. Scanning for removable storage..."
    if [[ "${OS}" == "Linux" ]]; then
        FOUND_DEVS="$(detect_removable_linux)"
    elif [[ "${OS}" == "Darwin" ]]; then
        FOUND_DEVS="$(detect_removable_mac)"
    else
        error "Auto-detection not supported on ${OS}. Please specify the target device."
    fi

    if [[ -z "${FOUND_DEVS}" ]]; then
        error "No removable device found. Please insert an SD card or USB drive and retry, or specify the target device explicitly."
    fi

    # If multiple devices found, ask user to pick
    read -ra DEV_ARRAY <<< "${FOUND_DEVS}"
    if [[ ${#DEV_ARRAY[@]} -eq 1 ]]; then
        TARGET_DEV="${DEV_ARRAY[0]}"
        info "Auto-detected device: ${TARGET_DEV}"
    else
        echo "Multiple removable devices found:"
        for i in "${!DEV_ARRAY[@]}"; do
            echo "  [$((i+1))] ${DEV_ARRAY[$i]}"
        done
        read -rp "Select device [1-${#DEV_ARRAY[@]}]: " sel
        TARGET_DEV="${DEV_ARRAY[$((sel-1))]}"
    fi
fi

# ---- Safety checks ----------------------------------------------------------
[[ -b "${TARGET_DEV}" ]] || error "${TARGET_DEV} is not a valid block device."

# Refuse to flash to a mounted root filesystem
if mount | grep -q "^${TARGET_DEV} on / "; then
    error "SAFETY: ${TARGET_DEV} appears to be the root filesystem! Aborting."
fi

# Check device is not the running system disk
SYSTEM_DISK="$(df / | tail -1 | awk '{print $1}' | sed 's/p[0-9]*$//' | sed 's/[0-9]*$//')"
if [[ "${TARGET_DEV}" == "${SYSTEM_DISK}" ]]; then
    error "SAFETY: ${TARGET_DEV} appears to be your system disk! Aborting."
fi

# ---- Confirm with user -------------------------------------------------------
section "About to Flash"
echo -e "  ${BOLD}Image:${NC}  ${IMAGE_FILE}"
echo -e "  ${BOLD}Target:${NC} ${TARGET_DEV}"
echo -e "  ${BOLD}Size:${NC}   ${IMAGE_SIZE_HUMAN}"
echo
echo -e "${RED}${BOLD}WARNING: ALL DATA ON ${TARGET_DEV} WILL BE PERMANENTLY ERASED!${NC}"
echo
read -rp "Type 'yes' to confirm and proceed: " confirm
[[ "${confirm}" == "yes" ]] || { info "Aborted."; exit 0; }

# ---- Unmount target partitions -----------------------------------------------
info "Unmounting all partitions on ${TARGET_DEV}..."
if [[ "${OS}" == "Linux" ]]; then
    umount "${TARGET_DEV}"?* 2>/dev/null || true
elif [[ "${OS}" == "Darwin" ]]; then
    diskutil unmountDisk "${TARGET_DEV}" || true
fi

# ---- Flash image ------------------------------------------------------------
section "Flashing Image"
info "Writing ${IMAGE_SIZE_HUMAN} to ${TARGET_DEV}..."
info "This may take several minutes. Please do not remove the device."

if [[ "${OS}" == "Darwin" ]]; then
    # macOS: use rdisk for faster raw access
    RAW_DEV="${TARGET_DEV/disk/rdisk}"
    sudo dd if="${IMAGE_FILE}" of="${RAW_DEV}" bs=4m status=progress conv=sync,noerror
else
    sudo dd if="${IMAGE_FILE}" of="${TARGET_DEV}" bs=4M status=progress conv=sync,noerror
fi

info "Flushing write buffers..."
sync

# ---- Verify (optional) ------------------------------------------------------
if [[ "${VERIFY}" == "true" ]]; then
    section "Verifying Written Image"
    info "Computing checksum of source image..."
    SRC_HASH="$(sha256sum "${IMAGE_FILE}" | awk '{print $1}')"

    info "Computing checksum of written data..."
    DST_HASH="$(sudo dd if="${TARGET_DEV}" bs=4M count=$(( IMAGE_SIZE_BYTES / (4 * 1024 * 1024) + 1 )) 2>/dev/null | sha256sum | awk '{print $1}')"

    if [[ "${SRC_HASH}" == "${DST_HASH}" ]]; then
        info "Verification PASSED. Image written correctly."
    else
        error "Verification FAILED! Source and destination checksums do not match."
    fi
fi

# ---- Done -------------------------------------------------------------------
section "Flash Complete!"
info "PiNetOS has been written to ${TARGET_DEV}"
info "Safely eject the device and insert it into your Raspberry Pi 5."
echo
echo "  Boot your Pi 5 and PiNetOS will start automatically."
echo "  Default login: username=pinet  password=pinet"
echo "  SSH:           ssh pinet@<pi-ip>"
echo "  Web dashboard: http://<pi-ip>:3000"
echo
