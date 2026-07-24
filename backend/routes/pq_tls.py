"""CPIP PQ-TLS API routes (v1.3.0).

Endpoints for post-quantum TLS status, handshake testing, and key
management for the CPIP RPC transport layer.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..config import CPIP_PQ_TLS_ENABLED
from ..pq_tls import pqtls_manager

router = APIRouter()


@router.get("/cpip/pq-tls/status")
async def pq_tls_status() -> dict[str, Any]:
    """Return PQ-TLS configuration and runtime status."""
    return pqtls_manager.status()


@router.post("/cpip/pq-tls/handshake")
async def pq_tls_handshake(body: dict | None = None) -> dict[str, Any]:
    """Perform a hybrid PQ-TLS handshake test.

    Accepts optional peer public keys for a real handshake, or runs a
    self-test loopback handshake when no peer keys are provided.
    """
    if not CPIP_PQ_TLS_ENABLED:
        raise HTTPException(503, "PQ-TLS is disabled")
    body = body or {}
    return pqtls_manager.perform_handshake(
        peer_classical_pub=body.get("peerClassicalPub", "").encode() if body.get("peerClassicalPub") else b"",
        peer_pq_pub=body.get("peerPqPub", "").encode() if body.get("peerPqPub") else b"",
    )


@router.get("/cpip/pq-tls/keypair")
async def generate_keypair() -> dict[str, Any]:
    """Generate a hybrid PQ-TLS keypair (classical + post-quantum)."""
    if not CPIP_PQ_TLS_ENABLED:
        raise HTTPException(503, "PQ-TLS is disabled")
    classical_priv, classical_pub = pqtls_manager.generate_classical_keypair()
    pq_priv, pq_pub = pqtls_manager.generate_pq_keypair()
    return {
        "classical": {
            "curve": "ecdh-p256",
            "publicKey": classical_pub.decode(errors="replace") if classical_pub else "",
            "hasPrivate": bool(classical_priv),
        },
        "postQuantum": {
            "algorithm": "kyber768",
            "publicKeyLength": len(pq_pub),
            "hasPrivate": bool(pq_priv),
            "available": pqtls_manager.kyber_available,
        },
        "hybrid": pqtls_manager._hybrid,
    }