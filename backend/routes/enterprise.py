"""Enterprise PiNet 2.0 endpoints — LXC, AI detection, health, build, release."""
from __future__ import annotations

import asyncio
import logging
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException

from ..config import GITHUB_REPO, GITHUB_TOKEN, PINET_VERSION
from ..rate_limiter import rate_limit_dependency, sys_exec_limiter
from ..state import get_state, save_state

router = APIRouter()


@router.get("/pinet2/status")
async def pinet2_status():
    state = get_state()
    return state.pinet2.model_dump(by_alias=True)


@router.post("/pinet2/lxc-init", dependencies=[Depends(rate_limit_dependency(sys_exec_limiter))])
async def lxc_init():
    state = get_state()
    state.pinet2.lxc_status = "initializing"
    save_state()
    try:
        await asyncio.to_thread(subprocess.Popen, ["bash", "scripts/pinet-lxc-init.sh"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        state.pinet2.lxc_status = "failed"
        save_state()
    return {"success": True}


@router.post("/pinet2/switch", dependencies=[Depends(rate_limit_dependency(sys_exec_limiter))])
async def pinet2_switch(body: dict):
    mode = body.get("mode", "")
    if mode not in ("container", "host"):
        raise HTTPException(400, "Invalid mode")
    state = get_state()
    state.pinet2.resource_priority = mode
    save_state()
    try:
        await asyncio.to_thread(subprocess.Popen, ["bash", "/usr/local/bin/pinet-switch", mode], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        logger.debug("Failed to switch PiNet mode", exc_info=True)
    return {"success": True}


@router.post("/pinet2/ai-detect", dependencies=[Depends(rate_limit_dependency(sys_exec_limiter))])
async def ai_detect():
    state = get_state()
    state.pinet2.ai_acceleration = "detecting"
    save_state()
    try:
        result = await asyncio.to_thread(subprocess.run, ["python3", "scripts/pinet-ai-detect.py"], capture_output=True, text=True, timeout=30, check=False)
        if result.returncode == 0:
            stdout = result.stdout
            if "Hailo-8L NPU Detected" in stdout:
                state.pinet2.ai_acceleration = "hailo"
            elif "cpu-gguf-arm-opt" in stdout:
                state.pinet2.ai_acceleration = "cpu-gguf-arm-opt"
            else:
                state.pinet2.ai_acceleration = "cpu-optimized"
        else:
            state.pinet2.ai_acceleration = "error"
    except (OSError, subprocess.SubprocessError):
        state.pinet2.ai_acceleration = "error"
    save_state()
    return {"success": True}


@router.post("/pinet2/health-check", dependencies=[Depends(rate_limit_dependency(sys_exec_limiter))])
async def health_check():
    state = get_state()
    state.pinet2.health_status = "checking"
    save_state()
    try:
        result = await asyncio.to_thread(subprocess.run, ["bash", "scripts/pinet-health-check.sh"], capture_output=True, text=True, timeout=30, check=False)
        state.pinet2.last_health_check = datetime.now(tz=timezone.utc).isoformat()
        if result.returncode == 0:
            state.pinet2.health_status = "verified"
            import re
            hash_match = re.search(r"Current System Hash: (\w+)", result.stdout)
            if hash_match:
                state.pinet2.system_hash = hash_match.group(1)
        else:
            state.pinet2.health_status = "compromised"
    except (OSError, subprocess.SubprocessError):
        state.pinet2.health_status = "compromised"
    save_state()
    return {"success": True}


@router.post("/build/image", dependencies=[Depends(rate_limit_dependency(sys_exec_limiter))])
async def build_image():
    state = get_state()
    state.pinet2.build_status = "building"
    state.pinet2.build_log = ["[INFO] Starting Enterprise Build Pipeline..."]
    save_state()
    try:
        await asyncio.to_thread(subprocess.Popen, ["bash", "scripts/pinet-build-image.sh"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        state.pinet2.build_status = "failed"
        save_state()
    return {"success": True}


@router.post("/build/release")
async def build_release():
    github_token = GITHUB_TOKEN
    github_repo = GITHUB_REPO
    # Extract owner/repo from full URL if needed
    try:
        from urllib.parse import urlparse
        parsed = urlparse(github_repo if "://" in github_repo else f"https://{github_repo}")
        if parsed.hostname == "github.com" and parsed.path:
            github_repo = parsed.path.strip("/")
    except Exception:
        logger.debug("Failed to parse GitHub repo URL", exc_info=True)

    artifact_path = Path(os.getcwd()) / "PiNetOS-RaspberryPi.img"

    if not github_token:
        raise HTTPException(400, "GITHUB_TOKEN is not set.")
    if not artifact_path.exists():
        raise HTTPException(400, "Artifact not found.")

    state = get_state()
    state.pinet2.build_status = "releasing"
    state.pinet2.build_log.append(f"[INFO] Creating GitHub Release for {github_repo}...")
    save_state()

    import time

    import httpx

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            release_resp = await client.post(
                f"https://api.github.com/repos/{github_repo}/releases",
                headers={
                    "Authorization": f"token {github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                json={
                    "tag_name": f"v{PINET_VERSION}-ent-{int(time.time() * 1000)}",
                    "name": f"PiNet {PINET_VERSION} Enterprise Release - {datetime.now(tz=timezone.utc).strftime('%Y-%m-%d')}",
                    "body": "Official Enterprise-grade, Web3-native operating system for Raspberry Pi 5 clusters.",
                    "draft": False,
                    "prerelease": False,
                },
            )
            if release_resp.status_code not in (200, 201):
                raise RuntimeError(f"Failed to create release: {release_resp.text}")

            release_data = release_resp.json()
            upload_url = release_data["upload_url"].replace("{?name,label}", "?name=PiNetOS-Enterprise-v2.0-LTS.img")

            file_bytes = artifact_path.read_bytes()
            upload_resp = await client.post(
                upload_url,
                headers={
                    "Authorization": f"token {github_token}",
                    "Content-Type": "application/octet-stream",
                },
                content=file_bytes,
            )
            if upload_resp.status_code not in (200, 201):
                raise RuntimeError(f"Failed to upload asset: {upload_resp.text}")

        state.pinet2.build_status = "released"
        state.pinet2.build_log.append(f"[SUCCESS] Released to GitHub: {release_data.get('html_url', '')}")
        save_state()
        return {"success": True, "url": release_data.get("html_url", "")}

    except (httpx.HTTPError, OSError) as exc:
        state.pinet2.build_status = "failed"
        state.pinet2.build_log.append(f"[ERROR] GitHub Release failed: {exc}")
        save_state()
        raise HTTPException(500, str(exc))
