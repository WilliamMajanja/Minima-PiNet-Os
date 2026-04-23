# Deployment Guide — Minima-PiNet-OS v1.1.0

This guide covers three deployment paths: **local dev/demo**, **Raspberry Pi hardware**, and **investor test drive**.

---

## 1. Local Demo (Any Machine)

Run the full web desktop UI locally in under two minutes — no Raspberry Pi required.

### Prerequisites
- Python 3.11+ and pip

### Steps

```bash
# 1. Clone and enter the repo
git clone https://github.com/WilliamMajanja/Minima-PiNet-Os.git
cd Minima-PiNet-Os

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Copy and configure environment (API keys are optional for the demo)
cp .env.example .env

# 4. Start the desktop server
python run.py
```

Open **http://localhost:3000** in your browser. The PiNetOS web desktop will load with the full UI including the system monitor, terminal, cluster dashboard, and Minima node panel.

---

## 2. Raspberry Pi Hardware Deployment

### Flash the OS Image

1. Download `PiNetOS-RaspberryPi.img` from the [latest release](https://github.com/WilliamMajanja/Minima-PiNet-Os/releases/latest).
2. Verify the checksum:
   ```bash
   sha256sum --check SHA256SUMS.txt
   ```
3. Flash with [Raspberry Pi Imager](https://www.raspberrypi.com/software/):
   - Click **CHOOSE OS** → **Use custom** → select `PiNetOS-RaspberryPi.img`
   - Click **CHOOSE STORAGE** → select your SD card or NVMe
   - (Optional) Click ⚙️ to pre-configure Wi-Fi and SSH
   - Click **WRITE**
4. Insert the storage into your Pi 5 and power on.
5. First-boot provisioning takes ~2 minutes.
6. Access the dashboard at `http://<pi-ip>:3000`.

**Default credentials:** username `pinet`, password `pinet` — change immediately with `passwd`.

### Minimum Hardware
- Raspberry Pi 5 (16 GB recommended)
- 16 GB+ MicroSD or NVMe SSD
- Gigabit Ethernet or Wi-Fi

---

## 3. Investor Test Drive Checklist

Walk through these steps to demonstrate the full PiNet 3.0 feature set.

### ✅ Web Desktop
- [ ] Load `http://localhost:3000` (or `http://<pi-ip>:3000`)
- [ ] Verify system metrics update in real time (CPU, RAM, temperature)
- [ ] Open the in-browser terminal and run `uname -a`
- [ ] Browse the file manager

### ✅ Minima Blockchain Node
- [ ] Navigate to the **Minima** panel in the dashboard
- [ ] Confirm the node status shows **Running**
- [ ] View the node's address and current block height

### ✅ Cluster Manager
- [ ] Navigate to the **Cluster** panel
- [ ] Confirm the local node appears in the node list
- [ ] (Multi-Pi) Power on a second Pi and verify it auto-discovers via Maxima P2P

### ✅ AI Acceleration (Pi 5 + Hailo-8L)
- [ ] Navigate to the **AI Engine** panel
- [ ] Run the sample inference benchmark
- [ ] Confirm Hailo-8L NPU is detected and TOPS reading is shown

### ✅ Security Attestation
- [ ] Navigate to **Security** → **Attestation**
- [ ] Trigger a manual attestation check
- [ ] Confirm integrity report shows **VERIFIED** against the Minima ledger

### ✅ Enterprise Image Builder
- [ ] Navigate to the **Pi Imager Portal**
- [ ] Click **Execute Enterprise Build**
- [ ] Confirm a `.img` artifact is generated and available for download

---

## 4. Configuration Reference

All runtime configuration is controlled via environment variables. Copy `.env.example` to `.env` and edit as needed.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PINET_DESKTOP_PORT` | `3000` | Web desktop / API server port |
| `PINET_MINIMA_RPC_PORT` | `9001` | Minima blockchain node RPC port |
| `PINET_CLUSTER_API_PORT` | `9090` | PiNet cluster manager API port |
| `PINET_NETWORK_INTERFACE` | `eth0` | Network interface to bind to |
| `GEMINI_API_KEY` | — | Google Gemini API key (AI features) |
| `GITHUB_TOKEN` | — | GitHub token for release publishing |

---

## 5. Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| Port 3000 already in use | Set `PINET_DESKTOP_PORT=3001` in `.env` |
| `pip install` fails | Ensure Python 3.11+ is installed (`python3 --version`) |
| Pi not booting | Re-flash the SD card; verify power supply (27 W USB-C) |
| Web UI not loading on Pi | Check `sudo systemctl status pinet-desktop` on the Pi |
| Minima node offline | Run `sudo systemctl restart minima` on the Pi |
| SSH refused | Run `sudo systemctl enable --now ssh` on the Pi |

---

*Minima-PiNet-OS is MIT licensed. See [LICENSE](LICENSE) for details.*
