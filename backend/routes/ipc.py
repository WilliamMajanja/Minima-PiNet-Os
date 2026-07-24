"""IPC / D-Bus endpoints — real enumeration of the system D-Bus.

Uses ``busctl`` (systemd) to list well-known names and recently active
units on the bus. When the bus or ``busctl`` is unavailable, returns an
explicit ``available: false`` payload — never invents data.
"""
from __future__ import annotations

import asyncio
import shutil
import subprocess
from typing import Any

from fastapi import APIRouter, Query

router = APIRouter()

_BUSCTL_TIMEOUT = 3
_JOURNALCTL_TIMEOUT = 3


def _has(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def _parse_busctl_list(stdout: str) -> list[dict[str, Any]]:
    """Parse ``busctl list --no-pager --no-legend`` output.

    Columns: NAME PID PROCESS USER CONNECTION UNIT SESSION DESCRIPTION
    """
    services: list[dict[str, Any]] = []
    for line in stdout.splitlines():
        line = line.rstrip()
        if not line:
            continue
        cols = line.split(None, 7)
        if not cols:
            continue
        name = cols[0]
        pid_raw = cols[1] if len(cols) > 1 else "-"
        try:
            pid: int | None = int(pid_raw)
        except ValueError:
            pid = None
        services.append({
            "name": name,
            "type": "system" if name.startswith(":") else "well-known",
            "pid": pid,
            "process": cols[2] if len(cols) > 2 else None,
            "user": cols[3] if len(cols) > 3 else None,
            "unit": cols[5] if len(cols) > 5 else None,
            "description": cols[7] if len(cols) > 7 else None,
        })
    return services


@router.get("/ipc/services")
async def ipc_services() -> dict[str, Any]:
    """Enumerate active services on the system D-Bus."""
    if not _has("busctl"):
        return {
            "services": [],
            "channels": [],
            "stats": {"totalServices": 0, "wellKnown": 0},
            "available": False,
            "reason": "busctl not installed on this host",
        }

    try:
        proc = await asyncio.to_thread(
            subprocess.run,
            ["busctl", "list", "--no-pager", "--no-legend"],
            capture_output=True, text=True, timeout=_BUSCTL_TIMEOUT,
            shell=False, check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return {
            "services": [], "channels": [],
            "stats": {"totalServices": 0, "wellKnown": 0},
            "available": False, "reason": "busctl invocation failed",
        }

    if proc.returncode != 0:
        return {
            "services": [], "channels": [],
            "stats": {"totalServices": 0, "wellKnown": 0},
            "available": False,
            "reason": (proc.stderr or "busctl exited with non-zero status").strip(),
        }

    services = _parse_busctl_list(proc.stdout)
    channels = sorted({s["unit"] for s in services if s.get("unit") and s["unit"] != "-"})
    well_known = sum(1 for s in services if s["type"] == "well-known")
    return {
        "services": services,
        "channels": [{"unit": c} for c in channels],
        "stats": {"totalServices": len(services), "wellKnown": well_known},
        "available": True,
    }


@router.get("/ipc/messages")
async def ipc_messages(limit: int = Query(default=50, ge=1, le=200)) -> dict[str, Any]:
    """Return recent D-Bus broker log lines from the system journal."""
    if not _has("journalctl"):
        return {"messages": [], "available": False, "reason": "journalctl not available"}

    try:
        proc = await asyncio.to_thread(
            subprocess.run,
            [
                "journalctl",
                "-u", "dbus.service",
                "-u", "dbus-broker.service",
                "-n", str(int(limit)),
                "-o", "short-iso",
                "--no-pager",
            ],
            capture_output=True, text=True, timeout=_JOURNALCTL_TIMEOUT,
            shell=False, check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return {"messages": [], "available": False, "reason": "journalctl invocation failed"}

    if proc.returncode != 0:
        return {"messages": [], "available": False, "reason": "journalctl unavailable or no permission"}

    messages = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line or line.startswith("--"):
            continue
        # Format: "<iso-ts> <host> <unit>: <msg>"
        parts = line.split(" ", 2)
        ts = parts[0] if parts else ""
        rest = parts[2] if len(parts) > 2 else line
        messages.append({"timestamp": ts, "message": rest})

    return {"messages": messages, "available": True}
