"""Minima blockchain node endpoints."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException

from ..minima_client import minima_client
from ..rate_limiter import exec_rate_limiter, rate_limit_dependency
from ..rmp import build_rmp_proof, create_rnpe2_request, verify_rmp_proof, verify_rnpe2_consensus
from ..state import get_state

router = APIRouter()


async def _network_state_snapshot() -> dict:
    state = get_state()
    data = await minima_client.status()
    if data and data.get("status"):
        response = data.get("response") or {}
        return {
            "chain": response.get("chain") or {},
            "network": response.get("network") or {},
            "node": response.get("node") or {},
            "pinet": {
                "blockHeight": state.minima.block_height,
                "peers": state.minima.peers,
                "status": "Synced",
            },
        }

    return {
        "available": False,
        "reason": "Minima node is not reachable",
        "pinet": {
            "blockHeight": state.minima.block_height,
            "peers": state.minima.peers,
            "status": state.minima.status,
        },
    }


async def _local_height() -> int:
    snapshot = await _network_state_snapshot()
    block = ((snapshot.get("chain") or {}).get("block")) or ((snapshot.get("pinet") or {}).get("blockHeight"))
    try:
        return int(block)
    except (TypeError, ValueError):
        return 0


@router.get("/minima/status")
async def minima_status():
    """Get Minima node status — tries RPC first, falls back to cache."""
    data = await minima_client.status()
    if data and data.get("status"):
        state = get_state()
        chain = (data.get("response") or {}).get("chain") or {}
        net = (data.get("response") or {}).get("network") or {}
        return {
            "balance": state.minima.balance,
            "blockHeight": chain.get("block", state.minima.block_height),
            "status": "Synced",
            "peers": net.get("connected", state.minima.peers),
            "transactions": state.minima.transactions,
        }

    state = get_state()
    return {
        "balance": state.minima.balance,
        "blockHeight": state.minima.block_height,
        "status": state.minima.status,
        "peers": state.minima.peers,
        "transactions": state.minima.transactions,
    }


@router.get("/minima/balance")
async def minima_balance():
    """Return the Minima token balance list from the node."""
    data = await minima_client.balance()
    if data and data.get("status"):
        return {"status": True, "response": data.get("response", [])}
    raise HTTPException(503, "Minima node is not reachable")


@router.post("/minima/cmd", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def minima_cmd(body: dict):
    """Execute a Minima RPC command."""
    command = body.get("command", "")
    if not isinstance(command, str) or not command or len(command) > 1024:
        raise HTTPException(400, "Invalid command")

    data = await minima_client.cmd(command)
    if data is not None:
        return data

    if command == "status":
        state = get_state()
        return {"status": True, "response": {
            "balance": state.minima.balance,
            "blockHeight": state.minima.block_height,
            "status": state.minima.status,
            "peers": state.minima.peers,
        }}

    raise HTTPException(503, "Minima node is not reachable")


@router.get("/minima/rmp/state-proof")
async def minima_rmp_state_proof(keys: str | None = None):
    """Return a compressed Recursive Merkle Proof for the local network state."""
    requested_paths = [key.strip() for key in keys.split(",") if key.strip()] if keys else None
    snapshot = await _network_state_snapshot()
    return build_rmp_proof(snapshot, requested_paths)


@router.post("/minima/rmp/verify")
async def minima_rmp_verify(body: dict):
    """Verify a Recursive Merkle Proof supplied by a peer or client."""
    proof = body.get("proof", body)
    return verify_rmp_proof(proof)


@router.get("/minima/rnpe2/status")
async def minima_rnpe2_status():
    """Return the local RNPE-2 status summary and RMP root."""
    snapshot = await _network_state_snapshot()
    proof = build_rmp_proof(snapshot, ["chain.block", "network.connected", "pinet.blockHeight", "pinet.peers", "pinet.status"])
    return {
        "schemaVersion": "RNPE-2",
        "height": await _local_height(),
        "rmpRoot": proof["root"],
        "proof": proof,
    }


@router.post("/minima/rnpe2/request", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def minima_rnpe2_request(body: dict):
    """Create an RNPE-2 request for missing blocks and optionally send it over Maxima."""
    try:
        peer_height = int(body.get("peerHeight", 0))
    except (TypeError, ValueError) as exc:
        raise HTTPException(400, "peerHeight must be an integer") from exc

    local_height = await _local_height()
    local_proof = build_rmp_proof(await _network_state_snapshot(), ["chain.block", "pinet.blockHeight"])
    request = create_rnpe2_request(local_height, peer_height, local_proof)
    if body.get("peerRoot"):
        request["peerRoot"] = str(body["peerRoot"])

    peer_address = body.get("peerAddress")
    if peer_address:
        if not isinstance(peer_address, str) or len(peer_address) > 256:
            raise HTTPException(400, "Invalid peerAddress")
        payload = json.dumps(request, separators=(",", ":")).replace(" ", "_")
        result = await minima_client.maxima_send(peer_address, "pinet-rnpe2", payload)
        request["delivered"] = bool(result and result.get("status"))
    return request


@router.post("/minima/rnpe2/verify")
async def minima_rnpe2_verify(body: dict):
    """Verify that a peer RMP proof matches the local chain state root."""
    peer_proof = body.get("peerProof")
    if not isinstance(peer_proof, dict):
        raise HTTPException(400, "peerProof required")
    local_proof = body.get("localProof")
    if local_proof is None:
        local_proof = build_rmp_proof(await _network_state_snapshot(), ["chain.block", "network.connected", "pinet.blockHeight", "pinet.peers", "pinet.status"])
    if not isinstance(local_proof, dict):
        raise HTTPException(400, "localProof must be an object")
    return verify_rnpe2_consensus(local_proof, peer_proof)
