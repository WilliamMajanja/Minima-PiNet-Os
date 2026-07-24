"""Hardware Key-Wrap (TPM 2.0) API routes (v1.3.0).

Endpoints for sealing/unsealing CPIP master keys with TPM 2.0 hardware,
reading PCR values for attestation, and checking keystore status.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..config import TPM_KEYWRAP_ENABLED
from ..tpm_keystore import tpm_keystore

router = APIRouter()


@router.get("/tpm/status")
async def tpm_status() -> dict[str, Any]:
    """Return TPM keystore status."""
    return tpm_keystore.status()


@router.post("/tpm/seal")
async def seal_key(body: dict = None) -> dict[str, Any]:
    """Seal the CPIP master key using TPM 2.0."""
    if not TPM_KEYWRAP_ENABLED:
        raise HTTPException(503, "TPM key-wrap is disabled")
    key_id = (body or {}).get("keyId", "cpip-master")
    result = tpm_keystore.seal_key(key_id)
    return result.model_dump(by_alias=True)


@router.post("/tpm/unseal")
async def unseal_key() -> dict[str, Any]:
    """Unseal the CPIP master key (called at boot or on demand)."""
    if not TPM_KEYWRAP_ENABLED:
        raise HTTPException(503, "TPM key-wrap is disabled")
    return tpm_keystore.unseal_key()


@router.get("/tpm/pcrs")
async def get_pcrs() -> dict[str, Any]:
    """Read current TPM PCR values for attestation."""
    pcrs = tpm_keystore.get_pcr_values()
    return {
        "pcrBank": tpm_keystore._pcr_bank,
        "pcrValues": pcrs,
        "tpmAvailable": tpm_keystore.tpm_available,
    }