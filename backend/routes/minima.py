"""Minima blockchain node endpoints."""
from __future__ import annotations

import base64
import json
import re
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException

from ..minima_client import minima_client
from ..rate_limiter import exec_rate_limiter, rate_limit_dependency
from ..rmp import (
    build_rmp_proof,
    create_rnpe2_request,
    verify_rmp_proof,
    verify_rnpe2_consensus,
)
from ..state import get_state

router = APIRouter()


async def _network_state_snapshot() -> dict:
    state = get_state()
    data = await minima_client.status()
    if data and data.get("status"):
        response = data.get("response") or {}
        chain = response.get("chain") or {}
        network = response.get("network") or {}
        node = response.get("node") or {}
        return {
            "chain": chain,
            "network": network,
            "node": node,
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
        node = (data.get("response") or {}).get("node") or {}
        state.minima.block_height = int(chain.get("block", state.minima.block_height) or state.minima.block_height)
        state.minima.peers = int(net.get("connected", state.minima.peers) or state.minima.peers)
        state.minima.status = "Synced"
        state.minima.version = str(node.get("version", "") or data.get("version", "") or state.minima.version)
        state.minima.uptime = str(node.get("uptime", "") or state.minima.uptime)
        state.minima.tip = str(chain.get("tip", "") or state.minima.tip)
        return {
            "balance": str(state.minima.balance),
            "blockHeight": state.minima.block_height,
            "status": state.minima.status,
            "peers": state.minima.peers,
            "transactions": state.minima.transactions,
            "version": state.minima.version,
            "uptime": state.minima.uptime,
            "tip": state.minima.tip,
        }

    state = get_state()
    return {
        "balance": str(state.minima.balance),
        "blockHeight": state.minima.block_height,
        "status": state.minima.status,
        "peers": state.minima.peers,
        "transactions": state.minima.transactions,
        "version": state.minima.version,
        "uptime": state.minima.uptime,
        "tip": state.minima.tip,
    }


@router.get("/minima/balance")
async def minima_balance():
    """Return the Minima token balance list from the node with full precision."""
    data = await minima_client.balance()
    if data and data.get("status"):
        parsed = minima_client.parse_balance(data)
        native = parsed.get("0x00", Decimal(0))
        state = get_state()
        state.minima.balance = native
        return {"status": True, "response": data.get("response", []), "nativeBalance": str(native)}
    raise HTTPException(503, "Minima node is not reachable")


@router.post("/minima/cmd", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def minima_cmd(body: dict):
    """Execute a Minima RPC command."""
    command = body.get("command", "")
    if not isinstance(command, str) or not command or len(command) > 4096:
        raise HTTPException(400, "Invalid command")

    data = await minima_client.cmd(command)
    if data is not None:
        return data

    if command.strip().lower() == "status":
        state = get_state()
        return {"status": True, "response": {
            "balance": str(state.minima.balance),
            "blockHeight": state.minima.block_height,
            "status": state.minima.status,
            "peers": state.minima.peers,
        }}

    raise HTTPException(503, "Minima node is not reachable")


@router.get("/minima/peers")
async def minima_peers():
    """Show connected peers."""
    data = await minima_client.peers()
    if data is not None:
        return data
    raise HTTPException(503, "Minima node is not reachable")


@router.post("/minima/connect")
async def minima_connect(body: dict):
    """Connect to a peer."""
    host = body.get("host", "")
    port = body.get("port")
    if not host:
        raise HTTPException(400, "host required")
    result = await minima_client.connect(host, port)
    if result is not None:
        return result
    raise HTTPException(503, "Minima node is not reachable")


@router.get("/minima/newaddress")
async def minima_newaddress():
    """Generate a new wallet address."""
    data = await minima_client.newaddress()
    if data is not None:
        return data
    raise HTTPException(503, "Minima node is not reachable")


@router.get("/minima/getaddress")
async def minima_getaddress():
    """Get the current default address."""
    data = await minima_client.getaddress()
    if data is not None:
        return data
    raise HTTPException(503, "Minima node is not reachable")


@router.post("/minima/send")
async def minima_send(body: dict):
    """Send Minima tokens to an address.

    Body: {"address": "0x...", "amount": "1.0", "tokenId": "0x00" (optional)}
    Amount should be a string to preserve full precision.
    """
    address = body.get("address", "")
    amount = str(body.get("amount", ""))
    token_id = body.get("tokenId") or body.get("tokenid")
    if not address or not amount:
        raise HTTPException(400, "address and amount required")
    result = await minima_client.send(address, amount, token_id)
    if result is not None:
        return result
    raise HTTPException(503, "Minima node is not reachable")


@router.get("/minima/network")
async def minima_network():
    """Show network status."""
    data = await minima_client.network()
    if data is not None:
        return data
    raise HTTPException(503, "Minima node is not reachable")


@router.get("/minima/block/{block_number}")
async def minima_block(block_number: int):
    """Get block info by number."""
    data = await minima_client.block(block_number)
    if data is not None:
        return data
    raise HTTPException(503, "Minima node is not reachable")


@router.get("/minima/mempool")
async def minima_mempool():
    """Show transaction mempool."""
    data = await minima_client.mempool()
    if data is not None:
        return data
    raise HTTPException(503, "Minima node is not reachable")


@router.post("/minima/automine")
async def minima_automine(body: dict):
    """Toggle auto-mining."""
    enable = body.get("enable", True)
    result = await minima_client.automine(enable)
    if result is not None:
        return result
    raise HTTPException(503, "Minima node is not reachable")


@router.post("/minima/backup")
async def minima_backup():
    """Create a full node backup."""
    result = await minima_client.backup()
    if result is not None:
        return result
    raise HTTPException(503, "Minima node is not reachable")


@router.get("/minima/tokens")
async def minima_tokens():
    """List all known tokens."""
    data = await minima_client.tokens()
    if data is not None:
        return data
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
        safe_peer_address = re.compile(r"^[a-zA-Z0-9.:@_-]+$")
        if not isinstance(peer_address, str) or not safe_peer_address.fullmatch(peer_address) or len(peer_address) > 256:
            raise HTTPException(400, "Invalid peerAddress")
        payload_json = json.dumps(request, separators=(",", ":")).encode("utf-8")
        payload = f"base64:{base64.urlsafe_b64encode(payload_json).decode('ascii')}"
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