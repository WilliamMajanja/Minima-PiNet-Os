# PiNetOS Architecture

PiNetOS is a custom operating system designed for Raspberry Pi 4 and 5, built to run decentralized Web3 nodes and edge computing workloads.

## System Stack

1. **Hardware:** Raspberry Pi 4 / 5 (ARM64)
2. **Bootloader:** Raspberry Pi Firmware
3. **Kernel:** Linux Kernel (arm64)
4. **Init System:** systemd
5. **Display Server:** Xorg
6. **Window Manager:** Openbox
7. **Desktop Environment:** PiNetOS Web Desktop (FastAPI + Jinja2)
8. **Blockchain Node:** Minima (Java)

## Key Components

- **Base OS:** Debian Bookworm ARM64. Chosen for stability and wide hardware support.
- **Root Filesystem:** Built using `debootstrap`.
- **Graphical Environment:** A minimal Xorg + Openbox setup is used instead of a full desktop environment (like PIXEL or GNOME) to save resources. A Chromium kiosk window served from the local FastAPI desktop (port 3000) acts as the primary user interface.
- **Minima Node:** Runs as a systemd service (`minima.service`), ensuring it starts automatically and restarts on failure.
- **Persistent Storage:** User data and wallet keys are stored in `~/pinet-data` and `~/pinet-wallet`.
