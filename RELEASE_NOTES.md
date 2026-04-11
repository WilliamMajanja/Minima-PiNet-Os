# Minima-PiNet-OS v3.0.0 — Version 3

> **Version 3 Stable Release** — A hardened, feature-complete release of the PiNet 3.0 Enterprise Stack with all stable changes applied.

We are proud to announce **Minima-PiNet-OS v3.0.0**, a major release delivering significant security hardening, a full-featured desktop OS experience, a next-generation DApp platform, and comprehensive dependency updates — all built on the solid foundation of PiNet 2.0.

---

## What's New in v3.0.0

### 🛡️ Security Hardening
- **Command Injection Prevention** — Resolved all CodeQL code scanning alerts including uncontrolled command line vulnerabilities across `server.ts`, HAL modules, and OTA scripts.
- **Rate Limiting on All Endpoints** — Added per-IP rate limiting to system command endpoints, authentication routes, DApp API endpoints, file system routes, and security/integrity endpoints.
- **Input Validation Hardening** — Stronger allowlist-based input validation with regex patterns; replaced `exec()`/`execSync()` with `execFile()`/`execFileSync()` across all child process calls.
- **Path Traversal Protection** — Fixed path traversal vulnerabilities and normalized `FILES_ROOT` for secure file system operations.
- **CORS Improvements** — Improved CORS configuration with better documentation and security defaults.

### 🖥️ Full Desktop OS Experience
- **Kernel Subsystems** — Added process manager, memory manager, scheduler, init system, and syscalls layer (`kernel/` directory).
- **Core OS Services** — Singleton-pattern services with `subscribe()` observer: syslog, user management, IPC, device manager, security, network, and power services.
- **7 Desktop Management Apps** — New system management applications integrated into the desktop: system monitor, file manager, terminal, user admin, network config, device manager, and security center.
- **Window Management** — Full drag, resize, maximize, and cascading window position support with per-window state tracking.
- **Real PTY Terminal** — Replaced simulated terminal with real PTY support via `node-pty` with WebSocket resize signaling.
- **Real System Data** — Replaced simulated data with live system stats, uptime, Minima node status, contacts, and subnet scan.
- **Refined Taskbar** — Taskbar now shows only open windows; TopBar OS switcher updated for all modes.

### 📱 Next-Generation DApp Platform
- **TypeScript DApp Interface** — Full DApp interface system supporting three kinds: `typescript`, `react-dashboard`, and `minidapp`.
- **DApp Store** — Built-in DApp discovery and installation via `DAppStoreApp.tsx`.
- **DApp Host Frame** — Sandboxed DApp runtime with secure bridge API for OS integration (`DAppHostFrame.tsx`, `dappBridge.ts`).
- **DApp API Endpoints** — Server-side DApp management endpoints under `/api/dapps` with rate limiting.
- **Dynamic AppId System** — Template literal type `dapp:${string}` with `isDAppId()` and `extractDAppId()` helpers for type-safe DApp identification.

### 🔧 OS API & Architecture
- **Comprehensive API Layer** — New API endpoints prefixed under `/api/kernel/`, `/api/syslog`, `/api/users`, `/api/ipc`, `/api/devices`, `/api/security`, `/api/network`, `/api/power`, and `/api/auth`.
- **Boot Profile Switching** — OS hypervisor context switching with hardened boot-profile switch scripts.
- **Maxima Cluster Control Plane** — Decentralized cluster coordination using Minima's encrypted P2P Maxima bus — no central API server required.

### 📦 Dependency Updates
- **Electron** — Bumped from 30.5.1 to 35.7.5.
- **Vite & esbuild** — Updated to latest stable versions.
- **brace-expansion** — Bumped from 2.0.2 to 2.0.3.
- **path-to-regexp** — Bumped from 8.3.0 to 8.4.0.
- **tar & electron-builder** — Updated to latest stable versions.
- **google.golang.org/protobuf** — Bumped to 1.33.0 (Go modules).
- **github.com/quic-go/quic-go** — Bumped to 0.57.0 (Go modules).
- **golang.org/x/net** — Bumped from 0.21.0 to 0.38.0 (Go modules).

### 📖 Documentation
- **README Rewrite** — Comprehensive documentation covering next-gen DApps and classic Minima MiniDapps platform.
- **Deployment Guide** — Updated for v3.0.0 with current instructions.
- **Policy Updates** — Updated project policies to reflect PiNet 3.0 standards.

---

## All v2.0.0 Features (Included)

### 🔒 Zero-Trust Security Architecture
- **Blockchain Remote Attestation** — System integrity hashes verified against the immutable Minima ledger on every boot.
- **LUKS Full-Disk Encryption** — Root and data partitions encrypted at rest with TPM 2.0 key sealing.
- **WireGuard Zero-Exposure Networking** — All container traffic routed through encrypted veth pairs.
- **Brute-Force Mitigation** — `fail2ban` permanently bans IPs after repeated SSH failures.

### 🤖 Edge AI Acceleration Engine
- **Hailo-8L NPU Support** — Native 13 TOPS neural processing for local LLM inference and real-time computer vision.
- **ARM NEON/SIMD Optimised Inference** — GGUF 4-bit quantised model fallback on Raspberry Pi 4.
- **Deterministic AI Performance** — `cpuset` pinning (Cores 2–3) via cgroups v2 for jitter-free AI workloads.

### 🌐 Web3 & Decentralised Infrastructure
- **Embedded Minima Blockchain Node** — Full L1 node for on-device transaction signing, DApp hosting, and network participation.
- **MiniDAPP Runtime** — Sandboxed decentralised application runtime for edge Web3 apps.
- **IPFS Storage Integration** — Blockchain-anchored tamper-evident distributed file storage.

### 🖥️ Enterprise Virtualisation
- **LXC Hypervisor** — Kernel-level isolation with GPU/NPU hardware passthrough.
- **PiNet Cluster Manager (Go)** — Multi-node cluster orchestration, node discovery, and health monitoring.
- **k3s Lightweight Kubernetes** — Pre-configured for containerised cluster workloads.
- **rpi-connect Remote Management** — Secure remote cluster management via Raspberry Pi Connect.

### ⚙️ Build & Deployment System
- **Enterprise Build Pipeline** — Automated image generation with SHA-256 hardware verification.
- **PXE Network Boot Support** — Zero-touch provisioning over network with DHCP/TFTP.
- **Automated OTA Updates** — A/B partition rolling updates with automatic rollback.

---

## Release Artifacts

| File | Description |
| :--- | :--- |
| `Minima-PiNet-Os-v3.0.0.zip` | Full source archive (ZIP) |
| `Minima-PiNet-Os-v3.0.0.tar.gz` | Full source archive (TAR.GZ) |
| `PiNetOS-RaspberryPi.img` | Flashable Raspberry Pi OS image |
| `PiNetOS-RaspberryPi-Package-v3.0.0.zip` | Image package with flashing instructions and checksums |
| `PiNetOS-Enterprise.zip` | Enterprise cluster management stack |
| `PiNetOS-Electron-Desktop.zip` | Cross-platform desktop client source |
| `PiNetOS-Build-System.zip` | Build pipeline and imager utilities |
| `PiNetOS-Documentation.zip` | Full documentation archive |
| `PiNetOS-K3s-Manifests.zip` | K3s/Kubernetes manifests for full cluster deployment |
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
| Platform | Raspberry Pi 4 (4 GB) | **Raspberry Pi 5 (16 GB)** |
| AI Accelerator | ARM NEON (CPU) | **Hailo-8L NPU (13 TOPS)** |
| Storage | 16 GB MicroSD | 128 GB NVMe SSD (PCIe Gen 3) |
| Network | Gigabit Ethernet | Gigabit Ethernet + WireGuard mesh |

---

## Upgrading from v2.0.0

1. Back up your existing configuration: `sudo cp -r /etc/pinet /etc/pinet.bak`
2. Flash the new v3.0.0 image or apply OTA update via the web dashboard.
3. Your DApps and user data will be preserved during the upgrade.
4. Review the new security settings in the Security Center app.

---

## Security

All release artifacts are accompanied by `SHA256SUMS.txt`. Verify integrity before flashing:

```bash
sha256sum --check SHA256SUMS.txt
```

Vulnerability reports: email `WilliamMajanja@gmail.com`. See [SECURITY.md](SECURITY.md) for the full disclosure policy.

---

*Minima-PiNet-OS is MIT licensed. Architected by William Majanja.*
