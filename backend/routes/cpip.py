"""CPIP Security Provider API routes.

Exposes CPIP (The Coffee Protocol) cryptographic primitives, ITF Defense
status, emergency mode, health, metrics, auto-update, and version watcher
endpoints.

Documented in SECURITY.md and DEPLOYMENT.md.
"""
from __future__ import annotations

import asyncio
import json
import time

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ..config import (
    CPIP_DEFENSE_ENABLED,
    CPIP_ENABLED,
    CPIP_FIPS_MODE,
    CPIP_RECIPE,
    CPIP_VERSION,
)
from ..cpip_provider import (
    _CRYPTO_AVAILABLE,
    ITFDefense,
    RpcToken,
    run_fips_self_tests,
)

router = APIRouter()


@router.get("/cpip/health")
async def cpip_health():
    return {
        "status": "ok",
        "enabled": CPIP_ENABLED,
        "fips": CPIP_FIPS_MODE,
        "crypto_available": _CRYPTO_AVAILABLE,
    }


@router.get("/cpip/ready")
async def cpip_ready():
    ready = CPIP_ENABLED and _CRYPTO_AVAILABLE
    return {"ready": ready, "enabled": CPIP_ENABLED}


@router.get("/cpip/metrics")
async def cpip_metrics():
    return {
        "blacklist_size": len(ITFDefense.get_blacklist()),
        "blacklisted": ITFDefense.get_blacklist(),
        "defense_enabled": CPIP_DEFENSE_ENABLED,
        "uptime": int(time.time()),
    }


@router.get("/cpip/crypto")
async def cpip_crypto():
    return {
        "provider": "CPIP",
        "version": CPIP_VERSION,
        "enabled": CPIP_ENABLED,
        "fips_mode": CPIP_FIPS_MODE,
        "recipe": CPIP_RECIPE,
        "crypto_available": _CRYPTO_AVAILABLE,
        "primitives": {
            "symmetric": "AES-256-GCM (FIPS 197)",
            "key_derivation": "HKDF-SHA256 (SP 800-56C)",
            "signatures": "ECDSA P-256 (FIPS 186-4)",
            "key_exchange": "ECDH P-256 (FIPS 186-4 / SP 800-56A)",
            "message_auth": "HMAC-SHA256 (FIPS 180-4)",
            "hashing": "SHA-256 (FIPS 180-4)",
        },
        "fips_self_tests_passed": run_fips_self_tests() if CPIP_FIPS_MODE else None,
    }


@router.get("/cpip/defense")
async def cpip_defense():
    return {
        "enabled": CPIP_DEFENSE_ENABLED,
        "blacklisted_ips": ITFDefense.get_blacklist(),
        "blacklist_count": len(ITFDefense.get_blacklist()),
    }


@router.post("/cpip/emergency")
async def cpip_emergency(body: dict, request: Request):
    action = body.get("action", "")
    valid = {"activate", "rotate_keys", "wipe", "deactivate"}
    if action not in valid:
        return {"success": False, "error": f"Invalid action. Valid: {sorted(valid)}"}
    if action == "wipe":
        ITFDefense.clear_blacklist()
    if action in ("rotate_keys", "wipe"):
        RpcToken.init_secret()
    return {"success": True, "action": action, "timestamp": int(time.time())}


@router.get("/cpip/incident")
async def cpip_incident():
    return {
        "blacklist": ITFDefense.get_blacklist(),
        "defense_enabled": CPIP_DEFENSE_ENABLED,
        "timestamp": int(time.time()),
    }


# ─── CPIP Auto-Update Endpoints ──────────────────────────────────────────────


@router.get("/cpip/version")
async def cpip_version():
    """Return the current CPIP version."""
    return {
        "version": CPIP_VERSION,
        "enabled": CPIP_ENABLED,
    }


@router.get("/cpip/update/check")
async def cpip_update_check():
    """Check for available CPIP updates."""
    from ..cpip_updater import check_for_update
    info = check_for_update()
    return {
        "current_version": info.current_version,
        "latest_version": info.latest_version,
        "update_available": info.update_available,
        "release_url": info.release_url,
        "release_notes": info.release_notes[:500],
        "published_at": info.published_at,
        "last_checked": info.last_checked,
        "error": info.error,
    }


@router.post("/cpip/update")
async def cpip_update(body: dict):
    """Apply a CPIP update.

    Body:
        target_version: Optional version string (e.g. "5.1.0"). If omitted,
                        updates to the latest available version.
    """
    from ..cpip_updater import apply_update
    target = body.get("target_version")
    return apply_update(target_version=target)


@router.get("/cpip/update/status")
async def cpip_update_status():
    """Return the last update check/result status."""
    from ..cpip_updater import _load_update_state
    state = _load_update_state()
    return {
        "installed_version": CPIP_VERSION,
        "last_checked": state.get("last_checked", 0),
        "last_updated": state.get("last_updated", 0),
        "latest_known": state.get("latest_version", CPIP_VERSION),
    }


# ─── CPIP Version Watcher Endpoints ──────────────────────────────────────────


@router.get("/cpip/watcher")
async def cpip_watcher_status():
    """Return the CPIP watcher status."""
    from ..cpip_watcher import get_watcher_state
    return get_watcher_state()


@router.post("/cpip/watcher/check")
async def cpip_watcher_force_check():
    """Force an immediate version check."""
    from ..cpip_watcher import force_check_now
    return await force_check_now()


@router.post("/cpip/watcher/start")
async def cpip_watcher_start():
    """Start the background watcher."""
    from ..cpip_watcher import start_watcher
    await start_watcher()
    return {"success": True, "message": "Watcher started"}


@router.post("/cpip/watcher/stop")
async def cpip_watcher_stop():
    """Stop the background watcher."""
    from ..cpip_watcher import stop_watcher
    await stop_watcher()
    return {"success": True, "message": "Watcher stopped"}


@router.get("/cpip/watcher/events")
async def cpip_watcher_sse():
    """SSE stream of CPIP watcher events.

    Client receives events: watcher_started, check_complete,
    update_available, update_starting, update_complete, update_failed,
    version_changed, watcher_error, watcher_stopped.
    """
    from ..cpip_watcher import subscribe_sse, unsubscribe_sse

    queue: asyncio.Queue[str] = asyncio.Queue()

    def on_event(message: str) -> None:
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            pass

    subscribe_sse(on_event)

    async def event_generator():
        try:
            # Send initial state
            from ..cpip_watcher import get_watcher_state
            state = get_watcher_state()
            yield f"event: state\ndata: {json.dumps(state)}\n\n"

            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=30)
                    yield message
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    yield f": heartbeat {int(time.time())}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            unsubscribe_sse(on_event)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )