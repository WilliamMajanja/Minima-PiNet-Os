"""Minima blockchain node endpoints."""
from __future__ import annotations

import urllib.parse

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..config import MINIMA_RPC_URL
from ..rate_limiter import exec_rate_limiter, rate_limit_dependency
from ..state import get_state

router = APIRouter()


@router.get("/minima/status")
async def minima_status():
    """Get Minima node status — tries RPC first, falls back to cache."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{MINIMA_RPC_URL}/status")
            if resp.status_code == 200:
                data = resp.json()
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
    except Exception:
        pass
    state = get_state()
    return {
        "balance": state.minima.balance,
        "blockHeight": state.minima.block_height,
        "status": state.minima.status,
        "peers": state.minima.peers,
        "transactions": state.minima.transactions,
    }


@router.post("/minima/cmd", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def minima_cmd(body: dict):
    """Execute a Minima RPC command."""
    command = body.get("command", "")
    if not isinstance(command, str) or not command or len(command) > 1024:
        raise HTTPException(400, "Invalid command")

    try:
        encoded = urllib.parse.quote(command, safe="")
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{MINIMA_RPC_URL}/{encoded}")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass

    if command == "status":
        state = get_state()
        return {"status": True, "response": {
            "balance": state.minima.balance,
            "blockHeight": state.minima.block_height,
            "status": state.minima.status,
            "peers": state.minima.peers,
        }}

    raise HTTPException(503, "Minima node is not reachable")
