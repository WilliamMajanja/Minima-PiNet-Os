# Minima-PiNet-OS v2.0.0 — Enterprise Release

> **Investor & Enterprise Preview** — The first production-ready release of the PiNet 2.0 Enterprise Stack.

We are proud to announce **Minima-PiNet-OS v2.0.0**, a major milestone delivering a hardened, Web3-native operating system purpose-built for Raspberry Pi 5. This release brings together blockchain-backed security, edge AI acceleration, and enterprise virtualization into a single flashable image.

---

## What's New in v2.0.0

### 🔒 Zero-Trust Security Architecture
- **Blockchain Remote Attestation** — System integrity hashes are verified against the immutable Minima ledger on every boot. Any unauthorized firmware or configuration tampering triggers an automatic lockdown.
- **LUKS Full-Disk Encryption** — Root and data partitions are encrypted at rest with hardware-backed key sealing via TPM 2.0.
- **WireGuard Zero-Exposure Networking** — All container traffic is routed through encrypted veth pairs; the host IP is never exposed to external networks.
- **Brute-Force Mitigation** — `fail2ban` permanently bans IPs (`bantime = -1`) after repeated SSH authentication failures.

### 🤖 Edge AI Acceleration Engine
- **Hailo-8L NPU Support** — Native driver integration for 13 TOPS neural processing, enabling local LLM inference and real-time computer vision on the Pi 5.
- **ARM NEON/SIMD Optimised Inference** — GGUF 4-bit quantised model execution falls back gracefully to ARM NEON on Raspberry Pi 4.
- **Deterministic AI Performance** — `cpuset` pinning (Cores 2–3) via cgroups v2 eliminates context-switching jitter for production AI workloads.

### 🌐 Web3 & Decentralised Infrastructure
- **Embedded Minima Blockchain Node** — A full Layer 1 Minima node ships inside the OS, enabling on-device transaction signing, DApp hosting, and network participation.
- **MiniDAPP Runtime** — A sandboxed decentralised application runtime for deploying Web3 applications directly on the edge.
- **IPFS Storage Integration** — Native IPFS support with blockchain anchoring for tamper-evident distributed file storage.
- **Maxima P2P Cluster Bus** — Encrypted, peer-to-peer cluster control plane using Minima's Maxima protocol — no central API server required.

### 🖥️ Enterprise Virtualisation
- **LXC Hypervisor** — Kernel-level LXC isolation with GPU/NPU hardware passthrough for containerised enterprise workloads.
- **PiNet Cluster Manager (Go)** — A high-performance daemon for multi-node cluster orchestration, node discovery, and health monitoring.
- **k3s Lightweight Kubernetes** — Pre-configured k3s for running containerised workloads across Pi clusters.
- **rpi-connect Remote Management** — Secure, remote cluster management from anywhere via Raspberry Pi Connect.

### 🖱️ Web Desktop & Developer Experience
- **React Web Desktop** — A full-featured, responsive browser-based desktop interface with terminal, system monitor, file manager, and cluster dashboard.
- **Electron Desktop App** — A native cross-platform desktop client (Linux AppImage, Windows NSIS, macOS DMG) for local development and testing.
- **In-Browser Terminal (xterm.js)** — A fully functional shell terminal embedded in the web UI with WebSocket backend.
- **Real-Time System Monitor** — Live CPU, RAM, temperature, and network metrics powered by `systeminformation` and Recharts.
- **Pi Imager Enterprise Portal** — A built-in UI portal for generating, verifying, and downloading hardware-verified `.img` artifacts compatible with the official Raspberry Pi Imager.

### ⚙️ Build & Deployment System
- **Enterprise Build Pipeline** — Automated image generation with SHA-256 hardware verification and Pi Imager compatibility.
- **PXE Network Boot Support** — Zero-touch provisioning for cluster deployments over network with DHCP/TFTP.
- **Automated OTA Updates** — A/B partition rolling updates with automatic rollback on failure.

---

## Release Artifacts

| File | Description |
| :--- | :--- |
| `Minima-PiNet-Os-v2.0.0.zip` | Full source archive (ZIP) |
| `Minima-PiNet-Os-v2.0.0.tar.gz` | Full source archive (TAR.GZ) |
| `PiNetOS-RaspberryPi.img` | Flashable Raspberry Pi OS image |
| `PiNetOS-Enterprise.zip` | Enterprise cluster management stack |
| `PiNetOS-Electron-Desktop.zip` | Cross-platform desktop client source |
| `PiNetOS-Build-System.zip` | Build pipeline and imager utilities |
| `PiNetOS-Documentation.zip` | Full documentation archive |
| `SHA256SUMS.txt` | Cryptographic checksums for all artifacts |

---

## Quick Start

1. **Flash:** Download `PiNetOS-RaspberryPi.img` and flash it with [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. **Boot:** Insert into your Pi 5, power on, and wait ~2 minutes for first-boot provisioning.
3. **Access:** Navigate to `http://<pi-ip>:3000` in your browser.
4. **Default credentials:** `pinet` / `pinet` — change immediately with `passwd`.

For full setup instructions, see [docs/INSTALL.md](docs/INSTALL.md).

---

## Hardware Requirements

| Component | Minimum | Recommended |
| :--- | :--- | :--- |
| Platform | Raspberry Pi 4 (4 GB) | **Raspberry Pi 5 (8 GB)** |
| AI Accelerator | ARM NEON (CPU) | **Hailo-8L NPU (13 TOPS)** |
| Storage | 16 GB MicroSD | 128 GB NVMe SSD (PCIe Gen 3) |
| Network | Gigabit Ethernet | Gigabit Ethernet + WireGuard mesh |

---

## Security

All release artifacts are accompanied by `SHA256SUMS.txt`. Verify integrity before flashing:

```bash
sha256sum --check SHA256SUMS.txt
```

Vulnerability reports: email `WilliamMajanja@gmail.com`. See [SECURITY.md](SECURITY.md) for the full disclosure policy.

---

*Minima-PiNet-OS is MIT licensed. Architected by William Majanja.*
