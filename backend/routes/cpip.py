"""CPIP Security Provider API routes.

Exposes CPIP (The Coffee Protocol v5.0.5) cryptographic primitives, ITF Defense
status, emergency mode, health, and metrics endpoints.

Documented in SECURITY.md and DEPLOYMENT.md.
"""
from __future__ import annotations

import time
from fastapi import APIRouter, Request

from ..config import (
    CPIP_API_KEY,
    CPIP_DEFENSE_ENABLED,
    CPIP_ENABLED,
    CPIP_FIPS_MODE,
    CPIP_RECIPE,
    CPIP_RPC_AUTH,
    CPIP_TOKEN_TTL,
    CPIP_PROVIDER_URL,
)
from ..cpip_provider import (
    CPIP_FIPS_MODE as _FIPS_MODE,
    ITFDefense,
    RpcToken,
    run_fips_self_tests,
    _CRYPTO_AVAILABLE,
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
        "version": "5.0.5",
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