"""Formal Remote Attestation API routes (v2.0.0).

Endpoints for creating, verifying, and listing TPM 2.0 PCR-based
attestation records anchored to the Minima blockchain ledger.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..attestation import attestation_manager

router = APIRouter()


@router.get("/attestation/status")
async def attestation_status() -> dict[str, Any]:
    """Return attestation manager status."""
    return {
        "enabled": attestation_manager.enabled,
        "pcrBank": attestation_manager._pcr_bank,
        "recordCount": len(attestation_manager.list_attestations()),
    }


@router.post("/attestation/create")
async def create_attestation(body: dict) -> dict[str, Any]:
    """Create a new attestation record from current system state."""
    if not attestation_manager.enabled:
        raise HTTPException(503, "Attestation is disabled")
    node_id = body.get("nodeId", "")
    if not node_id:
        raise HTTPException(400, "nodeId is required")
    try:
        record = attestation_manager.create_attestation(node_id)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    return record.model_dump(by_alias=True)


@router.get("/attestation")
async def list_attestations() -> dict[str, Any]:
    """List all attestation records."""
    records = attestation_manager.list_attestations()
    return {
        "attestations": [r.model_dump(by_alias=True) for r in records],
        "count": len(records),
    }


@router.get("/attestation/{attestation_id}")
async def get_attestation(attestation_id: str) -> dict[str, Any]:
    record = attestation_manager.get_attestation(attestation_id)
    if record is None:
        raise HTTPException(404, f"Attestation not found: {attestation_id}")
    return record.model_dump(by_alias=True)


@router.post("/attestation/{attestation_id}/verify")
async def verify_attestation(attestation_id: str, body: dict) -> dict[str, Any]:
    """Verify an attestation record against expected golden values."""
    try:
        result = attestation_manager.verify_attestation(
            attestation_id,
            expected_pcrs=body.get("expectedPcrs"),
            expected_boot_hash=body.get("expectedBootHash", ""),
            expected_config_hash=body.get("expectedConfigHash", ""),
        )
    except KeyError:
        raise HTTPException(404, f"Attestation not found: {attestation_id}")
    return result.model_dump(by_alias=True)


@router.post("/attestation/{attestation_id}/anchor")
async def anchor_attestation(attestation_id: str, body: dict) -> dict[str, Any]:
    """Anchor an attestation record to the Minima ledger."""
    txid = body.get("txid", "")
    if not txid:
        raise HTTPException(400, "txid is required")
    success = attestation_manager.anchor_to_ledger(attestation_id, txid)
    if not success:
        raise HTTPException(404, f"Attestation not found: {attestation_id}")
    return {"success": True, "attestationId": attestation_id, "ledgerTxid": txid}