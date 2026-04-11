# PiNetOS Installation Guide — Raspberry Pi 5

## Overview

This guide walks you through installing **PiNetOS** on a Raspberry Pi 5. PiNetOS is a specialised Debian-based Linux distribution with integrated Minima blockchain node, AI acceleration support, and the PiNet edge-computing stack.

---

## Requirements

| Component | Minimum | Recommended |
|---|---|---|
| **Board** | Raspberry Pi 5 (4GB) | Raspberry Pi 5 (16GB) |
| **Storage** | 16 GB microSD (Class 10) | 128 GB NVMe SSD (via PCIe) |
| **Power supply** | USB-C 5V/3A | Official RPi 27W USB-C PSU |
| **Display** | micro-HDMI to HDMI cable | micro-HDMI to HDMI 2.0 (4K) |
| **Internet** | Ethernet or WiFi | Gigabit Ethernet |
| **Dev machine OS** | Windows / macOS / Linux | |

---

## Step 1 — Download the Image

Download the latest PiNetOS image from the [Releases](https://github.com/WilliamMajanja/Minima-PiNet-Os/releases/latest) page:

| Artifact | Description |
| :--- | :--- |
| `PiNetOS-RaspberryPi.img` | Flashable Raspberry Pi disk image |
| `PiNetOS-RaspberryPi-Package-v*.zip` | Image bundled with flashing instructions and checksums |
| `SHA256SUMS.txt` | Cryptographic checksums for all release artifacts |

> **Tip:** The `PiNetOS-RaspberryPi-Package-v*.zip` includes flashing instructions, release notes, and checksums alongside the `.img` — ideal for offline use.

Verify the SHA-256 checksum:

```bash
# Linux / macOS
sha256sum --check SHA256SUMS.txt

# Windows (PowerShell)
Get-FileHash PiNetOS-RaspberryPi.img -Algorithm SHA256
```

Compare with the `SHA256SUMS.txt` file published alongside the release.

---

## Step 2 — Flash to Storage Media

### Option A: Raspberry Pi Imager (Recommended — All Platforms)

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. Click **CHOOSE OS** → scroll down → **Use custom**.
3. Select the downloaded `.img` file.
4. Click **CHOOSE STORAGE** → select your SD card or NVMe.
5. Click ⚙️ (Advanced) to pre-configure WiFi, SSH, and hostname (optional but recommended).
6. Click **WRITE** and confirm.

### Option B: PiNetOS CLI Flasher (Linux/macOS)

```bash
# Flash in one step
./tools/flash.sh PiNetOS-RaspberryPi.img

# Or with explicit device
./tools/flash.sh PiNetOS-RaspberryPi.img /dev/sdb
```

### Option C: Manual dd (Linux)

```bash
# Flash (replace /dev/sdX with your device — USE WITH CAUTION)
sudo dd if=PiNetOS-RaspberryPi.img of=/dev/sdX \
    bs=4M status=progress conv=sync,noerror
sync
```

### Option D: Win32DiskImager (Windows)

1. Open [Win32DiskImager](https://win32diskimager.org/).
2. Select the `.img` file and your SD card drive letter.
3. Click **Write**.

---

## Step 3 — Hardware Setup

### Micro-HDMI Connection
The Raspberry Pi 5 has **two micro-HDMI ports**.
- Port **0** (closest to USB-C power) → primary display
- Port **1** → secondary display

Use a **micro-HDMI to HDMI** cable (not standard HDMI).

### USB-C Power
Use the **official Raspberry Pi 27W USB-C Power Supply** or any USB-C PD supply delivering **5V/5A (27W)**. Inadequate power will trigger throttling warnings.

### NVMe SSD (Optional but Recommended)
1. Attach an **M.2 NVMe SSD** using an official RPi 5 M.2 HAT or third-party adapter.
2. Enable NVMe boot in the EEPROM: `sudo raspi-config` → Advanced → Boot Order → NVMe/USB Boot.

### Active Cooling
The RPi 5 **requires active cooling** for sustained workloads. The official **Active Cooler** or **Case Fan** is strongly recommended.

---

## Step 4 — First Boot

1. Insert the flashed microSD / NVMe into your Raspberry Pi 5.
2. Connect display, keyboard, and network.
3. Connect the USB-C power supply last.
4. The PiNetOS Plymouth boot animation will appear within ~10 seconds.
5. First boot takes ~2–3 minutes to complete initial configuration.

### Default Credentials

| | Value |
|---|---|
| **Username** | `pinet` |
| **Password** | `pinet` |
| **Root password** | Disabled (use `sudo`) |
| **SSH** | Enabled on port 22 |
| **Web Dashboard** | `http://<pi-ip>:3000` |

> **Security:** Change the default password immediately:
> ```bash
> passwd
> ```

---

## Step 5 — Initial Configuration

### Connect to WiFi (if not using Ethernet)

```bash
# Interactive configuration
sudo nmtui

# Or command line
sudo nmcli dev wifi connect "YourSSID" password "YourPassword"
```

### Update System

```bash
sudo pinet-pkg update
sudo pinet-pkg upgrade
```

### Enable SSH Key Authentication (Recommended)

```bash
# On your development machine
ssh-copy-id pinet@<pi-ip>

# Disable password authentication (optional but recommended)
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

---

## Step 6 — Verify Installation

Run the PiNetOS system test suite to validate all components:

```bash
# On the Pi (if tests are deployed with the OS)
bash /opt/pinetos/tests/system/run-tests.sh --suite all

# From a cloned repository
bash tests/system/run-tests.sh --suite all
```

Expected output:
```
✔ CPU: BCM2712 (Cortex-A76) detected
✔ RAM: 16 GB (≥ 4 GB required)
✔ I2C: 2 bus(es) found
✔ SPI: 2 device(s) found
✔ Thermal: CPU temperature 42°C (normal)
✔ Service NetworkManager: active
✔ Service ssh: active
...
All tests passed!
```

---

## Step 7 — Access the PiNetOS Dashboard

Open a browser and navigate to `http://<pi-ip>:3000` (or `http://localhost:3000` if on the Pi directly).

The PiNetOS desktop interface provides:
- **System Monitor** — CPU, RAM, temperature, throttle status
- **Minima Node** — blockchain node management
- **Cluster Manager** — multi-Pi cluster orchestration
- **Terminal** — in-browser shell
- **Settings** — system configuration

---

## Troubleshooting

### No Display Output
- Ensure micro-HDMI is plugged into **port 0** (closest to power connector).
- Try a different cable — cheap cables often fail with micro-HDMI.
- Check `config.txt` settings: `hdmi_force_hotplug=1`.

### Pi Not Booting
- Verify the SD card was flashed correctly (re-flash if unsure).
- Check the power LED — solid red = OK, blinking = power issue.
- Try the official 27W USB-C PSU.
- Check serial console: connect USB-UART adapter to GPIO 14/15 (pins 8/10).

### WiFi Not Working
```bash
sudo rfkill unblock wifi
sudo systemctl restart NetworkManager
nmcli dev wifi list
```

### SSH Connection Refused
```bash
sudo systemctl status ssh
sudo systemctl enable --now ssh
```

### Temperature Throttling
```bash
vcgencmd get_throttled   # 0x0 = no throttling
vcgencmd measure_temp    # Should be < 80°C under load
```

---

## Next Steps

- Read the **[Hardware Guide](HARDWARE.md)** for GPIO, I2C, SPI pinout
- Read the **[Development Guide](DEVELOPMENT.md)** to build drivers and services
- Join the community on [GitHub Discussions](https://github.com/WilliamMajanja/Minima-PiNet-Os/discussions)
