# PiNetOS Cluster Guide

## Overview

PiNet-OS clusters use the **Maxima protocol** (Minima's encrypted P2P bus) for all coordination.
No central API server, no shared database — just peer-to-peer messages between Minima nodes.

## Prerequisites

Each node needs:
- Raspberry Pi 5 with any Linux distro
- PiNet-OS runtime installed (`pinet setup`)
- Network connectivity between nodes

## Forming a Cluster

### Step 1: Start the Master Node

On the first Pi, start PiNet-OS as the master:

```bash
pinet start --role master
```

This will:
1. Start the local Minima node (P2P port 9001, RPC port 9005)
2. Start the cluster manager (API port 9090)
3. Start the web desktop (port 3000)
4. Initialize the cluster state
5. Begin broadcasting heartbeats

### Step 2: Join Worker Nodes

On each additional Pi, join the cluster:

```bash
pinet start --role worker --master <master_maxima_address>
```

Or use the shorthand:

```bash
pinet join <master_maxima_address>
```

The worker will:
1. Start its own Minima node
2. Send a `CLUSTER_JOIN_REQUEST` via Maxima to the master
3. Receive a `CLUSTER_JOIN_ACCEPT` with the cluster config and peer list
4. Begin sending heartbeats to the master

### Step 3: Verify the Cluster

```bash
pinet cluster
```

Or open the browser desktop at `http://<any-node-ip>:3000` and navigate to the Cluster Manager app.

## Cluster Protocol

All messages are encrypted and sent via Maxima using the `pinet-cluster` application ID. CPIP provides additional CoffeeCipher v3 (AES-256-GCM) payload encryption and ECDSA P-256 node identity via `AUTH_CHALLENGE`/`AUTH_RESPONSE` message types.

| Message | Direction | Purpose |
|---------|-----------|---------|
| `CLUSTER_JOIN_REQUEST` | Worker → Master | Request to join |
| `CLUSTER_JOIN_ACCEPT` | Master → Worker | Acceptance + peer list |
| `CLUSTER_HEARTBEAT` | All → Master | Liveness + metrics (every 10s) |
| `CLUSTER_STATE_UPDATE` | Master → All | Topology changes |
| `CLUSTER_EXEC_REQUEST` | Master → Worker | Run a workload |
| `CLUSTER_EXEC_RESULT` | Worker → Master | Workload result |
| `CLUSTER_METRICS` | All → Master | System metrics |
| `NODE_DEREGISTER` | Any → Master | Graceful departure |

## Node Health

The master monitors all nodes via heartbeat timeouts:
- **Active**: Heartbeat received within 30 seconds
- **Stale**: No heartbeat for 30-60 seconds
- **Offline**: No heartbeat for >60 seconds

## On-Chain Provenance

Every significant cluster event is recorded as a Minima burn transaction:
- Node joins/leaves
- Role changes
- Workload submissions/completions
- Configuration changes

Query provenance via:
```bash
curl http://localhost:3000/api/cluster/provenance
```

## Enterprise Workloads

Submit workloads to specific nodes:
```bash
curl -X POST http://localhost:3000/api/cluster/exec \
  -H "Content-Type: application/json" \
  -d '{"targetNodeId": "pinet-worker-1", "command": "python3", "args": ["inference.py"]}'
```

## Scaling

PiNet-OS clusters scale horizontally — add more Pi 5 nodes and join them:
```bash
# On each new Pi:
pinet setup
pinet join <master_address>
```
