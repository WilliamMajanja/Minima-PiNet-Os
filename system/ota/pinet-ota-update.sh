#!/usr/bin/env bash
# =============================================================================
# PiNetOS OTA Update Script
# Installed at: /usr/local/bin/pinet-ota-update
# Invoked by:   pinet-ota.service / pinet-ota.timer
# =============================================================================
set -euo pipefail

OTA_CONF="${OTA_CONF:-/etc/pinetos/ota.conf}"
OTA_LOG="${OTA_LOG:-/var/log/pinetos/ota.log}"
OTA_CACHE="${OTA_CACHE:-/var/cache/pinetos/ota}"

# Load configuration
# shellcheck source=/dev/null
[[ -f "${OTA_CONF}" ]] && source "${OTA_CONF}"

UPDATE_SERVER="${UPDATE_SERVER:-https://updates.pinetos.io}"
RELEASE_CHANNEL="${RELEASE_CHANNEL:-stable}"
CURRENT_VERSION="${CURRENT_VERSION:-$(cat /etc/pinetos/version 2>/dev/null || echo '0.0.0')}"
VERIFY_SIGNATURE="${VERIFY_SIGNATURE:-true}"
AUTO_REBOOT="${AUTO_REBOOT:-false}"
BACKUP_BEFORE_UPDATE="${BACKUP_BEFORE_UPDATE:-true}"

# ---- Utilities --------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${OTA_LOG}"; }
info()  { log "${GREEN}[INFO]${NC}  $*"; }
warn()  { log "${YELLOW}[WARN]${NC}  $*"; }
error() { log "${RED}[ERROR]${NC} $*" >&2; exit 1; }

mkdir -p "$(dirname "${OTA_LOG}")" "${OTA_CACHE}"

# ---- Step 1: Check for available update ------------------------------------
info "PiNetOS OTA Update Check — current version: ${CURRENT_VERSION}"
info "Release channel: ${RELEASE_CHANNEL}"

MANIFEST_URL="${UPDATE_SERVER}/channels/${RELEASE_CHANNEL}/manifest.json"
MANIFEST_FILE="${OTA_CACHE}/manifest.json"

info "Fetching update manifest from ${MANIFEST_URL}..."
if ! curl --silent --fail --max-time 30 --output "${MANIFEST_FILE}" "${MANIFEST_URL}"; then
    warn "Could not reach update server. Network may be unavailable."
    exit 0
fi

LATEST_VERSION="$(jq -r '.version // empty' "${MANIFEST_FILE}" 2>/dev/null)"
[[ -z "${LATEST_VERSION}" ]] && error "Failed to parse version from manifest"
RELEASE_NOTES="$(jq -r '.notes // ""' "${MANIFEST_FILE}" 2>/dev/null)" || RELEASE_NOTES=""

info "Latest version available: ${LATEST_VERSION}"

# ---- Compare versions (semver) ---------------------------------------------
version_gt() {
    [ "$(printf '%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ] && [ "$1" != "$2" ]
}

if ! version_gt "${LATEST_VERSION}" "${CURRENT_VERSION}"; then
    info "System is up to date (${CURRENT_VERSION}). No action needed."
    exit 0
fi

info "New update available: ${CURRENT_VERSION} → ${LATEST_VERSION}"
info "Release notes: ${RELEASE_NOTES}"

# ---- Step 2: Download update payload ----------------------------------------
PAYLOAD_URL="$(jq -r '.payload_url // empty' "${MANIFEST_FILE}" 2>/dev/null)"
[[ -z "${PAYLOAD_URL}" ]] && error "Failed to parse payload_url from manifest"
PAYLOAD_HASH="$(jq -r '.sha256 // empty' "${MANIFEST_FILE}" 2>/dev/null)"
[[ -z "${PAYLOAD_HASH}" ]] && error "Failed to parse sha256 from manifest"
PAYLOAD_SIG="$(jq -r '.signature_url // ""' "${MANIFEST_FILE}" 2>/dev/null)" || PAYLOAD_SIG=""
PAYLOAD_FILE="${OTA_CACHE}/update-${LATEST_VERSION}.tar.gz"

info "Downloading update payload: ${PAYLOAD_URL}"
curl --progress-bar --fail --max-time 600 --output "${PAYLOAD_FILE}" "${PAYLOAD_URL}"

# ---- Step 3: Verify integrity -----------------------------------------------
info "Verifying SHA-256 checksum..."
COMPUTED_HASH="$(sha256sum "${PAYLOAD_FILE}" | awk '{print $1}')"
if [[ "${COMPUTED_HASH}" != "${PAYLOAD_HASH}" ]]; then
    error "Checksum mismatch! Expected ${PAYLOAD_HASH}, got ${COMPUTED_HASH}. Aborting."
fi
info "Checksum OK: ${COMPUTED_HASH}"

# Signature verification (if enabled and GPG public key available)
if [[ "${VERIFY_SIGNATURE}" == "true" ]] && [[ -n "${PAYLOAD_SIG}" ]]; then
    SIG_FILE="${OTA_CACHE}/update-${LATEST_VERSION}.tar.gz.sig"
    PINET_PUBKEY="/etc/pinetos/pinet-release.pub.gpg"
    if [[ -f "${PINET_PUBKEY}" ]]; then
        info "Verifying GPG signature..."
        curl --silent --fail --output "${SIG_FILE}" "${PAYLOAD_SIG}"
        gpg --verify "${SIG_FILE}" "${PAYLOAD_FILE}" || error "GPG signature verification failed!"
        info "GPG signature valid."
    else
        warn "GPG public key not found at ${PINET_PUBKEY}. Skipping signature check."
    fi
fi

# ---- Step 4: Backup current state -------------------------------------------
if [[ "${BACKUP_BEFORE_UPDATE}" == "true" ]]; then
    BACKUP_DIR="/var/backups/pinetos"
    mkdir -p "${BACKUP_DIR}"
    BACKUP_FILE="${BACKUP_DIR}/pre-update-${CURRENT_VERSION}-$(date +%Y%m%d%H%M%S).tar.gz"
    info "Creating backup: ${BACKUP_FILE}"
    tar czf "${BACKUP_FILE}" \
        /etc/pinetos \
        /opt/pinetos/config \
        /var/lib/pinetos \
        2>/dev/null || warn "Partial backup (some files may have been skipped)"
    info "Backup saved: ${BACKUP_FILE}"
fi

# ---- Step 5: Apply update ---------------------------------------------------
EXTRACT_DIR="${OTA_CACHE}/update-${LATEST_VERSION}"
mkdir -p "${EXTRACT_DIR}"
info "Extracting update payload..."
tar xzf "${PAYLOAD_FILE}" -C "${EXTRACT_DIR}"

# Run pre-install hook
PRE_INSTALL="${EXTRACT_DIR}/scripts/pre-install.sh"
if [[ -x "${PRE_INSTALL}" ]]; then
    info "Running pre-install hook..."
    bash "${PRE_INSTALL}" "${CURRENT_VERSION}" "${LATEST_VERSION}"
fi

# Copy application files
if [[ -d "${EXTRACT_DIR}/app" ]]; then
    info "Updating application files..."
    rsync -a --delete "${EXTRACT_DIR}/app/" /opt/pinetos/
fi

# Update systemd services
if [[ -d "${EXTRACT_DIR}/services" ]]; then
    info "Updating systemd service files..."
    cp "${EXTRACT_DIR}/services/"*.service /etc/systemd/system/ 2>/dev/null || true
    cp "${EXTRACT_DIR}/services/"*.timer   /etc/systemd/system/ 2>/dev/null || true
    systemctl daemon-reload
fi

# Update scripts
if [[ -d "${EXTRACT_DIR}/scripts/bin" ]]; then
    info "Updating system scripts..."
    cp "${EXTRACT_DIR}/scripts/bin/"* /usr/local/bin/ 2>/dev/null || true
    chmod +x /usr/local/bin/pinet-* 2>/dev/null || true
fi

# Run post-install hook
POST_INSTALL="${EXTRACT_DIR}/scripts/post-install.sh"
if [[ -x "${POST_INSTALL}" ]]; then
    info "Running post-install hook..."
    bash "${POST_INSTALL}" "${CURRENT_VERSION}" "${LATEST_VERSION}"
fi

# ---- Step 6: Update version record ------------------------------------------
echo "${LATEST_VERSION}" > /etc/pinetos/version
info "Version updated to ${LATEST_VERSION}"

# ---- Step 7: Restart affected services --------------------------------------
info "Restarting PiNetOS services..."
systemctl restart pinet-hal.service     || warn "Failed to restart pinet-hal"
systemctl restart pinet-desktop.service || warn "Failed to restart pinet-desktop"
systemctl restart minima.service        || warn "Failed to restart minima"

# ---- Step 8: Cleanup --------------------------------------------------------
rm -rf "${EXTRACT_DIR}" "${PAYLOAD_FILE}" 2>/dev/null || true
info "Cleanup complete."

# ---- Step 9: Optional reboot ------------------------------------------------
if [[ "${AUTO_REBOOT}" == "true" ]]; then
    info "Auto-reboot enabled. Rebooting in 1 minute..."
    shutdown -r +1 "PiNetOS update to ${LATEST_VERSION} complete — rebooting" &
fi

info "OTA update to ${LATEST_VERSION} completed successfully!"
exit 0
