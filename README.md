# Minima-PiNet-OS

![Made for Raspberry Pi](https://img.shields.io/badge/Made%20for-Raspberry%20Pi-C51A4A?logo=raspberry-pi&logoColor=white)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Architecture](https://img.shields.io/badge/arch-ARM64-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-3.0.0--enterprise-blueviolet)
![Security](https://img.shields.io/badge/security-Zero--Trust--Attestation-red)
![Virtualization](https://img.shields.io/badge/virt-LXC--Enterprise-blue)
![DApp Platform](https://img.shields.io/badge/DApps-Next--Gen%20%2B%20Classic-orange)

> **A modern, zero-bloat operating system made for Raspberry Pi — combining decentralized Web3 infrastructure, AI acceleration, a full DApp platform, and enterprise-grade security into a single, maker-ready platform.**

## Executive Summary

**Minima-PiNet-OS** is a specialized, lightweight Linux distribution engineered for Raspberry Pi ARM64 boards. It strips away the bloat of traditional operating systems to provide a highly optimized, zero-trust environment with a **built-in decentralized application (DApp) platform**.

Whether you're a maker building a home AI lab, a developer deploying decentralized Web3 nodes, or a hobbyist running your own MiniDapps on the edge — PiNet-OS is the foundational layer for your next big Pi project.

The DApp platform supports both **next-generation TypeScript DApps** and **classic Minima MiniDapps**, all running in a sandboxed desktop environment with a secure PostMessage bridge.

---

## The Architect

This system was conceptualized and architected by **William Majanja** — an Open Source Bio-Informaticist, Data Segmentation Specialist, and Cybersecurity Professional. Majanja's goal is to bridge the gap between advanced distributed computing and the maker movement, bringing enterprise-grade edge AI and decentralized infrastructure directly to the Raspberry Pi ecosystem.

---

## Why PiNet-OS?

### The "Minima" Philosophy
At its core, this OS adheres strictly to a **zero-bloat philosophy**. You get a bare-bones base installation, ensuring your Pi's compute, memory, and thermal resources are saved for what actually matters: your workloads. By eliminating background noise and unnecessary OS services, your Pi runs cooler and faster.

### The "PiNet" Framework
Traditional data-driven learning models often struggle on edge devices. **PiNet** (Physics-Informed Neural Networks) integration changes the game. The OS is pre-configured to support and accelerate AI architectures, making it easier to run TensorFlow Lite, ONNX models, and local LLMs directly on your Raspberry Pi without melting the CPU.

### The DApp Desktop
PiNet-OS ships with a **full graphical desktop** and an integrated **DApp Store**. Install, run, and manage decentralized applications — both modern TypeScript apps and classic Minima MiniDapps — directly from the desktop, no command line required.

---

## Core Architecture

The system operates on a perfect balance of performance, intelligence, and security:

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Enterprise Virtualization** | Kernel-level LXC isolation. | Isolated `pinet-enterprise-env` with GPU/NPU passthrough and CPU pinning. |
| **AI Acceleration Engine** | Hardware-accelerated neural processing. | Native Hailo-8L NPU support (13 TOPS) + ARM-optimized GGUF 4-bit quantization. |
| **Zero-Trust Attestation** | Blockchain-verified system integrity. | Remote attestation via Minima ledger; SHA-256 hashing of /boot and /etc/pinet. |
| **Zero-Exposure Networking** | Private WireGuard veth tunnels. | All container traffic routed through encrypted veth pairs; Host IP remains hidden. |
| **Enterprise Build System** | Pi Imager compatible .img generation. | Automated pipeline for generating flashable, hardware-verified system images. |
| **Decentralized Storage** | Distributed file system integration. | Native **IPFS** support with blockchain anchoring and node replication. |
| **Web3 & Blockchain** | Layer 1 decentralized protocol. | Embedded **Minima** blockchain node with full RPC access. |
| **DApp Platform** | Sandboxed DApp runtime. | Next-gen TypeScript DApps, React Dashboards, and classic Minima MiniDapps with PostMessage bridge. |

---

## 🧩 DApp Platform

PiNet-OS includes a fully integrated DApp platform that lets you install, run, and manage decentralized applications from the desktop. The platform supports **three categories** of DApps:

### Next-Generation DApps

#### 🔷 TypeScript DApps
Modern web applications built with TypeScript, React, Vue, or any framework of your choice.

- **Archive format:** `.zip` or `.tar.gz`
- **Execution:** Sandboxed `<iframe>` with full PostMessage bridge
- **Capabilities:** Wallet read/send, Minima RPC, Maxima P2P messaging, cluster state, system metrics, file operations, notifications
- **Build your own:** Use the [DApp SDK](docs/DAPP_SDK.md) to create a DApp from any web framework

#### 🔹 React Dashboards
External React applications loaded via URL — perfect for monitoring dashboards, analytics, or third-party tools like Grafana.

- **Entry point:** URL-based loading with full SPA routing support
- **Sandbox:** Relaxed same-origin policy for proper client-side routing
- **Use case:** Integrate any external web-based tool into the PiNet desktop

### Classic Minima MiniDapps

#### 🟡 Classic MiniDapps
Traditional Minima MiniDapps packaged in the standard `.mds.zip` format — the same format used across the Minima ecosystem.

- **Archive format:** `.mds.zip`
- **Compatibility:** Seamless integration into PiNet OS from the existing Minima MiniDapp ecosystem
- **Node access:** Direct access to the embedded Minima node for on-chain operations
- **Bridge access:** Classic MiniDapps can also use the PiNet bridge API via `window.parent.postMessage()` for enhanced features (cluster state, system metrics, notifications) beyond what standard Minima MDS provides

### DApp Comparison

| Feature | TypeScript DApps | React Dashboards | Classic MiniDapps |
| :--- | :--- | :--- | :--- |
| **Format** | `.zip` / `.tar.gz` | URL | `.mds.zip` |
| **Language** | TypeScript/JS + any framework | React | HTML/JS (Minima MDS) |
| **Sandbox** | iframe + bridge | iframe (relaxed) | iframe + bridge |
| **Wallet access** | ✅ via bridge | ❌ | ✅ via bridge + Minima |
| **Minima RPC** | ✅ via bridge | ❌ | ✅ native + bridge |
| **Maxima P2P** | ✅ via bridge | ❌ | ✅ native + bridge |
| **System metrics** | ✅ | ✅ | ✅ |
| **Cluster state** | ✅ | ✅ | ✅ |
| **File operations** | ✅ | ❌ | ✅ |
| **Notifications** | ✅ | ❌ | ✅ |

### DApp Store

The built-in **DApp Store** (accessible from the desktop taskbar) provides two ways to install DApps:

1. **Install from URL** — paste a URL to a `.zip`, `.tar.gz`, or `.mds.zip` archive
2. **Sideload** — manually enter manifest fields and a hosted URL for development/testing

Installed DApps appear as windows on the PiNet desktop, each running in its own isolated iframe.

### Example DApps (Included)

PiNet-OS ships with three example DApp templates in `PiNetOS/dapps/`:

| DApp | Description | Type |
| :--- | :--- | :--- |
| **Wallet** | Minima wallet interface for sending/receiving tokens | MiniDapp |
| **Device Identity** | Device identity and attestation manager | MiniDapp |
| **IoT Data Market** | Decentralized IoT sensor data marketplace | MiniDapp |

### DApp Bridge API

All DApps communicate with PiNet-OS through a secure **PostMessage bridge**. The bridge enforces permission-based access control — DApps can only call methods declared in their manifest.

**Available bridge methods:**

| Method | Permission | Description |
| :--- | :--- | :--- |
| `wallet.getBalance` | `wallet.read` | Get wallet balance and node status |
| `wallet.send` | `wallet.send` | Send Minima tokens |
| `minima.cmd` | `minima.rpc` | Execute Minima RPC commands |
| `maxima.getContacts` | `maxima.read` | List Maxima contacts |
| `maxima.send` | `maxima.send` | Send encrypted P2P messages |
| `cluster.getState` | `cluster.read` | Get cluster state and node info |
| `system.getStats` | `system.read` | Get CPU, RAM, temperature, network metrics |
| `files.list` | `files.read` | List directory contents |
| `files.read` | `files.read` | Read file contents |
| `notify` | `notifications` | Show desktop notification |

**Real-time events pushed to DApps:**

| Event | Description |
| :--- | :--- |
| `block` | New block mined on the Minima chain |
| `balance` | Wallet balance updated |
| `maxima.message` | Incoming Maxima P2P message |
| `cluster.update` | Cluster state changed |
| `system.stats` | System metrics updated |

> 📖 **Full SDK documentation:** See [`docs/DAPP_SDK.md`](docs/DAPP_SDK.md) for the complete developer guide, manifest reference, helper library, and code examples.

### DApp REST API

The DApp platform exposes server-side endpoints for programmatic management:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dapps` | List all installed DApps |
| `GET` | `/api/dapps/:id` | Get a single DApp record |
| `POST` | `/api/dapps/install` | Install a DApp (`{ url }` or `{ manifest, url }`) |
| `POST` | `/api/dapps/:id/uninstall` | Uninstall a DApp |
| `GET` | `/api/dapps/:id/serve/*` | Serve static files from an installed DApp |

### DApp Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                     PiNet OS Desktop                          │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────────────┐  │
│  │ Built-in  │  │   DApp    │  │      DApp Host Frame     │  │
│  │   Apps    │  │   Store   │  │  ┌────────────────────┐  │  │
│  └───────────┘  └───────────┘  │  │   Sandboxed iframe │  │  │
│                                │  │  ┌──────────────┐  │  │  │
│                                │  │  │ TypeScript   │  │  │  │
│                                │  │  │ React Dash   │  │  │  │
│                                │  │  │ MiniDapp     │  │  │  │
│                                │  │  └──────────────┘  │  │  │
│                                │  └─────────┬──────────┘  │  │
│                                │     PostMessage Bridge    │  │
│                                │  (permission-controlled)  │  │
│                                └──────────────────────────┘  │
└──────────────────────────┬────────────────────────────────────┘
                           │
                    Express Server
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐  ┌──────┴──────┐  ┌──────┴──────┐
    │ /api/dapps│  │ /api/kernel │  │ Minima RPC  │
    │ CRUD +    │  │ /api/system │  │ Maxima P2P  │
    │ Serving   │  │ /api/cluster│  │ IPFS Store  │
    └───────────┘  └─────────────┘  └─────────────┘
```

---

## PiNet 3.0 Enterprise Architecture

Transform your Raspberry Pi into a hardened, hardware-verified edge node. The PiNet 3.0 stack introduces enterprise-grade virtualization and security:

1. **Hardware Layer:** Raspberry Pi 5 (Optimized for Cortex-A76 & PCIe Gen 3).
2. **Hypervisor Layer:** LXC (Linux Containers) providing kernel-level namespace isolation.
3. **Resource Management:** `cpuset` pinning (Cores 2-3) via cgroups v2 for deterministic AI latency.
4. **AI Engine:** Hailo-8L NPU driver integration + ARM NEON/SIMD optimized GGUF inference.
5. **Security Layer:** Zero Trust Remote Attestation anchored to the Minima Blockchain.
6. **Networking:** WireGuard veth pairs for zero-exposure container communication.

### Key Enterprise Features
* **LXC Isolation:** Run your Web3 and AI workloads in a secure, isolated container while maintaining direct access to hardware accelerators (GPU/NPU).
* **Remote Attestation:** The system automatically hashes critical firmware and configuration paths, attesting them against the immutable Minima ledger to detect unauthorized tampering.
* **Deterministic AI Performance:** By pinning AI workloads to specific CPU cores and using dedicated NPU hardware, PiNet 3.0 eliminates context-switching jitter.
* **Enterprise Imager Utility:** A built-in portal to build, verify, and release flashable `.img` artifacts that are 100% compatible with the official Raspberry Pi Imager.
* **Remote Orchestration via rpi-connect:** Manage your cluster nodes, perform hypervisor context switching, and execute commands securely from anywhere using Raspberry Pi Connect integration.

---

## Hardware Requirements

Tailored specifically for modern ARM-based Raspberry Pi boards.

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Platform** | Raspberry Pi 4 Model B (4GB) | **Raspberry Pi 5 (8GB)** |
| **AI Accelerator** | ARM NEON (CPU) | **Hailo-8L NPU (13 TOPS)** |
| **Architecture** | ARM64 (aarch64) | ARM64 (aarch64) |
| **Storage** | 16GB High-Endurance MicroSD | 128GB NVMe SSD (via PCIe Gen 3) |
| **Network** | Gigabit Ethernet or Wi-Fi | Gigabit Ethernet + WireGuard Mesh |

---

## Installation & Provisioning

### 🚀 Quick Start (Recommended)
1.  **Download:** Get the latest `PiNetOS-Enterprise.img` from the [Releases](https://github.com/WilliamMajanja/Minima-PiNet-Os/releases) page.
2.  **Flash:** Open the **Official Raspberry Pi Imager**, select "Use custom", and choose the downloaded `.img` file.
3.  **Boot:** Insert the MicroSD/NVMe into your Pi 5 and power it on. The system will automatically perform a Zero-Trust integrity check on first boot.

### 💻 Local Testing & Development
To run and test the PiNetOS interface locally on your development machine:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/WilliamMajanja/Minima-PiNet-Os.git
   cd Minima-PiNet-Os
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start the development server:**
   ```bash
   npm run dev
   ```
   This will start the backend API and the Vite development server.
4. **Access the interface:**
   Open your browser and navigate to `http://localhost:3000`.
5. **Test Electron Desktop App (Optional):**
   ```bash
   npm run electron:dev
   ```

### 📦 Installing Your First DApp
Once PiNet-OS is running:

1. Open the **DApp Store** from the desktop taskbar.
2. Enter a URL to a `.zip`, `.tar.gz`, or `.mds.zip` archive.
3. Click **Install** — the DApp appears on your desktop and is ready to use.

Or sideload a DApp for development by entering the manifest details and a hosted URL.

### 🛠️ Advanced: Custom Enterprise Build
If you need a custom build with specific cluster secrets:
1.  Open the **Pi Imager Portal** in your PiNet Dashboard.
2.  Click **Execute Enterprise Build** to generate a hardware-verified image.
3.  Flash the resulting file using the Raspberry Pi Imager.

### 🔁 Real OS Switching Between Your Host OS and PiNet
The desktop hypervisor switch now supports a real local boot-profile handoff instead of only restarting services. On Raspberry Pi systems with a writable `/boot` or `/boot/firmware` partition, PiNet will:

1. Snapshot the current host boot profile the first time you switch into PiNet.
2. Stage the PiNet boot profile onto the shared boot partition.
3. Schedule a reboot so the board comes back in the requested OS context.

For dual-root installs, set `PINET_SWITCH_PINET_ROOT` to the PiNet root partition before starting the server, for example:

```bash
export PINET_SWITCH_PINET_ROOT=/dev/mmcblk0p3
npm run dev
```

If PiNet uses a dedicated boot asset directory, point `PINET_SWITCH_PINET_PROFILE_DIR` at that directory.
To return to your original OS from PiNet, the switcher restores the saved host boot snapshot from `/boot/pinet-switch/host-profile` (or `/boot/firmware/pinet-switch/host-profile`).

---

## Awesome Raspberry Pi Use Cases

**Minima-PiNet-OS** is purpose-built for taking your Pi projects to the next level:

*   🤖 **Personal Edge AI Node:**
    Run local LLMs, image recognition, or voice assistants without relying on cloud APIs. The minimal OS overhead ensures your Pi's RAM is dedicated entirely to your AI models.
*   🌐 **Decentralized Home Automation:**
    Use the integrated k3s (lightweight Kubernetes) to deploy Home Assistant, Node-RED, and IoT sensor aggregators in a secure, containerized environment.
*   ⛓️ **Personal Web3 & Crypto Node:**
    Run a full Minima blockchain node natively. Participate in decentralized networks, host your own wallet, and anchor your data to the blockchain using the built-in IPFS integration.
*   🖥️ **Pi Cluster Computing:**
    Have a stack of Raspberry Pis? Use the PiNet Cluster Manager to link them together via WireGuard mesh networking, creating your own mini supercomputer.
*   🧩 **DApp Development & Hosting:**
    Build and deploy your own decentralized applications — from TypeScript web apps to classic Minima MiniDapps. Use the DApp Store to install community DApps, or sideload your own during development. Every DApp runs in a sandboxed iframe with access to wallet operations, Minima RPC, Maxima P2P messaging, and system metrics.
*   📊 **Edge Analytics Dashboards:**
    Load React-based monitoring dashboards directly into the PiNet desktop. Connect Grafana, custom analytics tools, or any URL-based web application as a dashboard DApp.

---

## Project Structure

```
Minima-PiNet-Os/
├── App.tsx                    # Desktop shell with window management
├── Taskbar.tsx                # Desktop taskbar with DApp integration
├── server.ts                  # Express backend (API, DApp serving, Minima RPC)
├── components/
│   └── apps/
│       ├── DAppStoreApp.tsx   # DApp Store UI — browse, install, manage
│       └── DAppHostFrame.tsx  # Sandboxed iframe renderer for DApps
├── services/
│   ├── dappService.ts         # DApp state management (install, list, uninstall)
│   ├── dappBridge.ts          # PostMessage bridge (permission-controlled)
│   ├── networkService.ts      # Network management
│   ├── syslogService.ts       # System logging
│   └── ...                    # Additional OS services
├── types/
│   ├── dapp.ts                # DApp types: DAppManifest, DAppKind, Bridge API
│   ├── kernel.ts              # Kernel types
│   └── security.ts            # Security types
├── kernel/                    # OS kernel subsystems
├── config/
│   └── defaults.ts            # Central configuration (ports, limits, versions)
├── docs/
│   └── DAPP_SDK.md            # Full DApp developer SDK guide
├── PiNetOS/
│   └── dapps/                 # Example DApp templates
│       ├── wallet/            # Minima wallet MiniDapp
│       ├── device-identity/   # Device identity manager
│       └── iot-data-market/   # IoT data marketplace
├── bin/                       # POSIX shell CLI tools
├── lib/                       # Shell library functions
├── hal/                       # Hardware abstraction layer
├── boot/                      # Boot configuration
└── electron/                  # Electron desktop wrapper
```

---

## Contribution Guidelines

We welcome contributions from makers, AI researchers, systems engineers, DApp developers, and open-source enthusiasts!

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/cool-new-idea`).
3. Commit your changes (`git commit -m 'Add support for new Pi HAT'`).
4. Push to the branch (`git push origin feature/cool-new-idea`).
5. Open a Pull Request!

### Contributing DApps

Want to contribute a DApp to the PiNet ecosystem?

1. Follow the [DApp SDK guide](docs/DAPP_SDK.md) to create your DApp.
2. Add a `dapp.json` manifest with a unique ID (e.g. `com.yourname.my-dapp`).
3. Test it locally using the DApp Store **sideload** feature.
4. Submit a PR with your DApp template in `PiNetOS/dapps/`.

Please ensure all code adheres to the zero-bloat philosophy. Let's keep the Pi fast and efficient!

## License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.

---
*Empowering the Raspberry Pi Community with Next-Gen DApps & Classic MiniDapps. Architected by William Majanja.*
