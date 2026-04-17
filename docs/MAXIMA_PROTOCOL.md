# Maxima Cluster Protocol Specification

## Overview

PiNet-OS uses Minima's **Maxima protocol** as the exclusive control plane for cluster
coordination. Maxima provides end-to-end encrypted peer-to-peer messaging through the
Minima blockchain network — no central API server needed.

## Protocol Identity

- **Application ID**: `pinet-cluster`
- **Transport**: Maxima (Minima's encrypted P2P message bus)
- **Encoding**: JSON
- **Version**: 1.1.0

## Message Envelope

Every cluster message follows this envelope format:

```json
{
  "type": "CLUSTER_JOIN_REQUEST",
  "sender": "pinet-pi-alpha-abc123",
  "senderAddress": "MX_0x...",
  "timestamp": 1711461600000,
  "nonce": "1711461600000-a1b2c3d4",
  "clusterId": "cluster-1711461600000-xyz789",
  "payload": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Message type (see below) |
| `sender` | string | Node ID of the sender |
| `senderAddress` | string | Maxima address of sender |
| `timestamp` | number | Unix epoch milliseconds |
| `nonce` | string | Unique message identifier |
| `clusterId` | string | Cluster UUID |
| `payload` | object | Type-specific payload |

## Message Types

### CLUSTER_JOIN_REQUEST

**Direction**: Worker → Master
**Purpose**: Request to join the cluster

```json
{
  "nodeId": "pinet-pi-beta",
  "hostname": "raspberrypi-02",
  "platform": "Linux aarch64",
  "version": "1.1.0",
  "capabilities": ["ai-npu", "ssd-nvme"]
}
```

### CLUSTER_JOIN_ACCEPT

**Direction**: Master → Worker
**Purpose**: Accept a join request with cluster configuration

```json
{
  "clusterId": "cluster-1711461600000-xyz789",
  "assignedRole": "worker",
  "peers": [
    { "nodeId": "pinet-pi-alpha", "maximaAddress": "MX_0x...", "role": "master" },
    { "nodeId": "pinet-pi-beta", "maximaAddress": "MX_0x...", "role": "worker" }
  ],
  "clusterConfig": {
    "heartbeatInterval": 10000,
    "heartbeatTimeout": 30000
  }
}
```

### CLUSTER_HEARTBEAT

**Direction**: All → Master (every 10 seconds)
**Purpose**: Liveness signal with current metrics

```json
{
  "nodeId": "pinet-pi-beta",
  "role": "worker",
  "uptime": 3600,
  "metrics": {
    "cpu": 23.5,
    "ram": 45.2,
    "temp": 52.0,
    "disk": 15.0,
    "networkIn": 1024,
    "networkOut": 512
  }
}
```

### CLUSTER_STATE_UPDATE

**Direction**: Master → All
**Purpose**: Broadcast updated cluster topology

```json
{
  "version": 5,
  "nodes": [ ... ],
  "removedNodes": ["pinet-pi-gamma"]
}
```

### CLUSTER_EXEC_REQUEST

**Direction**: Master → Worker
**Purpose**: Execute a workload on a specific node

```json
{
  "workloadId": "wl-1711461600000-abc",
  "command": "python3",
  "args": ["inference.py", "--model", "resnet50"],
  "env": { "MODEL_PATH": "/opt/models" },
  "timeout": 30000
}
```

### CLUSTER_EXEC_RESULT

**Direction**: Worker → Master
**Purpose**: Return workload execution results

```json
{
  "workloadId": "wl-1711461600000-abc",
  "exitCode": 0,
  "stdout": "Inference complete: confidence=0.95",
  "stderr": "",
  "durationMs": 2340
}
```

### CLUSTER_METRICS

**Direction**: All → Master
**Purpose**: Detailed system metrics broadcast

```json
{
  "nodeId": "pinet-pi-beta",
  "timestamp": 1711461600000,
  "metrics": {
    "cpu": 23.5,
    "ram": 45.2,
    "temp": 52.0,
    "disk": 15.0,
    "networkIn": 1024,
    "networkOut": 512,
    "npu": 80,
    "iops": 12500
  }
}
```

### NODE_DEREGISTER

**Direction**: Any → Master
**Purpose**: Graceful departure from the cluster

```json
{
  "nodeId": "pinet-pi-beta",
  "reason": "graceful shutdown"
}
```

## Node Health States

| Status | Condition | Action |
|--------|-----------|--------|
| `active` | Heartbeat received within 30s | Normal operation |
| `stale` | No heartbeat for 30-60s | Warning logged |
| `offline` | No heartbeat for >60s | Node removed from active pool |
| `pending` | Join request sent, awaiting acceptance | — |

## Implementation

### TypeScript (Frontend/Backend)
- `services/maximaClusterService.ts` — Full protocol implementation
- `types/cluster-protocol.ts` — Type definitions
- `services/minimaRpcClient.ts` — Minima RPC client for Maxima messaging

### Go (Cluster Manager Daemon)
- `PiNetOS/pinet/services/cluster-manager/rpc/maxima.go` — Maxima client
- `PiNetOS/pinet/services/cluster-manager/cluster/state.go` — State management

### Shell (CLI)
- `lib/pinet-runtime.sh` — Maxima helper functions for shell scripts
