# PiNetOS Build System

This directory contains the scripts required to build a bootable Raspberry Pi OS image for PiNetOS.

## Requirements
- A Linux host (Debian/Ubuntu recommended)
- `debootstrap`
- `qemu-user-static`
- `parted`
- `dosfstools`
- `Python 3.11+` and `pip`
- `Node.js 20+` and `npm` (only required for the release-packaging helper scripts)

## Build Instructions

1. Install dependencies on your host:
   ```bash
   sudo apt-get install debootstrap qemu-user-static parted dosfstools
   ```

2. Run the master build script:
   ```bash
   sudo ./build-all.sh
   ```

This will:
1. Compile the PiNetOS Python desktop (FastAPI + Jinja) for ARM64.
2. Build a Debian Bookworm ARM64 root filesystem.
3. Install Xorg, Openbox, Plymouth, and the Minima node.
4. Package everything into `PiNetOS-RaspberryPi.img`.
