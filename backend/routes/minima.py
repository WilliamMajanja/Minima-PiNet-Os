"""Minima blockchain node endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..minima_client import minima_client
from ..rate_limiter import exec_rate_limiter, rate_limit_dependency
from ..state import get_state

router = APIRouter()


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
