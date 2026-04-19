#!/bin/bash
# =============================================================================
# PiNetOS First-Boot Provisioning Script
# =============================================================================
# Runs once on first boot to configure the system for PiNet operation.
# Invoked by pinet-first-boot.service (systemd one-shot).
#
# Tasks:
#   1. Expand root filesystem to fill the SD card / NVMe
#   2. Generate SSH host keys
#   3. Create the 'pi' user (if not already present)
#   4. Set hostname to 'pinet'
#   5. Install and enable PiNetOS systemd services
#   6. Write version metadata
#   7. Remove the first-boot marker so this does not run again
# =============================================================================
set -euo pipefail

MARKER="/var/lib/pinetos/.first-boot-done"
VERSION_FILE="/etc/pinetos/version"
PINET_OVERLAY="/opt/pinet"
LOG_TAG="pinet-first-boot"

log()  { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*" | logger -t "${LOG_TAG}" --stderr 2>&1; }
warn() { log "WARN: $*"; }
die()  { log "FATAL: $*"; exit 1; }

# ---- Guard: skip if already provisioned ------------------------------------
if [ -f "${MARKER}" ]; then
    log "First-boot already completed — skipping."
    exit 0
fi

log "=== PiNetOS First-Boot Provisioning ==="

# ---- 1. Expand root filesystem ---------------------------------------------
expand_rootfs() {
    log "[1/7] Expanding root filesystem..."
    local ROOT_DEV DISK_DEV PART_NUM

    ROOT_DEV="$(findmnt -n -o SOURCE /)"
    # Resolve symlinks (e.g. /dev/mapper/* → /dev/mmcblk0p2)
    ROOT_DEV="$(readlink -f "${ROOT_DEV}")"

    # Determine disk device and partition number
    if [[ "${ROOT_DEV}" =~ ^(/dev/mmcblk[0-9]+)p([0-9]+)$ ]]; then
        DISK_DEV="${BASH_REMATCH[1]}"
        PART_NUM="${BASH_REMATCH[2]}"
    elif [[ "${ROOT_DEV}" =~ ^(/dev/nvme[0-9]+n[0-9]+)p([0-9]+)$ ]]; then
        DISK_DEV="${BASH_REMATCH[1]}"
        PART_NUM="${BASH_REMATCH[2]}"
    elif [[ "${ROOT_DEV}" =~ ^(/dev/sd[a-z]+)([0-9]+)$ ]]; then
        DISK_DEV="${BASH_REMATCH[1]}"
        PART_NUM="${BASH_REMATCH[2]}"
    else
        warn "Could not determine disk layout for ${ROOT_DEV} — skipping resize."
        return 0
    fi

    log "  Root device: ${ROOT_DEV} (disk=${DISK_DEV}, partition=${PART_NUM})"

    if command -v growpart >/dev/null 2>&1; then
        growpart "${DISK_DEV}" "${PART_NUM}" || warn "growpart returned non-zero (partition may already be full size)"
    elif command -v parted >/dev/null 2>&1; then
        parted -s "${DISK_DEV}" resizepart "${PART_NUM}" 100% || warn "parted resize returned non-zero"
    else
        warn "Neither growpart nor parted found — cannot expand partition."
        return 0
    fi

    resize2fs "${ROOT_DEV}" || warn "resize2fs returned non-zero"
    log "  Root filesystem expanded."
}

# ---- 2. Generate SSH host keys ---------------------------------------------
generate_ssh_keys() {
    log "[2/7] Generating SSH host keys..."
    if [ -d /etc/ssh ]; then
        # Remove any pre-existing keys from the image
        rm -f /etc/ssh/ssh_host_*
        ssh-keygen -A
        log "  SSH host keys generated."
    else
        warn "OpenSSH not installed — skipping key generation."
    fi
}

# ---- 3. Create 'pi' user ---------------------------------------------------
create_user() {
    log "[3/7] Creating 'pi' user..."
    if id "pi" &>/dev/null; then
        log "  User 'pi' already exists — skipping."
    else
        useradd -m -s /bin/bash -G sudo,video,audio,plugdev,netdev pi
        echo "pi:pinet" | chpasswd
        # Force password change on first interactive login
        chage -d 0 pi 2>/dev/null || true
        mkdir -p /etc/sudoers.d
        echo "pi ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/010_pi-nopasswd
        chmod 0440 /etc/sudoers.d/010_pi-nopasswd
        log "  User 'pi' created (default password: pinet — change immediately!)."
    fi

    # Ensure home directories
    local PINET_HOME="/home/pi/.pinet"
    mkdir -p "${PINET_HOME}/minima-data" "${PINET_HOME}/bin"
    chown -R pi:pi "${PINET_HOME}"
}

# ---- 4. Set hostname -------------------------------------------------------
set_hostname() {
    log "[4/7] Setting hostname to 'pinet'..."
    echo "pinet" > /etc/hostname
    if ! grep -q "pinet" /etc/hosts 2>/dev/null; then
        echo "127.0.1.1  pinet" >> /etc/hosts
    fi
    hostnamectl set-hostname pinet 2>/dev/null || true
}

# ---- 5. Install and enable PiNetOS services --------------------------------
install_services() {
    log "[5/7] Installing PiNetOS systemd services..."
    local SVC_SRC="${PINET_OVERLAY}/services"
    local SVC_DST="/etc/systemd/system"

    if [ -d "${SVC_SRC}" ]; then
        for unit in "${SVC_SRC}"/*.service "${SVC_SRC}"/*.timer; do
            [ -f "${unit}" ] || continue
            cp "${unit}" "${SVC_DST}/"
            log "  Installed $(basename "${unit}")"
        done
        systemctl daemon-reload

        # Enable core PiNetOS services (don't start yet — let boot sequence handle it)
        local ENABLE_UNITS=(
            minima.service
            pinet-desktop.service
            pinet-cluster-manager.service
            pinet-k3s-health.service
            pinet-hal.service
            pinet-ota.timer
        )
        for unit in "${ENABLE_UNITS[@]}"; do
            if [ -f "${SVC_DST}/${unit}" ]; then
                systemctl enable "${unit}" 2>/dev/null || warn "Could not enable ${unit}"
            fi
        done
        log "  Services installed and enabled."
    else
        warn "Service directory ${SVC_SRC} not found — skipping."
    fi
}

# ---- 6. Write version metadata ---------------------------------------------
write_version() {
    log "[6/7] Writing version metadata..."
    mkdir -p /etc/pinetos /var/lib/pinetos

    if [ -f "${PINET_OVERLAY}/version" ]; then
        cp "${PINET_OVERLAY}/version" "${VERSION_FILE}"
    else
        echo "3.0.0" > "${VERSION_FILE}"
    fi

    # Write OTA config if not present
    if [ ! -f /etc/pinetos/ota.conf ] && [ -f "${PINET_OVERLAY}/config/ota.conf" ]; then
        cp "${PINET_OVERLAY}/config/ota.conf" /etc/pinetos/ota.conf
    fi

    log "  Version: $(cat "${VERSION_FILE}")"
}

# ---- 7. Mark first-boot as done -------------------------------------------
mark_done() {
    log "[7/7] Marking first-boot provisioning as complete."
    mkdir -p "$(dirname "${MARKER}")"
    date -Iseconds > "${MARKER}"
}

# ---- Execute all steps ------------------------------------------------------
expand_rootfs
generate_ssh_keys
create_user
set_hostname
install_services
write_version
mark_done

log "=== PiNetOS First-Boot Provisioning Complete ==="
log "Reboot recommended. Access web interface at http://<pi-ip>:3000"
