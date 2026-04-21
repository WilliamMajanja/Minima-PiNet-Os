"""Minima RPC Client — Python.

Centralised async client for all communication with the local Minima node.
Mirrors the TypeScript MinimaRpcClient so that both backends share the same
calling conventions.
"""
from __future__ import annotations

import urllib.parse
from typing import Any

import httpx

from .config import MINIMA_RPC_URL


class MinimaRpcClient:
    """Async client for the Minima node HTTP-RPC interface.

    The Minima node exposes a plain HTTP interface where every command is
    passed as a URL-encoded path segment::

        GET http://127.0.0.1:9001/<url-encoded-command>

    All methods return the raw JSON dict returned by the node on success, or
    raise ``MinimaRpcError`` when the node is unreachable or returns a
    non-200 status code.
    """

    def __init__(self, rpc_url: str | None = None, timeout: float = 5.0) -> None:
        self.rpc_url = (rpc_url or MINIMA_RPC_URL).rstrip("/")
        self.timeout = timeout

    # ─── Core call ─────────────────────────────────────────────────────────

    async def call(self, command: str) -> dict[str, Any]:
        """Execute an arbitrary Minima command and return its JSON response."""
        encoded = urllib.parse.quote(command, safe="")
        url = f"{self.rpc_url}/{encoded}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()

    async def try_call(self, command: str) -> dict[str, Any] | None:
        """Like ``call`` but returns *None* instead of raising on any error."""
        try:
            return await self.call(command)
        except Exception:
            return None

    # ─── Typed wrappers ────────────────────────────────────────────────────

    async def status(self) -> dict[str, Any] | None:
        """Return node status (chain, network, version, uptime)."""
        return await self.try_call("status")

    async def balance(self) -> dict[str, Any] | None:
        """Return token balance list."""
        return await self.try_call("balance")

    async def send(self, to: str, amount: float) -> dict[str, Any] | None:
        """Send Minima tokens to an address."""
        return await self.try_call(f"send to:{to} amount:{amount}")

    async def burn(self, amount: str, data: dict[str, Any]) -> dict[str, Any] | None:
        """Create a burn transaction with embedded JSON metadata."""
        import json
        json_str = json.dumps(data).replace(" ", "_")
        return await self.try_call(f"burn amount:{amount} data:{json_str}")

    # ─── Maxima ────────────────────────────────────────────────────────────

    async def maxima_contacts(self) -> dict[str, Any] | None:
        """Return list of Maxima contacts."""
        return await self.try_call("maxima action:contacts")

    async def maxima_send(
        self, to: str, application: str, data: str
    ) -> dict[str, Any] | None:
        """Send a Maxima message. ``data`` must already be a safe string."""
        return await self.try_call(
            f"maxima action:send to:{to} application:{application} data:{data}"
        )

    async def maxima_poll(self) -> dict[str, Any] | None:
        """Poll for incoming Maxima messages."""
        return await self.try_call("maxima action:poll")

    async def maxima_info(self) -> dict[str, Any] | None:
        """Return this node's Maxima identity (address, public key)."""
        return await self.try_call("maxima")

    # ─── Utility ───────────────────────────────────────────────────────────

    async def cmd(self, command: str) -> dict[str, Any] | None:
        """Execute an arbitrary command; returns None on failure."""
        return await self.try_call(command)

    async def health_check(self) -> bool:
        """Return True if the Minima node is reachable."""
        result = await self.status()
        return result is not None and bool(result.get("status"))


# ─── Singleton ─────────────────────────────────────────────────────────────────

minima_client = MinimaRpcClient()
