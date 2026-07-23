"""Minima RPC Client — Python.

Centralised async client for all communication with the local Minima node.
Supports the Minima HTTP-RPC interface with retry logic, connection pooling,
and comprehensive command coverage.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import urllib.parse
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from .config import (
    CPIP_ENABLED,
    CPIP_MTLS_CA,
    CPIP_MTLS_CERT,
    CPIP_MTLS_KEY,
    CPIP_RPC_AUTH,
    MINIMA_RPC_RETRIES,
    MINIMA_RPC_RETRY_DELAY,
    MINIMA_RPC_TIMEOUT,
    MINIMA_RPC_URL,
)
from .cpip_provider import RpcToken

logger = logging.getLogger(__name__)


class MinimaRpcError(Exception):
    """Raised when the Minima node returns an error or is unreachable."""


class MinimaRpcClient:
    """Async client for the Minima node HTTP-RPC interface.

    The Minima node exposes an HTTP interface where every command is
    passed as a URL-encoded path segment::

        GET http://127.0.0.1:9005/<url-encoded-command>

    The RPC port defaults to MINIMA_PORT+4 (9005 if base port is 9001).
    The P2P port is MINIMA_PORT (9001), MDS file port is MINIMA_PORT+2 (9003),
    and MDS command port is MINIMA_PORT+3 (9004).

    All methods return the raw JSON dict returned by the node on success, or
    raise ``MinimaRpcError`` when the node is unreachable. ``try_call`` wrappers
    return None instead of raising.
    """

    def __init__(
        self,
        rpc_url: str | None = None,
        timeout: float | None = None,
        retries: int | None = None,
        retry_delay: float | None = None,
    ) -> None:
        self.rpc_url = (rpc_url or MINIMA_RPC_URL).rstrip("/")
        self.timeout = (timeout if timeout is not None
                        else MINIMA_RPC_TIMEOUT / 1000.0)
        self.retries = retries if retries is not None else MINIMA_RPC_RETRIES
        self.retry_delay = retry_delay if retry_delay is not None else MINIMA_RPC_RETRY_DELAY
        self._client: httpx.AsyncClient | None = None
        self._version: str | None = None
        self._node_id: str = "pinet-node"
        self._cpip_token: str | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            kwargs: dict[str, Any] = {
                "timeout": httpx.Timeout(self.timeout, connect=5.0),
                "limits": httpx.Limits(max_connections=10, max_keepalive_connections=5),
            }
            if CPIP_ENABLED and CPIP_MTLS_CERT and CPIP_MTLS_KEY:
                kwargs["cert"] = (CPIP_MTLS_CERT, CPIP_MTLS_KEY)
            if CPIP_ENABLED and CPIP_MTLS_CA:
                kwargs["verify"] = CPIP_MTLS_CA
            self._client = httpx.AsyncClient(**kwargs)
        return self._client

    def _get_auth_headers(self) -> dict[str, str]:
        """Return CPIP authentication headers for RPC calls."""
        if not (CPIP_ENABLED and CPIP_RPC_AUTH):
            return {}
        if self._cpip_token is None:
            self._cpip_token = RpcToken.generate(self._node_id)
        return {
            "Authorization": f"CPIP {self._cpip_token}",
            "X-CPIP-Node": self._node_id,
        }

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    # ─── Core call with retry ────────────────────────────────────────────

    async def call(self, command: str) -> dict[str, Any]:
        """Execute an arbitrary Minima command and return its JSON response.

        Retries up to ``self.retries`` times on connection errors with
        ``self.retry_delay`` seconds between attempts.

        When CPIP RPC auth is enabled, each request carries an
        HMAC-SHA256 token in the Authorization header.
        """
        encoded = urllib.parse.quote(command, safe="")
        url = f"{self.rpc_url}/{encoded}"
        headers = self._get_auth_headers()
        last_exc: Exception | None = None

        for attempt in range(self.retries):
            try:
                client = await self._get_client()
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401 and CPIP_ENABLED and CPIP_RPC_AUTH:
                    self._cpip_token = RpcToken.generate(self._node_id)
                    headers = self._get_auth_headers()
                    resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                return data
            except (httpx.HTTPStatusError, httpx.ConnectError,
                    httpx.TimeoutException) as exc:
                last_exc = exc
                if attempt < self.retries - 1:
                    logger.debug("Minima RPC retry %d/%d for '%s': %s",
                                 attempt + 1, self.retries, command, exc)
                    await asyncio.sleep(self.retry_delay * (attempt + 1))
                continue
            except Exception as exc:
                last_exc = exc
                break

        raise MinimaRpcError(
            f"Minima RPC failed after {self.retries} attempts for '{command}': {last_exc}"
        ) from last_exc

    async def try_call(self, command: str) -> dict[str, Any] | None:
        """Like ``call`` but returns *None* instead of raising on any error."""
        try:
            return await self.call(command)
        except Exception as exc:
            logger.debug("Minima RPC try_call failed for '%s': %s", command, exc)
            return None

    # ─── Node Info ────────────────────────────────────────────────────────

    async def status(self) -> dict[str, Any] | None:
        """Return node status (chain, network, version, uptime)."""
        return await self.try_call("status")

    async def balance(self) -> dict[str, Any] | None:
        """Return token balance list."""
        return await self.try_call("balance")

    async def health_check(self) -> bool:
        """Return True if the Minima node is reachable and responsive."""
        result = await self.status()
        return result is not None and bool(result.get("status"))

    async def get_version(self) -> str | None:
        """Query and cache the Minima node version."""
        data = await self.status()
        if data and data.get("status"):
            resp = data.get("response") or {}
            self._version = (resp.get("node") or {}).get("version") or resp.get("version")
        return self._version

    # ─── Wallet / Keys ───────────────────────────────────────────────────

    async def newaddress(self) -> dict[str, Any] | None:
        """Generate a new wallet address."""
        return await self.try_call("newaddress")

    async def getaddress(self) -> dict[str, Any] | None:
        """Get the current default address."""
        return await self.try_call("getaddress")

    async def keys(self) -> dict[str, Any] | None:
        """List all wallet keys."""
        return await self.try_call("keys")

    async def send(self, address: str, amount: str, token_id: str | None = None) -> dict[str, Any] | None:
        """Send Minima or tokens to an address.

        ``amount`` should be a string to preserve precision.
        Optionally specify ``token_id`` for custom tokens.
        """
        cmd = f"send address:{address} amount:{amount}"
        if token_id:
            cmd += f" tokenid:{token_id}"
        return await self.try_call(cmd)

    async def send_post(self, address: str, amount: str, token_id: str | None = None) -> dict[str, Any] | None:
        """Send and immediately post a transaction."""
        cmd = f"send address:{address} amount:{amount}"
        if token_id:
            cmd += f" tokenid:{token_id}"
        return await self.try_call(cmd)

    async def consolidate(self) -> dict[str, Any] | None:
        """Consolidate all coins into one."""
        return await self.try_call("consolidate")

    async def coin_export(self) -> dict[str, Any] | None:
        """Export all coins."""
        return await self.try_call("coinexport")

    async def coin_import(self, data: str) -> dict[str, Any] | None:
        """Import coins from exported data."""
        return await self.try_call(f"coinimport data:{data}")

    # ─── Burn / Provenance ───────────────────────────────────────────────

    async def burn(self, amount: str, data: dict[str, Any]) -> dict[str, Any] | None:
        """Create a burn transaction with embedded JSON metadata.

        Uses base64 encoding to safely embed JSON data in the URL command,
        avoiding the space-replacement bug that would corrupt payloads.
        """
        json_bytes = json.dumps(data, separators=(",", ":")).encode("utf-8")
        encoded_data = base64.urlsafe_b64encode(json_bytes).decode("ascii")
        return await self.try_call(f"burn amount:{amount} data:base64:{encoded_data}")

    # ─── Maxima ──────────────────────────────────────────────────────────

    async def maxima_contacts(self) -> dict[str, Any] | None:
        """Return list of Maxima contacts.

        Uses the correct ``maxcontacts action:list`` command (not
        ``maxima action:contacts`` which does not exist).
        """
        return await self.try_call("maxcontacts action:list")

    async def maxima_send(
        self, to: str, application: str, data: str
    ) -> dict[str, Any] | None:
        """Send a Maxima message.

        ``data`` should be a base64-encoded string for safe URL embedding.
        The caller is responsible for encoding.
        """
        return await self.try_call(
            f"maxima action:send to:{to} application:{application} data:{data}"
        )

    async def maxima_poll(self) -> dict[str, Any] | None:
        """Poll for incoming Maxima messages."""
        return await self.try_call("maxima action:poll")

    async def maxima_info(self) -> dict[str, Any] | None:
        """Return this node's Maxima identity (address, public key)."""
        return await self.try_call("maxima")

    # ─── Network ─────────────────────────────────────────────────────────

    async def peers(self) -> dict[str, Any] | None:
        """Show connected peers."""
        return await self.try_call("peers")

    async def network(self) -> dict[str, Any] | None:
        """Show network status."""
        return await self.try_call("network")

    async def connect(self, host: str, port: int | None = None) -> dict[str, Any] | None:
        """Connect to a peer."""
        cmd = f"connect host:{host}"
        if port:
            cmd += f" port:{port}"
        return await self.try_call(cmd)

    async def disconnect(self, peer_id: str) -> dict[str, Any] | None:
        """Disconnect from a peer."""
        return await self.try_call(f"disconnect id:{peer_id}")

    # ─── Blockchain ───────────────────────────────────────────────────────

    async def block(self, block_number: int | str) -> dict[str, Any] | None:
        """Get block info by number."""
        return await self.try_call(f"block number:{block_number}")

    async def mempool(self) -> dict[str, Any] | None:
        """Show transaction mempool."""
        return await self.try_call("mempool")

    async def scanchain(self) -> dict[str, Any] | None:
        """Scan the blockchain."""
        return await self.try_call("scanchain")

    async def automine(self, enable: bool = True) -> dict[str, Any] | None:
        """Toggle auto-mining."""
        return await self.try_call(f"automine enable:{'true' if enable else 'false'}")

    # ─── Tokens ───────────────────────────────────────────────────────────

    async def token_create(self, name: str, amount: str, decimals: int = 0) -> dict[str, Any] | None:
        """Create a custom token."""
        return await self.try_call(f"tokencreate name:{name} amount:{amount} decimals:{decimals}")

    async def token_validate(self, token_id: str) -> dict[str, Any] | None:
        """Validate a token by ID."""
        return await self.try_call(f"tokenvalidate tokenid:{token_id}")

    async def tokens(self) -> dict[str, Any] | None:
        """List all known tokens."""
        return await self.try_call("tokens")

    # ─── Transactions ────────────────────────────────────────────────────

    async def txn_create(self) -> dict[str, Any] | None:
        """Create a new transaction."""
        return await self.try_call("txncreate")

    async def txn_input(self, txn_id: str, coin_id: str) -> dict[str, Any] | None:
        """Add an input to a transaction."""
        return await self.try_call(f"txninput id:{txn_id} coinid:{coin_id}")

    async def txn_output(self, txn_id: str, address: str, amount: str, token_id: str | None = None) -> dict[str, Any] | None:
        """Add an output to a transaction."""
        cmd = f"txnoutput id:{txn_id} address:{address} amount:{amount}"
        if token_id:
            cmd += f" tokenid:{token_id}"
        return await self.try_call(cmd)

    async def txn_sign(self, txn_id: str) -> dict[str, Any] | None:
        """Sign a transaction."""
        return await self.try_call(f"txnsign id:{txn_id}")

    async def txn_mine_post(self, txn_id: str) -> dict[str, Any] | None:
        """Mine and post a transaction."""
        return await self.try_call(f"txnminepost id:{txn_id}")

    async def txn_check(self, txn_id: str) -> dict[str, Any] | None:
        """Check/validate a transaction."""
        return await self.try_call(f"txncheck id:{txn_id}")

    async def txn_list(self) -> dict[str, Any] | None:
        """List all transactions."""
        return await self.try_call("txnlist")

    # ─── Scripts / Smart Contracts ────────────────────────────────────────

    async def new_script(self, script: str) -> dict[str, Any] | None:
        """Create a new smart contract script."""
        encoded = base64.urlsafe_b64encode(script.encode()).decode("ascii")
        return await self.try_call(f"newscript script:{encoded}")

    async def run_script(self, script: str) -> dict[str, Any] | None:
        """Run a script."""
        encoded = base64.urlsafe_b64encode(script.encode()).decode("ascii")
        return await self.try_call(f"runscript script:{encoded}")

    async def scripts(self) -> dict[str, Any] | None:
        """List all scripts."""
        return await self.try_call("scripts")

    # ─── Signatures ───────────────────────────────────────────────────────

    async def sign(self, data: str) -> dict[str, Any] | None:
        """Sign data with the wallet key."""
        return await self.try_call(f"sign data:{data}")

    async def verify(self, data: str, signature: str) -> dict[str, Any] | None:
        """Verify a signature."""
        return await self.try_call(f"verify data:{data} signature:{signature}")

    # ─── Backup / Restore ────────────────────────────────────────────────

    async def backup(self) -> dict[str, Any] | None:
        """Create a full node backup."""
        return await self.try_call("backup")

    async def restore(self, file_path: str) -> dict[str, Any] | None:
        """Restore from a backup file."""
        return await self.try_call(f"restore file:{file_path}")

    # ─── Utility ──────────────────────────────────────────────────────────

    async def cmd(self, command: str) -> dict[str, Any] | None:
        """Execute an arbitrary command; returns None on failure."""
        return await self.try_call(command)

    @staticmethod
    def parse_balance(data: dict[str, Any]) -> dict[str, Decimal]:
        """Parse a balance response into a dict of token_id -> Decimal amount.

        Uses Decimal to preserve full precision of Minima balances.
        """
        result: dict[str, Decimal] = {}
        resp = data.get("response") or []
        if not isinstance(resp, list):
            return result
        for token in resp:
            token_id = token.get("tokenid", "")
            if not token_id:
                token_id = "0x00"
            try:
                amount = Decimal(str(token.get("confirmed", 0)))
            except (InvalidOperation, ValueError):
                amount = Decimal("0")
            result[token_id] = amount
        return result


# ─── Singleton ─────────────────────────────────────────────────────────────────

minima_client = MinimaRpcClient()