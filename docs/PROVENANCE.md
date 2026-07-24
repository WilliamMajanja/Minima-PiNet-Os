# RMPE-2 Provenance System

## Overview

PiNet-OS records significant cluster and release events as **RMPE-2 canonical provenance
records**. Runtime cluster records are hash-chained locally and can be anchored to Minima burn
transactions; release artifacts are published with a `RMPE-2-PROVENANCE.json` manifest and a
GitHub build-provenance attestation.

## How It Works

1. Events occur (node joins, workloads complete, configs change)
2. Events are canonicalized as RMPE-2 JSON
3. A SHA-256 digest is computed over the unsigned canonical record
4. The record receives a `provenanceId`, `rmpeHash`, and `previousHash`
5. Events can be anchored to Minima burn transactions for immutable external auditability

## Runtime Event Format

Each runtime provenance event contains:

```json
{
  "schemaVersion": "RMPE-2",
  "type": "pinet-provenance-event",
  "eventType": "NODE_JOIN",
  "pinetVersion": "1.3.0",
  "source": "cluster",
  "clusterId": "cluster-1711461600000-xyz789",
  "nodeId": "pinet-pi-alpha",
  "payload": {
    "joinedNodeId": "pinet-pi-beta",
    "hostname": "raspberrypi-02",
    "role": "worker"
  },
  "timestamp": 1711461600000,
  "recordedAt": 1711461660000,
  "previousHash": "sha256:...",
  "rmpeHash": "sha256:...",
  "provenanceId": "rmpe2:..."
}
```

**Burn Amount**: 0.001 Minima per batch (configurable)

## Release Manifest Format

Stable release jobs generate:

| File | Purpose |
|---|---|
| `RMPE-2-PROVENANCE.json` | Canonical release manifest for images, source archives, package zips, and `SHA256SUMS.txt` |
| `RMPE-2-PROVENANCE.json.sha256` | SHA-256 checksum for the provenance envelope |
| GitHub build-provenance attestation | Hosted attestation bound to the RMPE-2 manifest subject |

Generate locally after building release artifacts:

```bash
npm run release:provenance -- 1.3.0
```

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
curl -X POST http://localhost:3000/api/provenance/record \
  -H "Content-Type: application/json" \
  -d '{"eventType": "STATE_CHANGE", "payload": {"description": "Manual config update"}}'

# Inspect the RMPE-2 schema
curl http://localhost:3000/api/provenance/schema
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
- Automated audit trails for compliance (supplemented by CPIP SHA-256 tamper-evident audit chain via `GET /cpip/incident`)
- Verifiable chain of custody

### EV Infrastructure
- Record charging sessions and energy usage
- Machine-to-machine payment settlement
- Grid load balancing provenance

### Industrial IoT
- Compliance-ready audit trails (CPIP incident response chain for tamper-evidence)
- Predictive maintenance event logging
- Equipment certification provenance

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `provenance.enabled` | `true` | Enable/disable provenance recording |
| `provenance.batchInterval` | `60000` (60s) | How often to batch and burn |
| `provenance.burnAmount` | `0.001` | Minima amount per burn transaction |

## Implementation

- **Runtime store**: `backend/provenance_store.py`
- **API**: `POST /api/provenance/record`, `POST /api/cluster/provenance/record` (legacy alias), `GET /api/cluster/provenance`, and `GET /api/provenance/schema`
- **Release manifest**: `scripts/generate-rmpe2-provenance.js`

New clients should send `eventType`; `event` remains accepted as a legacy alias for older cluster integrations.
