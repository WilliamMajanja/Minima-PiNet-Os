#!/usr/bin/env bash
# =============================================================================
# PiNetOS Kernel Build Script for Raspberry Pi 5 (BCM2712 / ARM64)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---- Configuration ----------------------------------------------------------
KERNEL_REPO="https://github.com/raspberrypi/linux.git"
KERNEL_BRANCH="rpi-6.6.y"
KERNEL_DIR="${REPO_ROOT}/kernel/linux"
CROSS_COMPILE="${CROSS_COMPILE:-aarch64-linux-gnu-}"
ARCH="arm64"
DEFCONFIG="bcm2712_defconfig"
CUSTOM_CONFIG="${SCRIPT_DIR}/rpi5-bcm2712.config"
JOBS="${JOBS:-$(nproc)}"
OUTPUT_DIR="${REPO_ROOT}/kernel/output"

# ---- Colours ----------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---- Dependency check -------------------------------------------------------
check_dependencies() {
    local missing=()
    for cmd in git make gcc aarch64-linux-gnu-gcc bc bison flex libssl-dev \
               libelf-dev cpio; do
        command -v "${cmd%%:*}" &>/dev/null || missing+=("$cmd")
    done
    [[ ${#missing[@]} -eq 0 ]] || error "Missing dependencies: ${missing[*]}"
}

# ---- Fetch kernel source ----------------------------------------------------
fetch_kernel() {
    if [[ -d "${KERNEL_DIR}/.git" ]]; then
        info "Kernel source found. Pulling latest ${KERNEL_BRANCH}..."
        git -C "${KERNEL_DIR}" fetch origin "${KERNEL_BRANCH}"
        git -C "${KERNEL_DIR}" checkout "origin/${KERNEL_BRANCH}"
    else
        info "Cloning RPi kernel (${KERNEL_BRANCH}) — this may take a while..."
        git clone --depth=1 -b "${KERNEL_BRANCH}" "${KERNEL_REPO}" "${KERNEL_DIR}"
    fi
}

# ---- Configure kernel -------------------------------------------------------
configure_kernel() {
    info "Applying ${DEFCONFIG} base config..."
    make -C "${KERNEL_DIR}" \
        ARCH="${ARCH}" \
        CROSS_COMPILE="${CROSS_COMPILE}" \
        "${DEFCONFIG}"

    info "Merging PiNetOS custom config fragment..."
    "${KERNEL_DIR}/scripts/kconfig/merge_config.sh" \
        -m "${KERNEL_DIR}/.config" "${CUSTOM_CONFIG}"

    make -C "${KERNEL_DIR}" \
        ARCH="${ARCH}" \
        CROSS_COMPILE="${CROSS_COMPILE}" \
        olddefconfig
}

# ---- Build kernel & modules -------------------------------------------------
build_kernel() {
    info "Building kernel image, modules and device trees with ${JOBS} jobs..."
    make -C "${KERNEL_DIR}" \
        ARCH="${ARCH}" \
        CROSS_COMPILE="${CROSS_COMPILE}" \
        -j"${JOBS}" \
        Image.gz modules dtbs

    mkdir -p "${OUTPUT_DIR}"
    cp "${KERNEL_DIR}/arch/arm64/boot/Image.gz"               "${OUTPUT_DIR}/kernel8.img"
    cp "${KERNEL_DIR}/arch/arm64/boot/dts/broadcom/"*.dtb      "${OUTPUT_DIR}/" 2>/dev/null || true

    # Copy device tree overlays
    mkdir -p "${OUTPUT_DIR}/overlays"
    cp "${KERNEL_DIR}/arch/arm64/boot/dts/overlays/"*.dtbo     "${OUTPUT_DIR}/overlays/" 2>/dev/null || true

    # Copy PiNetOS custom DTS (compile separately)
    if command -v dtc &>/dev/null; then
        info "Compiling PiNetOS custom DTS..."
        dtc -I dts -O dtb -o "${OUTPUT_DIR}/bcm2712-rpi5-pinet.dtb" \
            "${SCRIPT_DIR}/bcm2712-rpi5.dts" 2>/dev/null || \
            warn "Custom DTS compile skipped (missing include paths — expected in standalone build)"
    fi
}

# ---- Install modules --------------------------------------------------------
install_modules() {
    local rootfs="${1:-${REPO_ROOT}/build-system/rootfs}"
    info "Installing kernel modules to ${rootfs}..."
    sudo make -C "${KERNEL_DIR}" \
        ARCH="${ARCH}" \
        CROSS_COMPILE="${CROSS_COMPILE}" \
        INSTALL_MOD_PATH="${rootfs}" \
        modules_install
}

# ---- Install device tree headers --------------------------------------------
install_dtbs() {
    local rootfs="${1:-${REPO_ROOT}/build-system/rootfs}"
    local boot="${rootfs}/boot"
    info "Installing DTBs to ${boot}..."
    sudo mkdir -p "${boot}/overlays"
    sudo cp "${OUTPUT_DIR}/kernel8.img" "${boot}/"
    sudo cp "${OUTPUT_DIR}/"*.dtb       "${boot}/" 2>/dev/null || true
    sudo cp "${OUTPUT_DIR}/overlays/"*.dtbo "${boot}/overlays/" 2>/dev/null || true
}

# ---- Main -------------------------------------------------------------------
main() {
    local step="${1:-all}"

    case "${step}" in
        deps)       check_dependencies ;;
        fetch)      check_dependencies; fetch_kernel ;;
        config)     configure_kernel ;;
        build)      build_kernel ;;
        modules)    install_modules "${2:-}" ;;
        dtbs)       install_dtbs "${2:-}" ;;
        all)
            check_dependencies
            fetch_kernel
            configure_kernel
            build_kernel
            info "Kernel build complete. Outputs: ${OUTPUT_DIR}"
            ;;
        *)
            echo "Usage: $0 [deps|fetch|config|build|modules [ROOTFS]|dtbs [ROOTFS]|all]"
            exit 1
            ;;
    esac
}

main "$@"
