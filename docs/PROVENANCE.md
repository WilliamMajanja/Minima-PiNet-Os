# On-Chain Provenance System

## Overview

PiNet-OS records significant cluster events as **Minima burn transactions** with structured
metadata. This creates an immutable, tamper-proof audit trail on the blockchain — every node
join, workload execution, and configuration change is verifiable on-chain.

## How It Works

1. Events occur (node joins, workloads complete, configs change)
2. Events are queued locally in the Provenance Service
3. Every 60 seconds, queued events are batched
4. A single Minima burn transaction is created with the batch as metadata
5. The burn transaction is permanently recorded on the Minima blockchain

## Burn Transaction Format

Each burn transaction contains:

```json
{
  "type": "pinet-provenance",
  "version": "3.0.0",
  "clusterId": "cluster-1711461600000-xyz789",
  "batchSize": 3,
  "events": [
    {
      "pinetVersion": "3.0.0",
      "eventType": "NODE_JOIN",
      "clusterId": "cluster-1711461600000-xyz789",
      "nodeId": "pinet-pi-alpha",
      "timestamp": 1711461600000,
      "payload": {
        "joinedNodeId": "pinet-pi-beta",
        "hostname": "raspberrypi-02",
        "role": "worker"
      }
    }
  ],
  "recordedAt": 1711461660000
}
```

**Burn Amount**: 0.001 Minima per batch (configurable)

## Event Types

| Event | When Recorded |
|-------|--------------|
| `NODE_JOIN` | A node joins the cluster |
| `NODE_LEAVE` | A node departs (graceful or timeout) |
| `ROLE_CHANGE` | A node's role changes (worker → master) |
| `WORKLOAD_SUBMIT` | A workload is submitted for execution |
| `WORKLOAD_COMPLETE` | A workload finishes execution |
| `STATE_CHANGE` | Cluster topology or configuration changes |
| `SNAPSHOT_CREATED` | A node snapshot is created |
| `CONFIG_CHANGE` | Cluster configuration is modified |

## Querying Provenance

### Via API

```bash
# Get all provenance events
curl http://localhost:3000/api/cluster/provenance

# Record a new provenance event
curl -X POST http://localhost:3000/api/cluster/provenance/record \
  -H "Content-Type: application/json" \
  -d '{"eventType": "STATE_CHANGE", "payload": {"description": "Manual config update"}}'
```

### Via Minima CLI

Query burn transactions on-chain:

```bash
minima txpowsearch data:pinet-provenance
```

## Enterprise Use Cases

### Agritech
- Record crop sensor readings with immutable timestamps
- Verify organic/sustainability claims via on-chain provenance
- Track supply chain from farm → consumer

### Logistics
- Tamper-proof tracking of shipment conditions (temperature, handling)
- Automated audit trails for compliance
- Verifiable chain of custody

### EV Infrastructure
- Record charging sessions and energy usage
- Machine-to-machine payment settlement
- Grid load balancing provenance

### Industrial IoT
- Compliance-ready audit trails
- Predictive maintenance event logging
- Equipment certification provenance

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `provenance.enabled` | `true` | Enable/disable provenance recording |
| `provenance.batchInterval` | `60000` (60s) | How often to batch and burn |
| `provenance.burnAmount` | `0.001` | Minima amount per burn transaction |

## Implementation

- **TypeScript Service**: `services/provenanceService.ts`
- **Config**: `config/defaults.ts` (`PROVENANCE_*` constants)
- **API**: `POST /api/provenance/record` and `GET /api/cluster/provenance`
