# Minima-PiNet-OS v3.0.0

<!-- Release: v3.0.0 | Tagged: 2026-10-24 -->

> **Version 3.0.0 Release** — Confidential computing enclaves, verifiable compute proofs (zkVM), decentralized edge compute marketplace.

## Highlights

### v3.0.0 Features

- **Confidential Computing Enclaves** — Arm CCA and RISC-V AP-TEE hardware-backed enclaves. Enclave lifecycle management (create, stop, terminate), cryptographic measurement generation, and TEE-signed attestation anchored to the Minima blockchain. API at `/api/enclaves/*`.
- **Verifiable Compute Proofs (zkVM)** — RISC Zero zkVM integration for generating and verifying zero-knowledge proofs. STARK → SNARK proof compression with on-chain verification. API at `/api/zk/proofs/*`. Build toolchain at `build-system/build-zk-prover.sh`.
- **Decentralized Edge Compute Marketplace** — Peer-to-peer marketplace for publishing and leasing edge compute resources. Minima escrow for order settlement, attestation binding for trust, five-star reputation system with on-chain anchoring. API at `/api/marketplace/*`. K3s manifests at `k3s/marketplace.yaml`.
- **SSL/TLS with mkcert** — Production-grade TLS termination via mkcert (local CA) or OpenSSL (self-signed fallback). Certificates auto-generated on first boot with SANs for localhost, 127.0.0.1, and ::1. HSTS headers (max-age=31536000, includeSubDomains, preload) on all HTTPS responses. 11 security headers (CSP, Permissions-Policy, X-Frame-Options, etc.) on every response. API at `/api/ssl/*`. CLI: `pinet ssl`.

## New Desktop Apps

- **Enclaves** (`enclaves`) — Create and manage confidential computing enclaves
- **ZK Prover** (`zk-prover`) — Generate and verify zero-knowledge proofs
- **Marketplace** (`marketplace`) — Publish and lease edge compute resources
- **SSL/TLS Manager** (`ssl-manager`) — Manage certificates, HSTS, and security headers

## New API Endpoints

| Prefix | Count | Description |
|---|---|---|
| `/api/enclaves/*` | 8 | Enclave CRUD, measurement, attestation |
| `/api/zk/proofs/*` | 5 | Proof generation, verification, listing |
| `/api/marketplace/*` | 12 | Listings, orders, ratings |
| `/api/ssl/*` | 5 | SSL/TLS cert status, generate, delete, install CA, download |

## New Configuration

See `.env.example` for full reference:

- `PINET_ENCLAVE=1` — Enable confidential computing enclaves
- `PINET_ENCLAVE_TEE_TYPE=auto` — TEE type (cca, riscv-tee, auto)
- `PINET_ZK_PROVER=1` — Enable zkVM prover
- `PINET_MARKETPLACE=1` — Enable decentralized marketplace
- `PINET_MARKETPLACE_MAX_LISTINGS=100` — Max listings per node
- `PINET_MARKETPLACE_ESCROW_TOKENS=minima` — Escrow token
- `PINET_SSL_ENABLED=1` — Enable SSL/TLS on the web server
- `PINET_SSL_HOSTS=localhost,127.0.0.1,::1` — SAN hosts for server certificate
- `PINET_HSTS_ENABLED=1` — Enable HSTS headers on HTTPS responses
- `PINET_HSTS_MAX_AGE=31536000` — HSTS max-age in seconds (1 year)

## How to publish

```bash
git tag v3.0.0
git push origin v3.0.0
```

---

# Minima-PiNet-OS v1.3.0

<!-- Release: v1.3.0 | Tagged: 2026-10-15 -->

> **Version 1.3.0 Release** — On-device LLM gateway, multi-tenant LXC quotas, hardware key-wrap (TPM 2.0), and CPIP post-quantum TLS.

## Highlights

### v1.3.0 Features

- **On-Device LLM Gateway** — Local LLM inference via Ollama (llama.cpp/GGUF) with Hailo-8L NPU acceleration detection. OpenAI-compatible API at `/api/llm/*` with automatic fallback to Gemini cloud when no local model is loaded. Model registry supports pull/delete operations.
- **Multi-Tenant LXC Quotas** — Per-tenant resource quotas for LXC containers via cgroups v2 (CPU, RAM, disk, IO, processes, network). Up to 16 tenants per node with configurable limits. API at `/api/lxc/*`.
- **Hardware Key-Wrap (TPM 2.0)** — CPIP master keys sealed against TPM 2.0 PCR values, ensuring keys can only be unsealed on the same hardware with the same boot state. Software fallback for non-TPM hosts. API at `/api/tpm/*`.
- **CPIP PQ-TLS** — Post-quantum TLS for CPIP RPC transport using hybrid ECDH P-256 + Kyber-768 (ML-KEM-768) key exchange. HKDF-SHA256 session key derivation. Graceful degradation to classical TLS when Kyber library is unavailable. API at `/api/cpip/pq-tls/*`.

### v2.0.0 Features

- **RISC-V Reference Board** — Device tree and kernel config for StarFive VisionFive 2 (JH7110, SiFive U74). Cross-build script at `build-system/build-riscv.sh`. Boot config at `boot/riscv/uEnv.txt`.
- **Deterministic Image Rebuilds** — Reproducible rootfs builds via `build-system/reproducible-build.sh` with pinned package versions (`build-system/packages.lock`) and `SOURCE_DATE_EPOCH` normalization.
- **Formal Attestation Spec** — TPM 2.0 PCR-based remote attestation anchored to the Minima blockchain. Full spec at `docs/ATTESTATION_SPEC.md`. API at `/api/attestation/*`.

## New Desktop Apps

- **LLM Gateway** (`llm-gateway`) — Chat with local LLM models
- **LXC Quotas** (`lxc-quotas`) — Manage tenant resource limits
- **Attestation** (`attestation`) — Create and verify attestation records

## New API Endpoints

| Prefix | Count | Description |
|---|---|---|
| `/api/llm/*` | 5 | LLM gateway (status, models, chat, pull, delete) |
| `/api/lxc/*` | 8 | LXC tenant quota management |
| `/api/tpm/*` | 4 | TPM key-wrap (status, seal, unseal, PCRs) |
| `/api/cpip/pq-tls/*` | 3 | PQ-TLS status, handshake, keypair |
| `/api/attestation/*` | 6 | Formal attestation CRUD + verify + anchor |

## Configuration

New environment variables (see `.env.example` for full list):

- `PINET_LLM_GATEWAY=1` — Enable on-device LLM gateway
- `PINET_LXC_QUOTA=1` — Enable multi-tenant LXC quotas
- `PINET_TPM_KEYWRAP=1` — Enable TPM 2.0 hardware key-wrap
- `CPIP_PQ_TLS=0` — Enable post-quantum TLS (opt-in)
- `PINET_ATTESTATION=1` — Enable formal remote attestation

## How to publish

```bash
git tag v1.3.0
git push origin v1.3.0
```

---

# Minima-PiNet-OS v1.2.0

<!-- Release: v1.2.0 | Tagged: 2026-04-23 -->

> **Version 1.2.0 Release** — Maintenance release that re-cuts the Raspberry Pi flashable image with the latest fixes on top of the v1.1.0 baseline.

This release republishes the full Raspberry Pi 5 image (`PiNetOS-RaspberryPi.img`) and source archives so users can flash a fresh build that inherits all v1.1.0 security hardening, the FastAPI desktop, the DApp platform, and the K3s cluster manifests.

## Stable Release Test Addendum

- **RMPE-2 provenance** — Release jobs now generate `RMPE-2-PROVENANCE.json`, publish its checksum, and attach a build-provenance attestation for production release verification.
- **Hash-chained runtime audit trail** — Cluster and provenance APIs now emit canonical RMPE-2 records with `provenanceId`, `rmpeHash`, and `previousHash` fields.
- **Production validation checklist** — `docs/PRODUCTION_RELEASE_TEST.md` defines the artifact, Kubernetes control-plane, cluster orchestration, provenance, and safety gates for a stable production test.

## Highlights

- **Refreshed Raspberry Pi disk image** — Re-built 256 MB flashable image (64 MB FAT32 boot + 192 MB ext4 rootfs) via `scripts/create-release-img.sh`, packaged with `scripts/package-img-release.js`.
- **Version metadata bump** — `package.json`, `backend/config.py` (`PINET_VERSION`), `pinet-config.json` (`default_image: pinetos-v1.2.0-aarch64`), `pinet-state.json`, and the documentation set updated to 1.2.0.
- **Security baseline preserved** — Inherits zero-open-CodeQL-alerts state from v1.1.0; CodeQL continues to run on every push.
- **Same release artifact set** — `PiNetOS-RaspberryPi.img`, `PiNetOS-RaspberryPi-Package-v1.2.0.zip`, `PiNetOS-Enterprise.zip`, `PiNetOS-Build-System.zip`, `PiNetOS-Documentation.zip`, `PiNetOS-K3s-Manifests.zip`, source archives, and `SHA256SUMS.txt`.

## How to publish

The `Create Release` workflow (`.github/workflows/release.yml`) builds and uploads all artifacts when a `v*` tag is pushed (or via `workflow_dispatch`):

```bash
git tag v1.2.0
git push origin v1.2.0
```

See the v1.1.0 notes below for the full feature set carried forward.

---

# Minima-PiNet-OS v1.1.0

<!-- Release: v1.1.0 | Tagged: 2026-04-17 -->

> **Version 1.1.0 Release** — A stable, feature-complete release of the PiNet Enterprise Stack with security hardening, desktop OS experience, DApp platform, and Raspberry Pi image generation.

We are proud to announce **Minima-PiNet-OS v1.1.0**, delivering significant security hardening, a full-featured desktop OS experience, a next-generation DApp platform, and comprehensive dependency updates.

---

## What's New in v1.1.0

### 🛡️ Security Hardening
- **Command Injection Prevention** — Resolved all CodeQL code scanning alerts including uncontrolled command line vulnerabilities across `server.ts`, HAL modules, and OTA scripts.
- **Rate Limiting on All Endpoints** — Added per-IP rate limiting to system command endpoints, authentication routes, DApp API endpoints, file system routes, and security/integrity endpoints.
- **Input Validation Hardening** — Stronger allowlist-based input validation with regex patterns; replaced `exec()`/`execSync()` with `execFile()`/`execFileSync()` across all child process calls.
- **Path Traversal Protection** — Fixed path traversal vulnerabilities and normalized `FILES_ROOT` for secure file system operations.
- **CORS Improvements** — Improved CORS configuration with better documentation and security defaults.

### 🖥️ Full Desktop OS Experience
- **Kernel Subsystems** — Process manager, memory manager, scheduler, init system, and syscalls layer (`kernel/` directory).
- **Core OS Services** — Singleton-pattern services with `subscribe()` observer: syslog, user management, IPC, device manager, security, network, and power services.
- **7 Desktop Management Apps** — System monitor, file manager, terminal, user admin, network config, device manager, and security center.
- **Window Management** — Full drag, resize, maximize, and cascading window position support with per-window state tracking.
- **Real PTY Terminal** — Real PTY support via Python's `pty` + `asyncio` with WebSocket resize signaling.
- **Real System Data** — Live system stats, uptime, Minima node status, contacts, and subnet scan.
- **Refined Taskbar** — Taskbar now shows only open windows; TopBar OS switcher updated for all modes.

### 📱 Next-Generation DApp Platform
- **Static / TypeScript DApp Interface** — DApp interface system supporting three kinds: `typescript` (sandboxed static web app), `python-dashboard` (server-rendered Jinja2 dashboard), and `minidapp` (classic Minima MiniDapp).
- **DApp Store** — Built-in DApp discovery and installation served by the FastAPI `/api/dapps` endpoints.
- **DApp Host Frame** — Sandboxed DApp runtime with secure bridge API for OS integration.
- **DApp API Endpoints** — Server-side DApp management endpoints under `/api/dapps` with rate limiting.
- **Dynamic AppId System** — Template literal type `dapp:${string}` with `isDAppId()` and `extractDAppId()` helpers for type-safe DApp identification.

### 🔧 OS API & Architecture
- **Comprehensive API Layer** — New API endpoints prefixed under `/api/kernel/`, `/api/syslog`, `/api/users`, `/api/ipc`, `/api/devices`, `/api/security`, `/api/network`, `/api/power`, and `/api/auth`.
- **Boot Profile Switching** — OS hypervisor context switching with hardened boot-profile switch scripts.
- **Maxima Cluster Control Plane** — Decentralized cluster coordination using Minima's encrypted P2P Maxima bus — no central API server required.
- **Raspberry Pi Disk Image** — Automated 256 MB flashable image generation (64 MB FAT32 boot + 192 MB ext4 rootfs) with first-boot provisioning.
- **K3s Cluster Manifests** — Kubernetes manifests for full multi-node cluster deployment.

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
| `Minima-PiNet-Os-v1.1.0.zip` | Full source archive (ZIP) |
| `Minima-PiNet-Os-v1.1.0.tar.gz` | Full source archive (TAR.GZ) |
| `PiNetOS-RaspberryPi.img` | Flashable Raspberry Pi OS image |
| `PiNetOS-RaspberryPi-Package-v1.1.0.zip` | Image package with flashing instructions and checksums |
| `PiNetOS-Enterprise.zip` | Enterprise cluster management stack |
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

## Security

All release artifacts are accompanied by `SHA256SUMS.txt`. Verify integrity before flashing:

```bash
sha256sum --check SHA256SUMS.txt
```

**CPIP Security Provider (The Coffee Protocol v5.0.5):** This release integrates CPIP as the primary security provider for all Minima nodes. Key additions:
- CoffeeCipher v5 (AES-256-GCM + HKDF-SHA256) for data at rest and RPC payload encryption
- ECDSA/ECDH P-256 (FIPS 186-4) for node identity and challenge-response authentication
- RSA-KEM-2048 (SP 800-56B) for key encapsulation; optional 1nf1D3L Kyber (non-FIPS ML-KEM-768) for PQ hybrid
- HMAC-SHA256 RPC token authentication replacing Basic Auth
- ITF Defense: probe blocking (HTTP 418), pentest tool detection, IP blacklisting
- Anti-ISP, Anti-Stingray, Anti-Surveillance, Net-Neutrality defense policy groups
- FIPS 140-2/3 power-on self-tests (`CPIP_FIPS=1`)
- CPIP sidecar container in k3s DaemonSet + dedicated `cpip.service` systemd unit
- Emergency mode: key rotation, secure wipe, peer notification

Vulnerability reports: email `WilliamMajanja@gmail.com`. See [SECURITY.md](SECURITY.md) for the full disclosure policy.

---

*Minima-PiNet-OS is MIT licensed. Architected by William Majanja.*
