# Installation

Complete guide for installing Minima PiNet OS on Raspberry Pi hardware.

---

## Requirements

| Component | Minimum | Recommended |
|---|---|---|
| **Board** | Raspberry Pi 4 (4 GB) | Raspberry Pi 5 (16 GB) |
| **Storage** | 16 GB MicroSD (Class 10) | 128 GB+ NVMe SSD (PCIe Gen 3) |
| **Power Supply** | USB-C 5V/3A | Official RPi 27W USB-C PSU |
| **Display** | Micro-HDMI to HDMI cable | Micro-HDMI 2.0 (4K capable) |
| **Network** | Ethernet or Wi-Fi | Gigabit Ethernet |
| **Cooling** | Passive heatsink | Official Active Cooler (required for Pi 5) |
| **AI Accelerator** | ARM NEON (CPU fallback) | Hailo-8L M.2 NPU (13 TOPS) |

---

## Step 1: Download the Image

Download `PiNetOS-RaspberryPi.img` from the [latest release](https://github.com/WilliamMajanja/Minima-PiNet-Os/releases).

### Verify Checksum

```bash
# Linux / macOS
sha256sum --check SHA256SUMS.txt

# macOS alternative
shasum -a 256 PiNetOS-RaspberryPi.img

# Windows (PowerShell)
(Get-FileHash PiNetOS-RaspberryPi.img -Algorithm SHA256).Hash
```

---

## Step 2: Flash the Image

### Option A: Raspberry Pi Imager (Recommended)

1. Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Choose OS → **Use custom** → select `PiNetOS-RaspberryPi.img`
3. Choose Storage → select your SD card or NVMe drive
4. Click **WRITE**

### Option B: BalenaEtcher

1. Download [BalenaEtcher](https://www.balena.io/etcher/)
2. Select the `.img` file
3. Select target drive
4. Click **Flash!**

### Option C: `dd` (Linux/macOS)

```bash
sudo dd if=PiNetOS-RaspberryPi.img of=/dev/sdX bs=4M status=progress
sync
```

> ⚠️ Replace `/dev/sdX` with your actual device. Use `lsblk` to identify it.

### Option D: Win32DiskImager (Windows)

1. Open Win32DiskImager
2. Select the `.img` file and target drive
3. Click **Write**

---

## Step 3: Hardware Setup

1. Insert the flashed SD card or NVMe SSD
2. Connect display via **micro-HDMI port 0** (closest to USB-C power)
3. Connect keyboard and mouse via USB
4. Connect Ethernet cable (recommended) or configure Wi-Fi after boot
5. Attach the Active Cooler if using Raspberry Pi 5
6. Connect USB-C power supply **last**

---

## Step 4: First Boot

1. Power on the Pi — the green LED will flash during boot
2. Wait **2–3 minutes** for first-boot provisioning
3. The system will:
   - Expand the filesystem
   - Generate SSH host keys
   - Initialize the Minima blockchain node
   - Start the web desktop server

---

## Step 5: Login

### Default Credentials

| Field | Value |
|---|---|
| Username | `pinet` |
| Password | `pinet` |
| SSH Port | 22 |
| Dashboard | `http://<pi-ip>:3000` |

> ⚠️ **Change the default password immediately:**
> ```bash
> passwd
> ```

---

## Step 6: Initial Configuration

```bash
# Configure Wi-Fi (if not using Ethernet)
sudo nmtui

# Update the system
sudo pinet-pkg update
sudo pinet-pkg upgrade

# Set up SSH key authentication
ssh-copy-id pinet@<pi-ip>
```

---

## Step 7: Verify Installation

```bash
# Run the test suite
bash /opt/pinetos/tests/system/run-tests.sh --suite all
```

Expected output:
```
[PASS] System boot integrity
[PASS] Minima node reachable on :9005
[PASS] Desktop API responding on :3000
[PASS] GPIO HAL initialized
[PASS] Cluster manager healthy
```

---

## Step 8: Access the Dashboard

Open a browser and navigate to:

```
http://<pi-ip>:3000
```

You'll see the PiNet OS desktop with the taskbar and 20 built-in applications.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| No display output | Use **micro-HDMI port 0** (closest to USB-C); try a different cable |
| Pi won't boot | Re-flash the SD card; verify the power LED is on |
| Wi-Fi not working | `sudo rfkill unblock wifi && sudo systemctl restart NetworkManager` |
| SSH connection refused | `sudo systemctl enable --now ssh` |
| Temperature throttling | Check `vcgencmd measure_temp` — should be below 80°C; ensure active cooling |
| Dashboard not loading | Verify port 3000 is open: `curl http://localhost:3000/api/health` |

---

## Other Installation Paths

- **Local Development (any OS):** See [Getting Started](Getting-Started)
- **Spawnable Runtime (CLI):** See [Getting Started](Getting-Started#option-3-spawnable-runtime-automation-friendly)
- **Multi-Node Cluster:** See [Cluster Management](Cluster-Management)

---

## Release Artifacts

| Artifact | Description |
|---|---|
| `PiNetOS-RaspberryPi.img` | Flashable disk image for Raspberry Pi |
| `PiNetOS-RaspberryPi-Package-v*.zip` | Image + flashing guide + checksums |
| `PiNetOS-Enterprise.zip` | Enterprise cluster stack |
| `PiNetOS-Build-System.zip` | Build scripts and configuration |
| `PiNetOS-Documentation.zip` | Full documentation bundle |
| `SHA256SUMS.txt` | Cryptographic verification checksums |

All artifacts are available on the [Releases page](https://github.com/WilliamMajanja/Minima-PiNet-Os/releases).
