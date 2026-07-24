"""Power management endpoints."""
from __future__ import annotations

import asyncio
import subprocess
import time

import psutil
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/power")
async def power_info():
    battery = psutil.sensors_battery()
    return {
        "info": {
            "state": "running",
            "governor": "ondemand",
            "cpuFreq": psutil.cpu_freq().current if psutil.cpu_freq() else 0,
            "hasBattery": battery is not None,
            "batteryPercent": battery.percent if battery else None,
            "plugged": battery.power_plugged if battery else True,
        },
        "watchdog": {"enabled": True, "timeout": 30000},
        "scheduledShutdown": None,
        "governors": ["ondemand", "powersave", "performance", "conservative"],
    }


@router.post("/power/state")
async def change_power_state(body: dict):
    state = body.get("state", "")
    if not state:
        raise HTTPException(400, "Missing state")
    valid_states = {"shutdown", "reboot", "suspend", "hibernate"}
    if state not in valid_states:
        raise HTTPException(400, f"Invalid state: {state}. Must be one of {sorted(valid_states)}")
    cmd_map = {
        "shutdown": ["systemctl", "poweroff"],
        "reboot": ["systemctl", "reboot"],
        "suspend": ["systemctl", "suspend"],
        "hibernate": ["systemctl", "hibernate"],
    }
    try:
        await asyncio.to_thread(subprocess.run, cmd_map[state], capture_output=True, timeout=5, shell=False, check=True)
        return {"success": True, "state": state}
    except subprocess.CalledProcessError as exc:
        stderr_output = exc.stderr.decode(errors="replace").strip() if isinstance(exc.stderr, bytes) else str(exc.stderr or "").strip()
        return {"success": False, "state": state, "error": stderr_output or "Command failed"}
    except FileNotFoundError:
        return {"success": False, "state": state, "error": "systemctl not available on this platform"}


@router.post("/power/governor")
async def set_governor(body: dict):
    governor = body.get("governor", "")
    valid = {"ondemand", "powersave", "performance", "conservative"}
    if governor not in valid:
        return {"success": False, "error": f"Invalid governor: {governor}"}
    return {"success": True, "governor": governor}


@router.post("/power/schedule")
async def schedule_power(body: dict):
    action = body.get("action", "")
    delay_ms = body.get("delayMs", 0)
    if not action or not delay_ms:
        raise HTTPException(400, "Missing action or delay")
    return {
        "success": True,
        "action": action,
        "scheduledAt": int(time.time() * 1000) + delay_ms,
    }
