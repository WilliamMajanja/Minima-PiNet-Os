# Architecture

Minima PiNet OS uses a **two-layer architecture** combining a Linux runtime layer with a browser-based desktop control plane.

---

## System Layers

### Layer 1: PiNet-OS Runtime (Linux)

A lightweight environment that spawns on any Linux distro running on Raspberry Pi 5:

| Component | Description |
|---|---|
| **CLI Launcher** (`bin/pinet`) | Single POSIX shell script for full lifecycle management |
| **Minima Node** | Blockchain node providing identity, trust, and Maxima P2P bus |
| **Go Cluster Manager** | Handles heartbeats, node health, workload execution, and metrics |
| **Systemd Services** | Production deployment as managed system services |

### Layer 2: Browser Desktop (React/TypeScript)

A visual control plane served locally from the Pi:

| Component | Description |
|---|---|
| **Express.js Backend** (`server.ts`) | API server, WebSocket terminal, cluster endpoints |
| **React SPA** | Desktop UI with 21 built-in applications |
| **Real-time Updates** | WebSocket channels for cluster events and terminal I/O |

---

## Technology Stack

| Component | Technology |
|---|---|
| Blockchain | Minima (Java) |
| P2P Messaging | Maxima protocol |
| Cluster Manager | Go |
| Web Server | Express.js (Node.js) |
| Frontend | React 18 + TypeScript + Vite |
| Container Runtime | k3s (lightweight Kubernetes) |
| Storage | IPFS (blockchain-anchored) |
| Mesh VPN | WireGuard |
| AI Runtime | TensorFlow Lite / ONNX / GGUF |

---

## Control Plane Architecture

The control plane uses Minima's **Maxima protocol** for encrypted P2P cluster coordination:

```
┌──────────────────┐         Maxima Messages          ┌──────────────────┐
│   Master Node    │ ◄────────────────────────────────► │   Worker Node    │
│                  │  JOIN_REQUEST, HEARTBEAT,          │                  │
│  Go Cluster Mgr  │  STATE_UPDATE, EXEC_REQUEST,      │  Go Cluster Mgr  │
│  Minima (:9001)  │  METRICS, DEREGISTER              │  Minima (:9001)  │
│  Desktop (:3000) │                                    │  Desktop (:3000) │
│  API (:9090)     │                                    │  API (:9090)     │
└──────────────────┘                                    └──────────────────┘
```

---

## Runtime Directory Structure

After setup, PiNet-OS creates its runtime home at `~/.pinet/`:

```
~/.pinet/
├── config.json              # Node configuration (role, ports, Minima address)
├── pinet.pid                # Master process ID
├── bin/minima.jar           # Minima blockchain JAR
├── minima-data/             # Blockchain data and chain state
├── logs/                    # Service logs (minima.log, desktop.log, cluster.log)
├── state/
│   ├── cluster.json         # Cluster state cache
│   └── identity.json        # Node identity (Minima address, keys)
└── modules/                 # Plugin modules and extensions
```

---

## Project Source Structure

```
Minima-PiNet-Os/
├── App.tsx                  # React desktop shell
├── Taskbar.tsx              # Taskbar component
├── server.ts                # Express.js API server (2,299 lines)
├── types.ts                 # Central TypeScript type definitions
├── index.html               # SPA entry point
├── kernel/                  # OS kernel subsystems (5 modules)
├── services/                # OS services (18 services)
├── hal/                     # Hardware Abstraction Layer (6 modules)
├── components/apps/         # Desktop applications (22 React components)
├── bin/                     # CLI executables (pinet, minima, pinet-setup)
├── types/                   # TypeScript type definitions
├── docs/                    # Documentation (7 guides)
├── boot/                    # Boot configuration files
├── config/                  # System configuration
├── build-system/            # Build toolchain
├── electron/                # Electron desktop app
├── scripts/                 # Release and build scripts
├── tools/                   # OS image build tools
├── tests/                   # Test suites
├── PiNetOS/                 # PiNet-specific configurations
└── system/                  # System-level configurations
```

---

## Connectivity Stack

PiNet OS supports multi-layer connectivity with automatic failover:

| Priority | Layer | Use Case |
|---|---|---|
| 1 | 5G / 4G LTE | Primary high-bandwidth |
| 2 | 2G / GSM / SMS | Low-bandwidth fallback |
| 3 | WireGuard Mesh | Local P2P cluster |
| 4 | Offline | Local data collection, batch sync |

---

## Key Design Principles

- **Zero-Bloat** — Minimal base system, no unnecessary packages
- **Spawnable Runtime** — Can overlay on any existing Linux distro
- **Decentralized-First** — No central server dependencies
- **Hardware-Aware** — HAL auto-detects and gracefully degrades
- **Security by Default** — Zero-trust architecture from boot
