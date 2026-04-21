#!/usr/bin/env bash
# =============================================================================
# PiNetOS Complete Build Script for Raspberry Pi 5
# Usage: ./tools/build-rpi5.sh [--clean] [--no-kernel] [--output DIR]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---- Configuration ----------------------------------------------------------
BUILD_DIR="${BUILD_DIR:-${REPO_ROOT}/build}"
OUTPUT_DIR="${OUTPUT_DIR:-${REPO_ROOT}/dist}"
IMAGE_NAME="${IMAGE_NAME:-PiNetOS-RaspberryPi5.img}"
IMAGE_SIZE="${IMAGE_SIZE:-4G}"
BOOT_SIZE="${BOOT_SIZE:-256M}"
ARCH="arm64"
CROSS_COMPILE="${CROSS_COMPILE:-aarch64-linux-gnu-}"
DEBIAN_RELEASE="${DEBIAN_RELEASE:-bookworm}"
DEBIAN_MIRROR="${DEBIAN_MIRROR:-https://deb.debian.org/debian}"
BUILD_KERNEL="${BUILD_KERNEL:-true}"
CLEAN_BUILD="${CLEAN_BUILD:-false}"
JOBS="${JOBS:-$(nproc)}"

# ---- Parse arguments --------------------------------------------------------
for arg in "$@"; do
    case "${arg}" in
        --clean)       CLEAN_BUILD=true ;;
        --no-kernel)   BUILD_KERNEL=false ;;
        --output=*)    OUTPUT_DIR="${arg#--output=}" ;;
        --image=*)     IMAGE_NAME="${arg#--image=}" ;;
        --help|-h)
            echo "Usage: $0 [--clean] [--no-kernel] [--output=DIR] [--image=NAME]"
            exit 0
            ;;
    esac
done

# ---- Colours ----------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
section() { echo -e "\n${BLUE}${BOLD}=== $* ===${NC}\n"; }
step()    { echo -e "${BOLD}--- $* ---${NC}"; }

# ---- Dependency check -------------------------------------------------------
check_deps() {
    section "Checking Build Dependencies"
    local missing=()
    local required=(
        debootstrap parted losetup mkfs.vfat mkfs.ext4 rsync
        qemu-aarch64-static binfmt-support curl git
    )
    [[ "${BUILD_KERNEL}" == "true" ]] && required+=(
        aarch64-linux-gnu-gcc make bc bison flex
        libssl-dev libelf-dev cpio
    )
    for cmd in "${required[@]}"; do
        if ! command -v "${cmd%%:*}" &>/dev/null; then
            missing+=("${cmd}")
        fi
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        warn "Missing: ${missing[*]}"
        info "Install with: sudo apt-get install -y ${missing[*]}"
        error "Please install missing dependencies first."
    fi
    info "All dependencies satisfied."
}

# ---- Step 1: Build Linux kernel (ARM64) ------------------------------------
build_kernel() {
    [[ "${BUILD_KERNEL}" == "true" ]] || { warn "Skipping kernel build (--no-kernel)"; return; }
    section "Building Linux Kernel (ARM64 / BCM2712)"
    bash "${REPO_ROOT}/kernel/build-kernel.sh" all
    info "Kernel build complete."
}

# ---- Step 2: Bootstrap Debian rootfs ----------------------------------------
build_rootfs() {
    section "Building Debian ${DEBIAN_RELEASE} ARM64 Root Filesystem"
    local rootfs="${BUILD_DIR}/rootfs"

    if [[ "${CLEAN_BUILD}" == "true" ]] && [[ -d "${rootfs}" ]]; then
        step "Cleaning previous rootfs..."
        sudo rm -rf "${rootfs}"
    fi
    mkdir -p "${rootfs}"

    step "Running debootstrap (first stage)..."
    sudo debootstrap \
        --arch=arm64 \
        --foreign \
        --components=main,contrib,non-free,non-free-firmware \
        "${DEBIAN_RELEASE}" "${rootfs}" "${DEBIAN_MIRROR}"

    step "Copying QEMU binary for ARM64 chroot emulation..."
    sudo cp /usr/bin/qemu-aarch64-static "${rootfs}/usr/bin/"

    step "Running debootstrap (second stage)..."
    sudo chroot "${rootfs}" /debootstrap/debootstrap --second-stage

    step "Configuring base system..."
    sudo chroot "${rootfs}" /bin/bash -c "
        # Locale
        echo 'en_US.UTF-8 UTF-8' > /etc/locale.gen
        locale-gen
        update-locale LANG=en_US.UTF-8

        # Hostname
        echo 'pinetos' > /etc/hostname
        echo '127.0.1.1  pinetos' >> /etc/hosts

        # apt sources
        cat > /etc/apt/sources.list << 'EOF'
deb ${DEBIAN_MIRROR} ${DEBIAN_RELEASE} main contrib non-free non-free-firmware
deb ${DEBIAN_MIRROR} ${DEBIAN_RELEASE}-updates main contrib non-free non-free-firmware
deb https://security.debian.org/debian-security ${DEBIAN_RELEASE}-security main contrib non-free non-free-firmware
EOF
        apt-get update -qq

        # Base system packages
        DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
            systemd systemd-sysv dbus \
            sudo bash-completion \
            openssh-server \
            network-manager \
            chrony \
            curl wget git ca-certificates \
            htop procps lsof strace \
            vim nano \
            i2c-tools \
            python3 python3-pip \
            openjdk-17-jre-headless \
            xorg xserver-xorg-video-fbdev \
            openbox xterm \
            plymouth plymouth-themes \
            firmware-brcm80211 \
            wpasupplicant \
            avahi-daemon \
            nfs-common \
            rsync \
            ufw \
            jq

        # Raspberry Pi firmware packages
        apt-get install -y --no-install-recommends \
            raspi-firmware raspi-config || true

        # Enable services
        systemctl enable ssh
        systemctl enable NetworkManager
        systemctl enable chrony
        systemctl enable avahi-daemon

        # Create pinet user
        useradd -m -s /bin/bash -G sudo,gpio,i2c,spi,dialout pinet
        echo 'pinet:pinet' | chpasswd
        echo 'pinet ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers.d/pinet

        # Disable root password login (security)
        passwd -l root
    "

    step "Copying PiNetOS application..."
    sudo mkdir -p "${rootfs}/opt/pinetos"
    if [[ -d "${REPO_ROOT}/dist" ]]; then
        sudo cp -r "${REPO_ROOT}/dist"         "${rootfs}/opt/pinetos/web"
    fi
    if [[ -d "${REPO_ROOT}/hal" ]]; then
        sudo cp -r "${REPO_ROOT}/hal"          "${rootfs}/opt/pinetos/hal"
    fi

    step "Installing PiNetOS system services..."
    for svc in "${REPO_ROOT}/system/services/"*.service; do
        sudo cp "${svc}" "${rootfs}/etc/systemd/system/"
    done
    for tmr in "${REPO_ROOT}/system/services/"*.timer; do
        sudo cp "${tmr}" "${rootfs}/etc/systemd/system/"
    done
    sudo cp -r "${REPO_ROOT}/build-system/config/systemd/"*.service \
        "${rootfs}/etc/systemd/system/" 2>/dev/null || true

    # Enable PiNetOS services
    sudo chroot "${rootfs}" /bin/bash -c "
        systemctl enable pinet-desktop.service  || true
        systemctl enable pinet-hal.service      || true
        systemctl enable pinet-ota.timer        || true
        systemctl enable minima.service         || true
    "

    step "Installing OTA update script..."
    sudo cp "${REPO_ROOT}/system/ota/pinet-ota-update.sh" \
        "${rootfs}/usr/local/bin/pinet-ota-update"
    sudo chmod +x "${rootfs}/usr/local/bin/pinet-ota-update"
    sudo mkdir -p "${rootfs}/etc/pinetos"
    sudo cp "${REPO_ROOT}/system/ota/ota.conf"   "${rootfs}/etc/pinetos/ota.conf"
    echo "0.0.0" | sudo tee "${rootfs}/etc/pinetos/version" > /dev/null

    step "Copying network configuration..."
    sudo mkdir -p "${rootfs}/etc/NetworkManager"
    sudo cp "${REPO_ROOT}/system/networking/NetworkManager.conf" \
        "${rootfs}/etc/NetworkManager/NetworkManager.conf"

    step "Cleaning up debootstrap artifacts..."
    sudo rm -f "${rootfs}/usr/bin/qemu-aarch64-static"

    info "Root filesystem built: ${rootfs}"
}

# ---- Step 4: Install kernel files into rootfs --------------------------------
install_kernel() {
    section "Installing Kernel into Root Filesystem"
    local rootfs="${BUILD_DIR}/rootfs"
    local kout="${REPO_ROOT}/kernel/output"

    if [[ ! -f "${kout}/kernel8.img" ]]; then
        warn "Kernel output not found at ${kout}. Skipping kernel install."
        return
    fi
    sudo mkdir -p "${rootfs}/boot"
    sudo cp "${kout}/kernel8.img"    "${rootfs}/boot/"
    sudo cp "${kout}/"*.dtb          "${rootfs}/boot/" 2>/dev/null || true
    sudo mkdir -p "${rootfs}/boot/overlays"
    sudo cp "${kout}/overlays/"*.dtbo "${rootfs}/boot/overlays/" 2>/dev/null || true
    sudo cp "${REPO_ROOT}/boot/config.txt"  "${rootfs}/boot/"
    sudo cp "${REPO_ROOT}/boot/cmdline.txt" "${rootfs}/boot/"
    info "Kernel installed into rootfs."
}

# ---- Step 5: Build disk image -----------------------------------------------
build_image() {
    section "Building Flashable Disk Image"
    local rootfs="${BUILD_DIR}/rootfs"
    local image="${OUTPUT_DIR}/${IMAGE_NAME}"

    mkdir -p "${OUTPUT_DIR}"

    step "Allocating ${IMAGE_SIZE} image file..."
    fallocate -l "${IMAGE_SIZE}" "${image}"

    step "Partitioning image (BOOT: ${BOOT_SIZE} FAT32, ROOT: remaining EXT4)..."
    parted -s "${image}" mklabel msdos
    parted -s "${image}" mkpart primary fat32 4MiB "${BOOT_SIZE}"
    parted -s "${image}" mkpart primary ext4  "${BOOT_SIZE}" 100%
    parted -s "${image}" set 1 boot on

    step "Setting up loop devices..."
    LOOP_DEV="$(sudo losetup -fP --show "${image}")"
    BOOT_DEV="${LOOP_DEV}p1"
    ROOT_DEV="${LOOP_DEV}p2"
    trap "sudo losetup -d '${LOOP_DEV}' 2>/dev/null || true" EXIT

    step "Formatting partitions..."
    sudo mkfs.vfat -F 32 -n BOOT "${BOOT_DEV}"
    sudo mkfs.ext4 -L rootfs -O '^64bit' "${ROOT_DEV}"

    step "Mounting and copying filesystem..."
    local mnt="${BUILD_DIR}/mnt"
    mkdir -p "${mnt}/root"
    sudo mount "${ROOT_DEV}" "${mnt}/root"
    sudo mkdir -p "${mnt}/root/boot"
    sudo mount "${BOOT_DEV}" "${mnt}/root/boot"

    info "Copying rootfs (this may take several minutes)..."
    sudo rsync -a --exclude=/proc --exclude=/sys --exclude=/dev \
        "${rootfs}/" "${mnt}/root/"

    step "Writing fstab..."
    local root_uuid; root_uuid="$(sudo blkid -s UUID -o value "${ROOT_DEV}")"
    local boot_uuid; boot_uuid="$(sudo blkid -s UUID -o value "${BOOT_DEV}")"
    sudo tee "${mnt}/root/etc/fstab" > /dev/null << EOF
UUID=${root_uuid}  /       ext4  defaults,noatime         0  1
UUID=${boot_uuid}  /boot   vfat  defaults,noatime,umask=0022  0  2
tmpfs              /tmp    tmpfs defaults,noatime,size=256m   0  0
EOF

    step "Writing cmdline.txt..."
    local root_partuuid; root_partuuid="$(sudo blkid -s PARTUUID -o value "${ROOT_DEV}")"
    sudo tee "${mnt}/root/boot/cmdline.txt" > /dev/null << EOF
console=ttyAMA0,115200 console=tty1 root=PARTUUID=${root_partuuid} rootfstype=ext4 fsck.repair=yes rootwait quiet splash plymouth.ignore-serial-consoles cgroup_enable=memory cgroup_memory=1 swapaccount=1 systemd.unified_cgroup_hierarchy=1
EOF

    step "Unmounting..."
    sudo umount "${mnt}/root/boot"
    sudo umount "${mnt}/root"
    sudo losetup -d "${LOOP_DEV}"
    trap - EXIT
    rmdir "${mnt}/root" "${mnt}" 2>/dev/null || true

    step "Compressing image..."
    gzip -k "${image}"
    info "Image built: ${image}"
    info "Compressed:  ${image}.gz"
    ls -lh "${image}" "${image}.gz"
}

# ---- Main -------------------------------------------------------------------
section "PiNetOS RPi 5 Build System"
info "Repository root: ${REPO_ROOT}"
info "Build directory: ${BUILD_DIR}"
info "Output directory: ${OUTPUT_DIR}"
info "Clean build: ${CLEAN_BUILD}"
info "Build kernel: ${BUILD_KERNEL}"
echo

mkdir -p "${BUILD_DIR}" "${OUTPUT_DIR}"

check_deps
build_kernel
build_rootfs
install_kernel
build_image

section "Build Complete!"
info "Image: ${OUTPUT_DIR}/${IMAGE_NAME}"
info "Flash with: sudo dd if=${OUTPUT_DIR}/${IMAGE_NAME} of=/dev/sdX bs=4M status=progress"
info "Or use: ./tools/flash.sh ${OUTPUT_DIR}/${IMAGE_NAME} /dev/sdX"
