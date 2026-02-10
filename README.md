# PiNetOS

PiNetOS is a hardened Raspberry Pi Operating System designed for kiosk, wallet, and fleet deployments.

Features:
- Secure boot + measured boot
- A/B OTA rollback
- Signed updates
- Encrypted persistent storage
- GPU-accelerated Chromium kiosk
- Wallet subsystem
- Recovery mode
- Offline installer ISO
- Fleet management
- Pi Zero → Pi 5 support

## Build (on Raspberry Pi OS)

```bash
sudo apt update
sudo apt install -y git rsync curl xz-utils parted qemu-user-static debootstrap zerofree zip unzip genisoimage squashfs-tools docker.io chromium network-manager cryptsetup tpm2-tools openssl
git clone https://github.com/RaspberryPiFoundation/raspi-image-gen.git
mv raspi-image-gen PiNetOS/raspi-image-gen
cd PiNetOS
chmod +x build.sh scripts/*.sh overlay/rootfs/usr/local/bin/*
sudo ./build.sh
```

Output:

`tools/output/PiNetOS.img`