# Cluster Management

PiNet OS supports multi-node clusters coordinated through the Minima blockchain's **Maxima protocol** for fully decentralized, encrypted peer-to-peer communication.

---

## Overview

A PiNet OS cluster consists of:

- **One Master Node** — coordinates workloads, aggregates metrics, accepts join requests
- **One or More Worker Nodes** — execute workloads, report health via heartbeats

All communication flows through the Maxima protocol — there is no central server or cloud dependency.

---

## Multi-Node Setup

### Step 1: Start the Master

On your first Pi:

```bash
pinet setup
pinet start --role master
```

Note the master's Maxima address:

```bash
pinet status --json | grep maximaAddress
# "maximaAddress": "MX_0xABC123..."
```

### Step 2: Start Workers

On each additional Pi:

```bash
pinet setup
pinet start --role worker --master MX_0xABC123...
```

Or join after startup:

```bash
pinet start --role worker
pinet join MX_0xABC123...
```

### Step 3: Verify the Cluster

```bash
pinet cluster
```

Or via the API:
```bash
curl http://<master-ip>:3000/api/cluster/state
```

---

## Maxima Protocol Specification

All cluster messages are sent via Minima's Maxima protocol as encrypted, signed JSON payloads.

### Message Types

#### `JOIN_REQUEST`
Worker requests to join the cluster.

```json
{
  "type": "JOIN_REQUEST",
  "from": "MX_0xWorker...",
  "payload": {
    "name": "pinet-beta",
    "ip": "192.168.1.11",
    "hat": "AI_NPU",
    "capabilities": ["inference", "storage"],
    "version": "1.3.0"
  }
}
```

#### `JOIN_ACCEPT`
Master accepts the join request.

```json
{
  "type": "JOIN_ACCEPT",
  "from": "MX_0xMaster...",
  "payload": {
    "clusterId": "cluster-abc123",
    "nodeId": "node-002",
    "config": { "heartbeatInterval": 10000 }
  }
}
```

#### `JOIN_REJECT`
Master rejects the join request.

```json
{
  "type": "JOIN_REJECT",
  "from": "MX_0xMaster...",
  "payload": {
    "reason": "Cluster full or incompatible version"
  }
}
```

#### `HEARTBEAT`
Periodic health check from worker to master (every 10 seconds).

```json
{
  "type": "HEARTBEAT",
  "from": "MX_0xWorker...",
  "payload": {
    "nodeId": "node-002",
    "metrics": {
      "cpu": 34.5,
      "ram": 62.1,
      "temp": 52.3,
      "npu": 15.0,
      "iops": 1200
    },
    "timestamp": 1700000000000
  }
}
```

#### `STATE_UPDATE`
Master broadcasts cluster state changes to all nodes.

```json
{
  "type": "STATE_UPDATE",
  "from": "MX_0xMaster...",
  "payload": {
    "nodes": [
      { "id": "node-001", "status": "online", "role": "master" },
      { "id": "node-002", "status": "online", "role": "worker" }
    ],
    "version": 42
  }
}
```

#### `EXEC_REQUEST`
Master sends a workload execution request to a worker.

```json
{
  "type": "EXEC_REQUEST",
  "from": "MX_0xMaster...",
  "payload": {
    "taskId": "task-789",
    "command": "python3 inference.py --model resnet50",
    "timeout": 60000,
    "resources": { "cpu": 2, "memory": "1G" }
  }
}
```

#### `METRICS`
Detailed metrics report (less frequent than heartbeats).

```json
{
  "type": "METRICS",
  "from": "MX_0xWorker...",
  "payload": {
    "nodeId": "node-002",
    "system": { "uptime": 86400, "loadAvg": [1.2, 0.8, 0.5] },
    "storage": { "total": "128G", "used": "34G" },
    "network": { "rxBytes": 1048576, "txBytes": 524288 }
  }
}
```

#### `DEREGISTER`
Node announces it is leaving the cluster.

```json
{
  "type": "DEREGISTER",
  "from": "MX_0xWorker...",
  "payload": {
    "nodeId": "node-002",
    "reason": "shutdown"
  }
}
```

---

## Node Health States

| State | Description | Transition |
|---|---|---|
| `online` | Healthy, responding to heartbeats | Default state after JOIN_ACCEPT |
| `offline` | No heartbeat for >60 seconds | Automatic after timeout |
| `processing` | Executing a workload | Set on EXEC_REQUEST, cleared on completion |
| `provisioning` | Being set up for the first time | During initial setup |
| `awaiting-os` | Waiting for OS image flash | PXE boot or manual imaging |

### Health Timeouts

| Parameter | Default | Description |
|---|---|---|
| `HEARTBEAT_INTERVAL` | 10s | Time between heartbeats |
| `HEARTBEAT_TIMEOUT` | 30s | Warning threshold |
| `NODE_OFFLINE_TIMEOUT` | 60s | Node marked offline |

---

## WireGuard Mesh VPN

For clusters spanning multiple networks, PiNet OS supports WireGuard mesh VPN:

### Configuration Template

Located at `system/wireguard-mesh.conf.template`:

```ini
[Interface]
PrivateKey = <generated>
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = <worker-pubkey>
AllowedIPs = 10.0.0.2/32
Endpoint = <worker-public-ip>:51820
PersistentKeepalive = 25
```

### Setup

```bash
# Generate keys on each node
wg genkey | tee privatekey | wg pubkey > publickey

# Configure and start
sudo cp wireguard-mesh.conf /etc/wireguard/wg0.conf
sudo systemctl enable --now wg-quick@wg0

# Verify
sudo wg show
```

---

## Provenance System

PiNet OS records cluster events on the Minima blockchain for auditable provenance:

### Recording Events

```bash
curl -X POST http://localhost:3000/api/provenance/record \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "WORKLOAD_EXECUTED",
    "nodeId": "node-002",
    "payload": {
      "taskId": "task-789",
      "result": "success",
      "hash": "sha256:abc123..."
    }
  }'
```

### On-Chain Anchoring

Provenance records are anchored to the Minima blockchain via burn transactions, creating an immutable audit trail.

### Querying Provenance

```bash
curl http://localhost:3000/api/cluster/provenance
```

Returns RMPE-2 provenance records with `provenanceId`, `rmpeHash`, `previousHash`, and optional blockchain transaction references.

---

## Enterprise Use Cases

| Use Case | Configuration |
|---|---|
| **Edge AI Inference** | Master distributes ML models; NPU-equipped workers run inference |
| **Sensor Network** | Workers collect data; master aggregates and stores on-chain |
| **Content Delivery** | IPFS-backed distributed content serving |
| **IoT Gateway** | Workers bridge IoT protocols; master coordinates |
| **Distributed Storage** | IPFS cluster with blockchain-anchored provenance |

---

## Cluster API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cluster/state` | Full cluster topology |
| GET | `/api/cluster/nodes` | List nodes with metrics |
| POST | `/api/cluster/join` | Join cluster (rate-limited) |
| POST | `/api/cluster/exec` | Execute across cluster (rate-limited) |
| POST | `/api/cluster/exec-local` | Execute locally (rate-limited) |
| POST | `/api/cluster/provision` | Provision new node (rate-limited) |
| GET | `/api/cluster/provenance` | Provenance audit trail |
| GET | `/api/cluster/events` | Cluster event log |

---

## Configuration

Key cluster settings in `config/defaults.ts`:

| Setting | Default | Description |
|---|---|---|
| `CLUSTER_API_PORT` | 9090 | Cluster API port |
| `HEARTBEAT_INTERVAL` | 10000 (ms) | Heartbeat frequency |
| `HEARTBEAT_TIMEOUT` | 30000 (ms) | Heartbeat warning |
| `NODE_OFFLINE_TIMEOUT` | 60000 (ms) | Offline threshold |

---

## See Also

- [Architecture](Architecture) — Control plane design
- [Networking](Networking) — WireGuard and network configuration
- [Security](Security) — Zero-trust cluster security with CPIP security provider
- [CLI Reference](CLI-Reference) — `pinet cluster` and `pinet join`
