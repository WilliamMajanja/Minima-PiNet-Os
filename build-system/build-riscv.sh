#!/bin/bash
# PiNet-OS v2.0.0 — RISC-V Cross-Build Script
#
# Builds the PiNet-OS kernel and rootfs for RISC-V reference boards:
#   - StarFive VisionFive 2 (JH7110, SiFive U74 quad-core)
#   - MangoPi MQ-Pro (Allwinner D1, single-core)
#
# Prerequisites:
#   sudo apt install gcc-riscv64-linux-gnu device-tree-compiler
#
# Usage:
#   bash build-riscv.sh [--board visionfive2|mqpro] [--output /path/to/output]

set -e

BOARD="${BOARD:-visionfive2}"
OUTPUT_DIR="${OUTPUT_DIR:-./output-riscv}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Parse args
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --board) BOARD="$2"; shift 2 ;;
        --output) OUTPUT_DIR="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "╔══════════════════════════════════════════════════╗"
echo "║  PiNet-OS v2.0.0 — RISC-V Build ($BOARD)       ║"
echo "╚══════════════════════════════════════════════════╝"

# Select board-specific config
case "$BOARD" in
    visionfive2)
        DTS="kernel/riscv/jh7110-pinet.dts"
        CONFIG="kernel/riscv/riscv-jh7110.config"
        ;;
    mqpro)
        echo "MangoPi MQ-Pro support coming soon. Using VisionFive 2 config as base."
        DTS="kernel/riscv/jh7110-pinet.dts"
        CONFIG="kernel/riscv/riscv-jh7110.config"
        ;;
    *)
        echo "Unknown board: $BOARD (use visionfive2 or mqpro)"
        exit 1
        ;;
esac

CROSS_COMPILE="riscv64-linux-gnu-"
ARCH="riscv"

# ─── Step 1: Compile Device Tree ─────────────────────────────
echo "[1/4] Compiling RISC-V device tree..."
mkdir -p "$OUTPUT_DIR"
dtc -I dts -O dtb -o "$OUTPUT_DIR/jh7110-pinet.dtb" "$PROJECT_ROOT/$DTS"
echo "  -> jh7110-pinet.dtb"

# ─── Step 2: Configure Kernel ─────────────────────────────────
echo "[2/4] Configuring RISC-V kernel..."
cd "$PROJECT_ROOT/kernel"
if [ ! -d linux-riscv ]; then
    echo "  Cloning Linux RISC-V kernel..."
    git clone --depth=1 --branch riscv/for-next \
        https://git.kernel.org/pub/scm/linux/kernel/git/riscv/linux.git linux-riscv
fi
cd linux-riscv
cp "$PROJECT_ROOT/$CONFIG" .config
make ARCH=$ARCH CROSS_COMPILE=$CROSS_COMPILE olddefconfig

# ─── Step 3: Build Kernel ─────────────────────────────────────
echo "[3/4] Building RISC-V kernel (this may take a while)..."
make ARCH=$ARCH CROSS_COMPILE=$CROSS_COMPILE -j"$(nproc)" Image modules dtbs

# Copy artifacts
cp arch/riscv/boot/Image "$OUTPUT_DIR/Image"
cp arch/riscv/boot/dts/starfive/*.dtb "$OUTPUT_DIR/" 2>/dev/null || true

# ─── Step 4: Build Rootfs Overlay ─────────────────────────────
echo "[4/4] Building RISC-V rootfs overlay..."
OVERLAY="$OUTPUT_DIR/riscv-rootfs-overlay"
mkdir -p "$OVERLAY/usr/local/bin" "$OVERLAY/opt/pinet/desktop" "$OVERLAY/etc/pinet"

# Copy PiNet CLI and runtime
cp "$PROJECT_ROOT/bin/pinet" "$OVERLAY/usr/local/bin/" 2>/dev/null || true
cp "$PROJECT_ROOT/bin/pinet-setup" "$OVERLAY/usr/local/bin/" 2>/dev/null || true
cp -r "$PROJECT_ROOT/lib/"*.sh "$OVERLAY/usr/local/lib/" 2>/dev/null || true

# Copy backend (Python is cross-platform)
cp -r "$PROJECT_ROOT/backend" "$OVERLAY/opt/pinet/desktop/"
cp -r "$PROJECT_ROOT/frontend" "$OVERLAY/opt/pinet/desktop/"
cp "$PROJECT_ROOT/run.py" "$OVERLAY/opt/pinet/desktop/"
cp "$PROJECT_ROOT/requirements.txt" "$OVERLAY/opt/pinet/desktop/"

# Copy boot config
cp "$PROJECT_ROOT/boot/riscv/uEnv.txt" "$OVERLAY/"

# Copy RISC-V device tree
cp "$OUTPUT_DIR/jh7110-pinet.dtb" "$OVERLAY/"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  RISC-V Build Complete!                          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  Board:     $BOARD"
echo "  Output:    $OUTPUT_DIR"
echo "  Kernel:    $OUTPUT_DIR/Image"
echo "  Device Tree: $OUTPUT_DIR/jh7110-pinet.dtb"
echo "  Rootfs:    $OUTPUT_DIR/riscv-rootfs-overlay/"
echo ""
echo "  Next steps:"
echo "    1. Create a FAT32 boot partition with uEnv.txt + Image + .dtb"
echo "    2. Create an ext4 root partition with the rootfs overlay"
echo "    3. Flash to SD card and boot on the RISC-V board"