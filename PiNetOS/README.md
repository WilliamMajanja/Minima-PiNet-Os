# PiNetOS — Enterprise Edge Infrastructure

PiNetOS is a lightweight, spawnable Linux environment that transforms Raspberry Pi 5 devices into enterprise-grade edge nodes for AI, Web3, and resilient connectivity.

**No dedicated image required** — PiNet-OS runs as a contained environment on top of any existing Linux distro on a Pi 5.

## Architecture

```
Pi 5 Node A (master)               Pi 5 Node B (worker)
├─ PiNet-OS runtime (shell session) ├─ PiNet-OS runtime (shell session)
├─ Minima node (:9001 P2P, :9005 RPC) ├─ Minima node (:9001 P2P, :9005 RPC)
├─ CPIP security sidecar (:4180)     ├─ CPIP security sidecar (:4180)
├─ Maxima (cluster control bus)     ├─ Maxima (cluster control bus)
├─ Go cluster manager (:9090)      ├─ Go cluster manager (:9090)
└─ Browser desktop (:3000)          └─ Browser desktop (:3000)
       ↕ Maxima messages                    ↕ Maxima messages
```

## Core Capabilities

- **Ultra-lightweight OS** — Maximum resource efficiency
- **Edge AI runtime** — Local inference (TensorFlow Lite / ONNX / GGUF)
- **Container orchestration** — k3s for edge workloads
- **Distributed storage** — IPFS for resilient, verifiable data
- **Blockchain layer** — Minima node for trust, auditability, identity
- **CPIP security provider** — The Coffee Protocol v5.1.1: AES-256-GCM (FIPS 197), ECDSA P-256 (FIPS 186-4), RSA-KEM-2048, HMAC-SHA256, ITF Defense, FIPS self-tests
- **Secure networking** — WireGuard mesh for encrypted node-to-node communication
- **Multi-layer connectivity** — 2G → 4G → 5G → mesh fallback

## Quick Start

```bash
# One-time setup
bin/pinet setup

# Start as master node
bin/pinet start --role master

# Start as worker and join a cluster
bin/pinet start --role worker --master <master_ip>

# Check status
bin/pinet status

# Open browser desktop
bin/pinet open
```

## Enterprise Use Cases

| Vertical | Capabilities |
|----------|-------------|
| **Agritech** | Soil sensors, irrigation AI, crop provenance on-chain |
| **Logistics** | Real-time tracking, anomaly detection, tamper-proof audit trails |
| **EV Infrastructure** | Smart charging, energy optimization, machine-to-machine payments |
| **Telecoms** | Edge relay nodes, multi-band connectivity, mesh networking |
| **Industrial IoT** | Predictive maintenance, anomaly detection, compliance logging |

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Cluster Guide](CLUSTER_GUIDE.md)
- [Deployment](DEPLOYMENT.md)
- [Maxima Protocol](../docs/MAXIMA_PROTOCOL.md)
- [Provenance](../docs/PROVENANCE.md)
