#!/bin/bash
# =============================================================================
# PiNetOS Rootfs Overlay Builder
# =============================================================================
# Assembles a directory tree that represents the PiNetOS rootfs overlay.
# The resulting directory is used by create-release-img.sh to populate the
# ext4 root partition via mke2fs -d (no root required).
#
# Usage:
#   bash scripts/build-rootfs-overlay.sh [version] [output_dir]
#
# Output directory structure:
#   <output_dir>/
#   ├── etc/
#   │   ├── hostname
#   │   ├── pinetos/
#   │   │   ├── version
#   │   │   └── ota.conf
#   │   └── NetworkManager/
#   │       └── NetworkManager.conf
#   ├── opt/
#   │   └── pinet/
#   │       ├── version
#   │       ├── scripts/       (PiNetOS runtime & bootstrap scripts)
#   │       ├── services/      (systemd unit files)
#   │       ├── k3s/           (Kubernetes manifests)
#   │       ├── desktop/       (web desktop — Vite build output + server)
#   │       └── config/        (default configuration files)
#   └── usr/
#       └── local/
#           └── bin/
#               ├── pinet      (CLI)
#               └── pinet-ota-update
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VERSION="${1:-$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('${PROJECT_ROOT}/package.json','utf8')).version)")}"
OVERLAY_DIR="${2:-${PROJECT_ROOT}/rootfs-overlay}"

echo "=== PiNetOS Rootfs Overlay Builder ==="
echo "Version:    ${VERSION}"
echo "Output dir: ${OVERLAY_DIR}"
echo ""

# ---- Clean previous build ---------------------------------------------------
if [ -d "${OVERLAY_DIR}" ]; then
    echo "Cleaning previous overlay directory..."
    rm -rf "${OVERLAY_DIR}"
fi

# ---- Create directory skeleton ----------------------------------------------
echo "[1/8] Creating directory skeleton..."
mkdir -p "${OVERLAY_DIR}/etc/pinetos"
mkdir -p "${OVERLAY_DIR}/etc/NetworkManager"
mkdir -p "${OVERLAY_DIR}/opt/pinet/scripts"
mkdir -p "${OVERLAY_DIR}/opt/pinet/services"
mkdir -p "${OVERLAY_DIR}/opt/pinet/k3s"
mkdir -p "${OVERLAY_DIR}/opt/pinet/desktop"
mkdir -p "${OVERLAY_DIR}/opt/pinet/config"
mkdir -p "${OVERLAY_DIR}/usr/local/bin"
mkdir -p "${OVERLAY_DIR}/var/lib/pinetos"

# ---- Write version metadata -------------------------------------------------
echo "[2/8] Writing version metadata..."
echo "${VERSION}" > "${OVERLAY_DIR}/opt/pinet/version"
echo "${VERSION}" > "${OVERLAY_DIR}/etc/pinetos/version"
echo "pinet" > "${OVERLAY_DIR}/etc/hostname"

# ---- Copy PiNetOS scripts ---------------------------------------------------
echo "[3/8] Copying PiNetOS scripts..."
for script in "${PROJECT_ROOT}/PiNetOS/scripts/"*.sh; do
    [ -f "${script}" ] || continue
    cp "${script}" "${OVERLAY_DIR}/opt/pinet/scripts/"
    chmod +x "${OVERLAY_DIR}/opt/pinet/scripts/$(basename "${script}")"
    echo "  -> $(basename "${script}")"
done

# ---- Copy systemd service files ---------------------------------------------
echo "[4/8] Copying systemd service files..."
for unit in "${PROJECT_ROOT}/PiNetOS/services/"*.service "${PROJECT_ROOT}/PiNetOS/services/"*.timer; do
    [ -f "${unit}" ] || continue
    cp "${unit}" "${OVERLAY_DIR}/opt/pinet/services/"
    echo "  -> $(basename "${unit}")"
done
# Also include system-level services
for unit in "${PROJECT_ROOT}/system/services/"*.service "${PROJECT_ROOT}/system/services/"*.timer; do
    [ -f "${unit}" ] || continue
    # Skip duplicates already in PiNetOS/services
    [ -f "${OVERLAY_DIR}/opt/pinet/services/$(basename "${unit}")" ] && continue
    cp "${unit}" "${OVERLAY_DIR}/opt/pinet/services/"
    echo "  -> $(basename "${unit}") (system)"
done

# ---- Copy K3s manifests -----------------------------------------------------
echo "[5/8] Copying K3s manifests..."
if [ -d "${PROJECT_ROOT}/k3s" ]; then
    cp "${PROJECT_ROOT}/k3s/"*.yaml "${OVERLAY_DIR}/opt/pinet/k3s/" 2>/dev/null || true
    echo "  -> $(ls "${OVERLAY_DIR}/opt/pinet/k3s/" 2>/dev/null | wc -l) manifest files"
else
    echo "  -> k3s/ directory not found — skipping"
fi

# ---- Copy configuration files -----------------------------------------------
echo "[6/8] Copying configuration files..."
# OTA config
if [ -f "${PROJECT_ROOT}/system/ota/ota.conf" ]; then
    cp "${PROJECT_ROOT}/system/ota/ota.conf" "${OVERLAY_DIR}/etc/pinetos/ota.conf"
    cp "${PROJECT_ROOT}/system/ota/ota.conf" "${OVERLAY_DIR}/opt/pinet/config/ota.conf"
    echo "  -> ota.conf"
fi
# NetworkManager config
if [ -f "${PROJECT_ROOT}/system/networking/NetworkManager.conf" ]; then
    cp "${PROJECT_ROOT}/system/networking/NetworkManager.conf" "${OVERLAY_DIR}/etc/NetworkManager/NetworkManager.conf"
    echo "  -> NetworkManager.conf"
fi
# WireGuard template
if [ -f "${PROJECT_ROOT}/system/networking/wireguard-mesh.conf.template" ]; then
    mkdir -p "${OVERLAY_DIR}/opt/pinet/config"
    cp "${PROJECT_ROOT}/system/networking/wireguard-mesh.conf.template" "${OVERLAY_DIR}/opt/pinet/config/"
    echo "  -> wireguard-mesh.conf.template"
fi
# OTA update script
if [ -f "${PROJECT_ROOT}/system/ota/pinet-ota-update.sh" ]; then
    cp "${PROJECT_ROOT}/system/ota/pinet-ota-update.sh" "${OVERLAY_DIR}/usr/local/bin/pinet-ota-update"
    chmod +x "${OVERLAY_DIR}/usr/local/bin/pinet-ota-update"
    echo "  -> pinet-ota-update"
fi

# ---- Copy web desktop build -------------------------------------------------
echo "[7/8] Copying web desktop..."
for f in run.py requirements.txt .env.example package.json pinet-config.json; do
    if [ -f "${PROJECT_ROOT}/${f}" ]; then
        cp "${PROJECT_ROOT}/${f}" "${OVERLAY_DIR}/opt/pinet/desktop/"
        echo "  -> ${f}"
    fi
done
for dir in backend frontend lib scripts; do
    if [ -d "${PROJECT_ROOT}/${dir}" ]; then
        cp -r "${PROJECT_ROOT}/${dir}" "${OVERLAY_DIR}/opt/pinet/desktop/${dir}"
        echo "  -> ${dir}/"
    fi
done

# ---- Copy CLI ---------------------------------------------------------------
echo "[8/8] Copying CLI and runtime..."
if [ -f "${PROJECT_ROOT}/bin/pinet" ]; then
    cp "${PROJECT_ROOT}/bin/pinet" "${OVERLAY_DIR}/usr/local/bin/pinet"
    chmod +x "${OVERLAY_DIR}/usr/local/bin/pinet"
    echo "  -> pinet CLI"
fi
if [ -f "${PROJECT_ROOT}/bin/pinet-setup" ]; then
    cp "${PROJECT_ROOT}/bin/pinet-setup" "${OVERLAY_DIR}/usr/local/bin/pinet-setup"
    chmod +x "${OVERLAY_DIR}/usr/local/bin/pinet-setup"
    echo "  -> pinet-setup"
fi
# Include pinet-pkg package manager
if [ -f "${PROJECT_ROOT}/system/package-manager/pinet-pkg.sh" ]; then
    cp "${PROJECT_ROOT}/system/package-manager/pinet-pkg.sh" "${OVERLAY_DIR}/usr/local/bin/pinet-pkg"
    chmod +x "${OVERLAY_DIR}/usr/local/bin/pinet-pkg"
    echo "  -> pinet-pkg"
fi
# Include lib/pinet-runtime.sh for CLI
if [ -d "${PROJECT_ROOT}/lib" ]; then
    mkdir -p "${OVERLAY_DIR}/usr/local/lib"
    for f in "${PROJECT_ROOT}/lib/"*.sh; do
        [ -f "${f}" ] || continue
        cp "${f}" "${OVERLAY_DIR}/usr/local/lib/"
        echo "  -> lib/$(basename "${f}")"
    done
fi

# ---- Summary ----------------------------------------------------------------
echo ""
echo "=== Rootfs Overlay Summary ==="
echo "Total files: $(find "${OVERLAY_DIR}" -type f | wc -l)"
echo "Total size:  $(du -sh "${OVERLAY_DIR}" | cut -f1)"
echo ""
echo "Directory tree (depth 3):"
find "${OVERLAY_DIR}" -maxdepth 3 -type d | sed "s|${OVERLAY_DIR}|.|" | sort
echo ""
echo "Overlay directory ready at: ${OVERLAY_DIR}"
