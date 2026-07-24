# Deployment Guide — Minima-PiNet-OS v1.3.0

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
pip install --break-system-packages -r requirements.txt

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
- (Optional) Hailo-8L NPU for AI acceleration
- (Optional) Pi Zero 2 W for custom sensor deployments

### RISC‑V (Experimental, v2.0.0)
- StarFive VisionFive 2 (JH7110, 8 GB variant recommended)
- 32 GB+ MicroSD or eMMC module
- Cross-build toolchain: run `bash build-system/build-riscv.sh` on an x86_64 or aarch64 build host
- Flashing: `sudo dd if=output/PiNetOS-riscv64.img of=/dev/sdX bs=4M status=progress`
- **Note:** RISC‑V is experimental. Not all PiNet‑OS features (Hailo‑8L NPU, cluster management) are validated on this platform.

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

### ✅ LLM Gateway (v1.3.0)
- [ ] Navigate to **AI** → **LLM Gateway**
- [ ] Send a prompt to the on-device Ollama endpoint (default model: `llama3.2:3b`)
- [ ] Confirm NPU acceleration is active (check `/api/llm/status`)
- [ ] (Optional) Enable `PINET_LLM_FALLBACK_GEMINI=1` and verify cloud fallback

### ✅ LXC Multi‑Tenant Quotas (v1.3.0)
- [ ] Navigate to **Cluster** → **LXC Tenants**
- [ ] Create two LXC tenants with different CPU/RAM limits
- [ ] Verify cgroups v2 limits are enforced (`lxc-cgroup -n <tenant> memory.max`)
- [ ] Confirm the tenant list shows up to 16 entries

### ✅ TPM Key‑Wrap (v1.3.0)
- [ ] Enable `PINET_TPM_KEYWRAP=1` in `.env`
- [ ] Navigate to **Security** → **TPM Keys**
- [ ] Seal a CPIP master key to the TPM PCR state
- [ ] Reboot and confirm automatic unseal on startup

### ✅ CPIP PQ‑TLS (v1.3.0)
- [ ] Enable `CPIP_PQ_TLS=1` and `CPIP_PQ_HYBRID=1` in `.env`
- [ ] Verify the handshake uses hybrid ECDH + Kyber-768 (`/cpip/crypto`)
- [ ] Run a CPIP RPC call and confirm PQ key exchange in audit logs

### ✅ SSL/TLS & HSTS (v3.0.0)
- [ ] Verify SSL/TLS is enabled: `GET /api/ssl/status` shows `ssl_enabled: true`
- [ ] Generate certificates: `pinet ssl generate` or `POST /api/ssl/generate`
- [ ] Verify HTTPS is active: browser shows lock icon at `https://localhost:3000`
- [ ] Verify HSTS header: `curl -I https://localhost:3000` shows `Strict-Transport-Security`
- [ ] Verify security headers: response includes CSP, X-Frame-Options, X-Content-Type-Options
- [ ] (Optional) Install CA to system trust store: `pinet ssl install` or `POST /api/ssl/install-ca`

### ✅ Security Attestation
- [ ] Navigate to **Security** → **Attestation**
- [ ] Trigger a manual attestation check
- [ ] Confirm integrity report shows **VERIFIED** against the Minima ledger
- [ ] Verify CPIP FIPS self-tests passed (check `cpip.log` or `GET /cpip/crypto`)
- [ ] Verify CPIP ITF Defense is active (`GET /cpip/defense`)
- [ ] Test CPIP emergency key rotation (`POST /cpip/emergency {"action":"rotate_keys"}`)
- [ ] (v2.0.0) Verify formal TPM + blockchain attestation (`GET /attestation/report`)

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
| `PINET_MINIMA_RPC_PORT` | `9005` | Minima blockchain node RPC port |
| `PINET_CLUSTER_API_PORT` | `9090` | PiNet cluster manager API port |
| `PINET_NETWORK_INTERFACE` | `eth0` | Network interface to bind to |
| `GEMINI_API_KEY` | — | Google Gemini API key (AI features) |
| `PINET_LLM_GATEWAY` | `1` | Enable on-device LLM gateway (Ollama + Hailo-8L) |
| `PINET_LLM_GATEWAY_URL` | `http://127.0.0.1:11434` | Ollama API URL |
| `PINET_LLM_DEFAULT_MODEL` | `llama3.2:3b` | Default LLM model |
| `PINET_LLM_FALLBACK_GEMINI` | `1` | Fall back to Gemini cloud |
| `PINET_LXC_QUOTA` | `1` | Enable multi-tenant LXC quotas |
| `PINET_TPM_KEYWRAP` | `1` | Enable TPM 2.0 hardware key-wrap |
| `CPIP_PQ_TLS` | `0` | Enable post-quantum TLS |
| `CPIP_PQ_HYBRID` | `1` | Hybrid classical + PQ key exchange |
| `PINET_ATTESTATION` | `1` | Enable formal remote attestation |
| `PINET_SSL_ENABLED` | `1` | Enable SSL/TLS on the web server |
| `PINET_SSL_DIR` | `~/.local/share/pinet/ssl` | Certificate storage directory |
| `PINET_SSL_CERT` | _(auto)_ | Explicit server certificate path |
| `PINET_SSL_KEY` | _(auto)_ | Explicit server key path |
| `PINET_SSL_HOSTS` | `localhost,127.0.0.1,::1` | SAN hosts for server certificate |
| `PINET_MKCERT_PATH` | `mkcert` | Path to mkcert binary (falls back to openssl) |
| `PINET_HSTS_ENABLED` | `1` | Enable HSTS headers on HTTPS responses |
| `PINET_HSTS_MAX_AGE` | `31536000` | HSTS max-age in seconds (1 year) |
| `PINET_HSTS_INCLUDE_SUBDOMAINS` | `1` | Include subdomains in HSTS policy |
| `PINET_HSTS_PRELOAD` | `1` | Submit to HSTS preload list |
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
