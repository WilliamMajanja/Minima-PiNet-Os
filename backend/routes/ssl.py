"""PiNet-OS — SSL/TLS Management API Routes

Endpoints for managing SSL certificates, HSTS configuration,
and TLS status for the PiNet-OS web server.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..ssl_manager import (
    SSL_ENABLED,
    delete_certs,
    generate_ca,
    generate_cert,
    get_cert_paths,
    get_status,
    install_ca_system,
)

router = APIRouter()


# ─── Response Models ───────────────────────────────────────────────────────────

class SSLStatusResponse(BaseModel):
    ssl_enabled: bool
    mkcert_available: bool
    certs_exist: bool
    hsts_enabled: bool
    hsts_max_age: int
    hsts_include_subdomains: bool
    hsts_preload: bool
    ssl_dir: str
    cert_info: dict | None = None


class SSLGenerateRequest(BaseModel):
    hosts: list[str] | None = None


class SSLActionResponse(BaseModel):
    success: bool
    message: str
    cert_path: str = ""
    key_path: str = ""


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.get("/ssl/status", response_model=SSLStatusResponse)
async def ssl_status():
    """Get SSL/TLS and HSTS status."""
    status = get_status()
    cert_info = status.cert_info
    info_dict = None
    if cert_info:
        info_dict = {
            "cert_path": cert_info.cert_path,
            "key_path": cert_info.key_path,
            "ca_cert_path": cert_info.ca_cert_path,
            "issuer": cert_info.issuer,
            "subject": cert_info.subject,
            "not_before": cert_info.not_before,
            "not_after": cert_info.not_after,
            "serial": cert_info.serial,
            "san": cert_info.san,
            "is_mkcert": cert_info.is_mkcert,
            "is_valid": cert_info.is_valid,
            "days_until_expiry": cert_info.days_until_expiry,
        }

    return SSLStatusResponse(
        ssl_enabled=status.ssl_enabled,
        mkcert_available=status.mkcert_available,
        certs_exist=status.certs_exist,
        hsts_enabled=status.hsts_enabled,
        hsts_max_age=status.hsts_max_age,
        hsts_include_subdomains=status.hsts_include_subdomains,
        hsts_preload=status.hsts_preload,
        ssl_dir=status.ssl_dir,
        cert_info=info_dict,
    )


@router.post("/ssl/generate", response_model=SSLActionResponse)
async def ssl_generate(req: SSLGenerateRequest | None = None):
    """Generate SSL certificates (CA + server cert).

    Uses mkcert if available, falls back to openssl self-signed.
    """
    if not SSL_ENABLED:
        raise HTTPException(
            status_code=400,
            detail="SSL is disabled. Set PINET_SSL_ENABLED=1 to enable.",
        )

    hosts = req.hosts if req and req.hosts else None

    # Step 1: Generate CA
    if not generate_ca():
        raise HTTPException(
            status_code=500,
            detail="Failed to generate CA. Ensure mkcert or openssl is installed.",
        )

    # Step 2: Generate server cert
    result = generate_cert(hosts)
    if not result:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate server certificate.",
        )

    cert_path, key_path = result
    return SSLActionResponse(
        success=True,
        message="SSL certificates generated successfully. Restart the server to apply.",
        cert_path=cert_path,
        key_path=key_path,
    )


@router.delete("/ssl/certs", response_model=SSLActionResponse)
async def ssl_delete_certs():
    """Delete all generated SSL certificates."""
    success = delete_certs()
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to delete certificates.",
        )
    return SSLActionResponse(
        success=True,
        message="All certificates deleted. Restart the server to apply.",
    )


@router.post("/ssl/install-ca", response_model=SSLActionResponse)
async def ssl_install_ca():
    """Install the local CA into the system trust store."""
    success, message = install_ca_system()
    if not success:
        raise HTTPException(status_code=500, detail=message)
    return SSLActionResponse(
        success=True,
        message=message,
    )


@router.get("/ssl/cert")
async def ssl_download_cert():
    """Download the public server certificate (PEM)."""
    cert_path, _ = get_cert_paths()
    if not cert_path or not os.path.exists(cert_path):
        raise HTTPException(
            status_code=404,
            detail="No certificate found. Generate one first with POST /api/ssl/generate",
        )
    from fastapi.responses import FileResponse
    return FileResponse(
        cert_path,
        media_type="application/x-pem-file",
        filename="pinet-server.pem",
    )
