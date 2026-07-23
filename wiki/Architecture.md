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

### Layer 2: Browser Desktop (Python)

A visual control plane served locally from the Pi:

| Component | Description |
|---|---|
| **FastAPI Backend** (`backend/`) | API server, WebSocket terminal, cluster endpoints |
| **Jinja2 Desktop** (`frontend/`) | Server-rendered desktop with built-in applications |
| **Real-time Updates** | WebSocket channels for cluster events and terminal I/O |

---

## Technology Stack

| Component | Technology |
|---|---|
| Blockchain | Minima (Java) |
| P2P Messaging | Maxima protocol |
| Cluster Manager | Go |
| Web Server | FastAPI (Python 3.11+) |
| Frontend | Jinja2 templates + vanilla JS/CSS |
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
│  Minima (:9001 P2P, :9005 RPC)  │  METRICS, DEREGISTER            │  Minima (:9001 P2P, :9005 RPC)  │
│  CPIP (:4180)    │                                    │  CPIP (:4180)    │
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
├── run.py                   # FastAPI/Jinja desktop entrypoint
├── backend/                 # FastAPI app: routes, services, websocket, models
│   ├── main.py              # ASGI application
│   ├── routes/              # REST endpoints (cluster, kernel, network, dapps, ...)
│   ├── websocket/           # WebSocket handlers (terminal, cluster)
│   ├── minima_client.py     # Minima RPC client (httpx)
│   └── models.py            # Pydantic models
├── frontend/                # Jinja2 templates + static JS/CSS desktop
│   ├── templates/           # base.html, desktop.html
│   └── static/              # css/, js/ (window manager, terminal, app shell)
├── kernel/                  # Linux kernel build inputs (DTS, config, build-kernel.sh)
├── bin/                     # CLI executables (pinet, minima, pinet-setup)
├── boot/                    # Boot configuration files (config.txt, cmdline.txt)
├── docs/                    # Documentation
├── build-system/            # Build toolchain
├── scripts/                 # Release and image-packaging scripts
├── tools/                   # OS image build tools
├── tests/                   # Test suites
├── PiNetOS/                 # PiNet system scripts and service units
├── k3s/                     # K3s cluster manifests
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
- **Security by Default** — Zero-trust architecture from boot, CPIP security provider (AES-256-GCM, ECDSA P-256, ITF Defense)
