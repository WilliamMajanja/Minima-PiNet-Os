"""Hardware Key-Wrap (TPM 2.0) API routes (v1.3.0).

Endpoints for sealing/unsealing CPIP master keys with TPM 2.0 hardware,
reading PCR values for attestation, and checking keystore status.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from ..config import TPM_KEYWRAP_ENABLED
from ..tpm_keystore import tpm_keystore

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/tpm/status")
async def tpm_status() -> dict[str, Any]:
    """Return TPM keystore status."""
    try:
        return tpm_keystore.status()
    except Exception:
        logger.error("TPM status failed")
        return JSONResponse(status_code=500, content={"detail": "Failed to get TPM status"})


@router.post("/tpm/seal")
async def seal_key(body: dict | None = None) -> dict[str, Any]:
    """Seal the CPIP master key using TPM 2.0."""
    if not TPM_KEYWRAP_ENABLED:
        raise HTTPException(503, "TPM key-wrap is disabled")
    key_id = (body or {}).get("keyId", "cpip-master")
    try:
        result = tpm_keystore.seal_key(key_id)
        return result.model_dump(by_alias=True)
    except Exception:
        logger.error("TPM seal failed")
        return JSONResponse(status_code=500, content={"detail": "Seal operation failed"})


@router.post("/tpm/unseal")
async def unseal_key() -> dict[str, Any]:
    """Unseal the CPIP master key (called at boot or on demand)."""
    if not TPM_KEYWRAP_ENABLED:
        raise HTTPException(503, "TPM key-wrap is disabled")
    try:
        result = tpm_keystore.unseal_key()
        if isinstance(result, dict) and result.get("success") is False:
            return JSONResponse(status_code=500, content={"detail": "Unseal operation failed"})
        safe = dict(result) if isinstance(result, dict) else {"data": str(result)}
        safe.pop("error", None)
        safe.pop("traceback", None)
        safe.pop("exc_info", None)
        return JSONResponse(content=safe)
    except Exception:
        logger.exception("TPM unseal failed")
        return JSONResponse(status_code=500, content={"detail": "Unseal operation failed"})


@router.get("/tpm/pcrs")
async def get_pcrs() -> dict[str, Any]:
    """Read current TPM PCR values for attestation."""
    try:
        pcrs = tpm_keystore.get_pcr_values()
        return {
            "pcrBank": tpm_keystore._pcr_bank,
            "pcrValues": pcrs,
            "tpmAvailable": tpm_keystore.tpm_available,
        }
    except Exception:
        logger.error("Failed to read PCRs")
        return JSONResponse(status_code=500, content={"detail": "Failed to read PCR values"})