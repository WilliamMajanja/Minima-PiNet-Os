# RMP and RNPE-2

PiNet-OS exposes lightweight state-validation helpers for Minima-backed cluster nodes.

## RMP — Recursive Merkle Proof

RMP is a compressed proof structure for validating selected fields from the current network
state without transferring the full state document. PiNet-OS canonicalizes the local state,
hashes every leaf, and returns only the requested leaves plus their sibling path to the Merkle
root.

Use it to verify state such as:

- `chain.block`
- `network.connected`
- `pinet.blockHeight`
- `pinet.peers`
- `pinet.status`

```bash
curl "http://localhost:3000/api/minima/rmp/state-proof?keys=chain.block,network.connected"
```

Verify a proof:

```bash
curl -X POST http://localhost:3000/api/minima/rmp/verify \
  -H "Content-Type: application/json" \
  -d '{"proof": { "...": "RMP proof" }}'
```

## RNPE-2 — Recursive Network Peer Exchange

RNPE-2 is the peer exchange envelope PiNet-OS uses to compare local chain state with a peer and
request the smallest bounded range of missing blocks. Requests include the local RMP root and a
bounded `missingBlocks` range of up to 512 blocks.

Check local RNPE-2 status:

```bash
curl http://localhost:3000/api/minima/rnpe2/status
```

Create a missing-block request:

```bash
curl -X POST http://localhost:3000/api/minima/rnpe2/request \
  -H "Content-Type: application/json" \
  -d '{"peerHeight": 12000, "peerRoot": "sha256:..."}'
```

If `peerAddress` is supplied, the request is sent over Maxima using the `pinet-rnpe2`
application channel. The RNPE-2 JSON envelope is URL-safe base64 encoded so field values are
preserved exactly in transit.

Verify a peer proof against the local proof:

```bash
curl -X POST http://localhost:3000/api/minima/rnpe2/verify \
  -H "Content-Type: application/json" \
  -d '{"peerProof": { "...": "peer RMP proof" }}'
```

The response reports whether both RMP proofs are structurally valid and whether the roots match
network consensus from the local node's perspective.
