# Downloading PiNetOS for Raspberry Pi

This guide explains how to download and flash **PiNetOS** so it runs natively on your Raspberry Pi.

---

## Quick Download

Go to the **[Latest Release](https://github.com/WilliamMajanja/Minima-PiNet-Os/releases/latest)** page and download:

| Artifact | What it is |
| :--- | :--- |
| **`PiNetOS-RaspberryPi.img`** | Flashable disk image — write directly to an SD card or NVMe |
| **`PiNetOS-RaspberryPi-Package-v*.zip`** | Bundled package containing the `.img`, flashing instructions, checksums, and release notes |
| `SHA256SUMS.txt` | Cryptographic checksums for all release artifacts (ECDSA P-256 signed via CPIP) |

> **Recommended:** Download the **Package zip** for an all-in-one bundle, or the standalone `.img` if you only need the image.

---

## Verify Download Integrity

Always verify the checksum before flashing to ensure your download is complete and untampered.

### Linux / macOS

```bash
# Download SHA256SUMS.txt from the same release
sha256sum --check SHA256SUMS.txt
```

### Windows (PowerShell)

```powershell
(Get-FileHash PiNetOS-RaspberryPi.img -Algorithm SHA256).Hash
# Compare the output with the hash in SHA256SUMS.txt
```

---

## Flash the Image

### Option 1: Raspberry Pi Imager (Recommended)

1. Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. Open Raspberry Pi Imager.
3. Click **CHOOSE OS** → scroll to the bottom → **Use custom**.
4. Select `PiNetOS-RaspberryPi.img`.
5. Click **CHOOSE STORAGE** → select your MicroSD card (16 GB minimum) or NVMe SSD.
6. *(Optional)* Click ⚙️ to pre-configure WiFi, hostname, and SSH.
7. Click **WRITE** and wait for completion.

### Option 2: BalenaEtcher

1. Download and install [BalenaEtcher](https://balena.io/etcher/).
2. Click **Flash from file** → select `PiNetOS-RaspberryPi.img`.
3. Click **Select target** → choose your SD card.
4. Click **Flash!** and wait for completion.

### Option 3: dd (Linux / macOS)

```bash
# Identify your SD card device (e.g. /dev/sdX or /dev/diskN)
lsblk

# Unmount any mounted partitions (ignore errors if none are mounted)
sudo umount /dev/sdX* 2>/dev/null || true

# Flash the image (DOUBLE-CHECK the target device!)
sudo dd if=PiNetOS-RaspberryPi.img of=/dev/sdX bs=4M status=progress conv=sync,noerror
sync
```

### Option 4: Win32DiskImager (Windows)

1. Open [Win32DiskImager](https://win32diskimager.org/).
2. Select `PiNetOS-RaspberryPi.img` and your SD card drive letter.
3. Click **Write**.

---

## First Boot

1. Insert the flashed MicroSD / NVMe into your Raspberry Pi.
2. Connect display (micro-HDMI), keyboard, and network (Ethernet recommended).
3. Connect USB-C power last.
4. Wait ~2 minutes for first-boot provisioning to complete.

### Default Credentials

| | Value |
| :--- | :--- |
| **Username** | `pinet` |
| **Password** | `pinet` |
| **Web Dashboard** | `http://<pi-ip>:3000` |
| **SSH** | Enabled on port 22 |

> ⚠️ **Change the default password immediately** after first login: `passwd`

---

## Hardware Requirements

| Component | Minimum | Recommended |
| :--- | :--- | :--- |
| **Platform** | Raspberry Pi 4 (4 GB) | **Raspberry Pi 5 (16 GB)** |
| **AI Accelerator** | ARM NEON (CPU) | **Hailo-8L NPU (13 TOPS)** |
| **Storage** | 16 GB MicroSD (Class 10) | 128 GB NVMe SSD (PCIe Gen 3) |
| **Network** | Gigabit Ethernet | Gigabit Ethernet + WireGuard mesh |
| **Power** | USB-C 5V/3A | Official RPi 27W USB-C PSU |
| **Cooling** | Passive heatsink | Active cooler (required for RPi 5) |

---

## Other Release Artifacts

Each release also includes these optional downloads:

| Artifact | Description |
| :--- | :--- |
| `Minima-PiNet-Os-v*.zip` | Full source archive (ZIP) |
| `Minima-PiNet-Os-v*.tar.gz` | Full source archive (TAR.GZ) |
| `PiNetOS-Enterprise.zip` | Enterprise cluster management stack |
| `PiNetOS-Build-System.zip` | Build pipeline for generating custom images |
| `PiNetOS-Documentation.zip` | Full documentation archive |

---

## Building a Custom Image From Source

If you need a custom image (e.g. with specific cluster secrets or configurations):

1. Download `PiNetOS-Build-System.zip` from the release.
2. Extract and run:
   ```bash
   sudo apt-get install debootstrap qemu-user-static parted dosfstools mtools
   sudo ./build-all.sh
   ```

See [docs/INSTALL.md](docs/INSTALL.md) for full installation and configuration details.

---

## Troubleshooting

| Problem | Solution |
| :--- | :--- |
| No display output | Use micro-HDMI port 0 (closest to power). Try a different cable. |
| Pi won't boot | Re-flash the SD card. Check power LED (solid red = OK). |
| Checksum mismatch | Re-download the `.img` — the file may be corrupted or incomplete. |
| Can't access web dashboard | Check `http://<pi-ip>:3000`. Ensure Pi is on the same network. |

---

## Links

- **Latest Release:** <https://github.com/WilliamMajanja/Minima-PiNet-Os/releases/latest>
- **All Releases:** <https://github.com/WilliamMajanja/Minima-PiNet-Os/releases>
- **Issues:** <https://github.com/WilliamMajanja/Minima-PiNet-Os/issues>
- **Full Install Guide:** [docs/INSTALL.md](docs/INSTALL.md)

*PiNetOS is MIT licensed. Architected by William Majanja.*
