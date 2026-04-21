"""DApp platform endpoints — install, uninstall, list, serve."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

from ..config import DAPP_INSTALL_DIR
from ..rate_limiter import dapp_install_limiter, dapp_serve_limiter, rate_limit_dependency

router = APIRouter()

DAPP_DIR = Path(os.getcwd()) / DAPP_INSTALL_DIR
DAPP_REGISTRY_FILE = DAPP_DIR / "_registry.json"

# Ensure dapp directory exists
DAPP_DIR.mkdir(parents=True, exist_ok=True)

_VALID_DAPP_ID = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{1,127}$")


def _safe_dapp_dir(dapp_id: str) -> Path:
    if not _VALID_DAPP_ID.match(dapp_id):
        raise HTTPException(400, "Invalid DApp ID")
    return DAPP_DIR / dapp_id


def _safe_relative_parts(requested: str) -> tuple[str, ...]:
    if not isinstance(requested, str):
        raise HTTPException(400, "Invalid file path")
    normalized = requested.replace("\\", "/")
    rel = PurePosixPath(normalized)
    if rel.is_absolute():
        raise HTTPException(403, "Forbidden")
    parts = tuple(p for p in rel.parts if p not in ("", "."))
    if any(p == ".." for p in parts):
        raise HTTPException(403, "Forbidden")
    return parts


def _load_registry() -> list[dict]:
    if DAPP_REGISTRY_FILE.exists():
        try:
            return json.loads(DAPP_REGISTRY_FILE.read_text())
        except Exception:
            pass
    return []


def _save_registry(registry: list[dict]):
    DAPP_REGISTRY_FILE.write_text(json.dumps(registry, indent=2))


def _html_escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;")


@router.get("/dapps")
async def list_dapps():
    return {"dapps": _load_registry()}


@router.get("/dapps/{dapp_id}")
async def get_dapp(dapp_id: str):
    if not _VALID_DAPP_ID.match(dapp_id):
        raise HTTPException(400, "Invalid DApp ID")
    registry = _load_registry()
    dapp = next((d for d in registry if d.get("manifest", {}).get("id") == dapp_id), None)
    if not dapp:
        raise HTTPException(404, "DApp not found")
    return dapp


@router.post("/dapps/install", dependencies=[Depends(rate_limit_dependency(dapp_install_limiter))])
async def install_dapp(body: dict):
    url = body.get("url")
    manifest = body.get("manifest")
    registry = _load_registry()

    if manifest and manifest.get("id"):
        # Sideload mode
        dapp_id = manifest["id"]
        if not _VALID_DAPP_ID.match(dapp_id):
            raise HTTPException(400, "Invalid manifest id")
        if any(d.get("manifest", {}).get("id") == dapp_id for d in registry):
            raise HTTPException(409, "DApp already installed")

        dapp_dir = _safe_dapp_dir(dapp_id)
        dapp_dir.mkdir(parents=True, exist_ok=True)

        entry_url = url if isinstance(url, str) else ""
        safe_name = _html_escape(str(manifest.get("name", "DApp")))
        safe_url = _html_escape(entry_url)

        index_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>{safe_name}</title></head>
<body style="margin:0;overflow:hidden">
<iframe src="{safe_url}" style="border:0;width:100vw;height:100vh" sandbox="allow-scripts allow-forms allow-popups"></iframe>
</body></html>"""
        (dapp_dir / "index.html").write_text(index_content)
        (dapp_dir / "dapp.json").write_text(json.dumps(manifest, indent=2))

        record = {
            "manifest": {
                "id": dapp_id,
                "name": manifest.get("name", dapp_id),
                "description": manifest.get("description", ""),
                "version": manifest.get("version", "1.0.0"),
                "author": manifest.get("author", "Unknown"),
                "kind": manifest.get("kind", "typescript"),
                "icon": manifest.get("icon"),
                "color": manifest.get("color"),
                "entryPoint": manifest.get("entryPoint", "index.html"),
                "permissions": manifest.get("permissions", []),
                "homepage": manifest.get("homepage"),
                "minPinetVersion": manifest.get("minPinetVersion"),
            },
            "installPath": str(dapp_dir),
            "installedAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
            "status": "installed",
        }
        registry.append(record)
        _save_registry(registry)
        return record

    if isinstance(url, str) and url.strip():
        try:
            parsed = urlparse(url)
        except Exception:
            raise HTTPException(400, "Invalid URL")
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(400, "Only http(s) URLs are allowed")

        file_name = os.path.basename(parsed.path)
        base_name = re.sub(r"\.(zip|tar\.gz|mds\.zip)$", "", file_name, flags=re.IGNORECASE)
        dapp_id = re.sub(r"[^a-zA-Z0-9._-]", "-", base_name).lower()

        if not _VALID_DAPP_ID.match(dapp_id):
            raise HTTPException(400, "Could not derive a valid DApp ID from the URL")
        if any(d.get("manifest", {}).get("id") == dapp_id for d in registry):
            raise HTTPException(409, "DApp already installed")

        is_minidapp = url.endswith(".mds.zip")
        dapp_dir = _safe_dapp_dir(dapp_id)
        dapp_dir.mkdir(parents=True, exist_ok=True)

        safe_base = _html_escape(base_name)
        safe_url_str = _html_escape(url)
        index_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>{safe_base}</title></head>
<body style="margin:0;font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="text-align:center;max-width:400px">
<h1 style="font-size:1.5rem">{safe_base}</h1>
<p style="color:#94a3b8;font-size:0.875rem">DApp installed from: {safe_url_str}</p>
</div></body></html>"""
        (dapp_dir / "index.html").write_text(index_content)

        record = {
            "manifest": {
                "id": dapp_id,
                "name": base_name,
                "description": f"Installed from {url}",
                "version": "1.0.0",
                "author": "Unknown",
                "kind": "minidapp" if is_minidapp else "typescript",
                "entryPoint": "index.html",
                "permissions": [],
            },
            "installPath": str(dapp_dir),
            "installedAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
            "status": "installed",
        }
        registry.append(record)
        _save_registry(registry)
        return record

    raise HTTPException(400, "Provide a 'url' or a 'manifest' in the request body")


@router.post("/dapps/{dapp_id}/uninstall", dependencies=[Depends(rate_limit_dependency(dapp_install_limiter))])
async def uninstall_dapp(dapp_id: str):
    if not _VALID_DAPP_ID.match(dapp_id):
        raise HTTPException(400, "Invalid DApp ID")
    registry = _load_registry()
    idx = next((i for i, d in enumerate(registry) if d.get("manifest", {}).get("id") == dapp_id), None)
    if idx is None:
        raise HTTPException(404, "DApp not found")

    dapp = registry[idx]
    install_dir = _safe_dapp_dir(dapp_id)
    if install_dir.exists():
        import shutil
        shutil.rmtree(install_dir, ignore_errors=True)

    registry.pop(idx)
    _save_registry(registry)
    return {"success": True}


@router.get("/dapps/{dapp_id}/serve/{file_path:path}", dependencies=[Depends(rate_limit_dependency(dapp_serve_limiter))])
async def serve_dapp_file(dapp_id: str, file_path: str = "index.html"):
    if not _VALID_DAPP_ID.match(dapp_id):
        raise HTTPException(400, "Invalid DApp ID")

    registry = _load_registry()
    dapp = next((d for d in registry if d.get("manifest", {}).get("id") == dapp_id), None)
    if not dapp:
        raise HTTPException(404, "DApp not found")

    install_path = _safe_dapp_dir(dapp_id)
    file_parts = _safe_relative_parts(file_path)
    target = install_path.joinpath(*file_parts) if file_parts else install_path / "index.html"
    if not target.exists() or target.is_dir():
        raise HTTPException(404, "File not found")

    return FileResponse(target)
