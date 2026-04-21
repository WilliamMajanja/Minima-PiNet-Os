"""Device management endpoints."""
from __future__ import annotations

import psutil
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()


def _get_devices():
    """Enumerate system devices via psutil and /sys."""
    devices = []
    # Disk devices
    for disk in psutil.disk_partitions():
        devices.append({
            "id": disk.device.replace("/", "_"),
            "name": disk.device,
            "type": "block",
            "class": "storage",
            "mountpoint": disk.mountpoint,
            "fstype": disk.fstype,
            "status": "active",
        })
    # Network devices
    for name in psutil.net_if_addrs():
        devices.append({
            "id": f"net_{name}",
            "name": name,
            "type": "network",
            "class": "network",
            "status": "active" if psutil.net_if_stats().get(name, None) and psutil.net_if_stats()[name].isup else "inactive",
        })
    return devices


@router.get("/devices")
async def list_devices():
    devices = _get_devices()
    return {
        "devices": devices,
        "tree": devices,
        "stats": {"total": len(devices), "active": sum(1 for d in devices if d["status"] == "active")},
    }


@router.get("/devices/{device_id}")
async def get_device(device_id: str):
    devices = _get_devices()
    dev = next((d for d in devices if d["id"] == device_id), None)
    if not dev:
        raise HTTPException(404, "Device not found")
    return dev


@router.get("/devices/events/recent")
async def device_events(limit: int = Query(default=50, le=200)):
    return {"events": []}


@router.get("/devices/rules/list")
async def device_rules():
    return {"rules": []}
