"""Download endpoints for release artifacts."""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

_CWD = Path(os.getcwd())

_DOWNLOAD_MAP = {
    "download-full-project": "Minima-PiNet-Os-Full.zip",
    "download-pinetos": "PiNetOS-Enterprise.zip",
    "download-os-build": "PiNetOS-Build-System.zip",
    "download-os-docs": "PiNetOS-Documentation.zip",
    "download-os-image": "PiNetOS-RaspberryPi.img",
}


@router.get("/download-full-project")
async def download_full_project():
    return _serve("download-full-project")


@router.get("/download-pinetos")
async def download_pinetos():
    return _serve("download-pinetos")


@router.get("/download-os-build")
async def download_os_build():
    return _serve("download-os-build")


@router.get("/download-os-docs")
async def download_os_docs():
    return _serve("download-os-docs")


@router.get("/download-os-image")
async def download_os_image():
    return _serve("download-os-image")


def _serve(key: str):
    filename = _DOWNLOAD_MAP[key]
    filepath = _CWD / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(filepath, filename=filename)
