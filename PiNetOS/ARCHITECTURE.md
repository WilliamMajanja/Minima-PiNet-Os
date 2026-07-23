# PiNetOS Architecture

## System Overview

PiNet-OS is a distributed edge infrastructure platform built on two layers:

### Layer 1: PiNet-OS Runtime (Linux)
A lightweight runtime environment that spawns on any Linux distro on Raspberry Pi 5:
- **CLI Launcher** (`bin/pinet`) — Single POSIX shell script for lifecycle management
- **Minima Node** — Blockchain node providing identity, trust, and the Maxima P2P bus
- **Go Cluster Manager** — Handles heartbeats, node health, workload execution, and metrics
- **Systemd Services** — For production deployment as managed services

### Layer 2: Browser Desktop (Python)
A visual control plane served locally from the Pi and accessed via browser:
- **FastAPI Backend** (`backend/`) — API server, WebSocket terminal, cluster endpoints
- **Jinja2 Desktop UI** (`frontend/`) — Server-rendered desktop with apps for node management, monitoring, messaging
- **Real-time Updates** — WebSocket channels for cluster events and terminal

## Control Plane Architecture

All cluster coordination uses the **Maxima protocol** (Minima's encrypted P2P message bus):

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

### Message Flow
1. Worker sends `CLUSTER_JOIN_REQUEST` via Maxima to master
2. Master validates and sends `CLUSTER_JOIN_ACCEPT` with peer list
3. All nodes send `CLUSTER_HEARTBEAT` every 10 seconds
4. Master monitors health: active → stale (30s) → offline (60s)
5. Master broadcasts `CLUSTER_STATE_UPDATE` on topology changes
6. All events recorded on-chain via burn transactions (provenance)

## Directory Structure

```
~/.pinet/                      # Runtime home directory
├── config.json                # Node configuration
├── pinet.pid                  # Master PID file
├── bin/minima.jar             # Minima node JAR
├── minima-data/               # Blockchain data
├── logs/                      # Service logs
├── state/
│   ├── cluster.json           # Cluster state cache
│   └── identity.json          # Node identity
└── modules/                   # Plugin modules
```

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Blockchain | Minima (Java) |
| P2P Messaging | Maxima protocol |
| Cluster Manager | Go |
| Web Server | FastAPI (Python 3.11+) |
| Frontend | Jinja2 templates + vanilla JS/CSS |
| Container Runtime | k3s |
| Storage | IPFS |
| Mesh VPN | WireGuard |
| AI Runtime | TensorFlow Lite / ONNX / GGUF |

## Connectivity Stack

PiNet-OS supports multi-layer connectivity for enterprise resilience:

| Layer | Use Case |
|-------|----------|
| 5G / 4G | High-bandwidth data + coordination |
| 2G / GSM / SMS | Low-bandwidth fallback for critical signals |
| WireGuard mesh | Local peer-to-peer encrypted networking |
| CPIP security sidecar | AES-256-GCM encryption, ECDSA P-256 identity, ITF Defense (port 4180) |
| Offline | Local data collection, sync when connected |