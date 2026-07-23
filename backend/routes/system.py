"""System stats, OS info, hypervisor switch, and subnet scan endpoints."""
from __future__ import annotations

import asyncio
import os
import platform
import re
import subprocess
import time
from pathlib import Path
from typing import Any

import psutil
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import DESKTOP_PORT, PINET_VERSION
from ..rate_limiter import (
    os_info_limiter,
    rate_limit_dependency,
    sys_exec_limiter,
)
from ..state import get_state, save_state

router = APIRouter()


@router.get("/system-stats")
async def system_stats():
    """Return CPU, RAM, temperature, disk, and uptime."""
    try:
        cpu = psutil.cpu_percent(interval=0.5)
    except Exception:
        cpu = 0.0

    mem = psutil.virtual_memory()
    ram = mem.percent

    temp = 0.0
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            first_sensor = next(iter(temps.values()))
            if first_sensor:
                temp = first_sensor[0].current
    except Exception:
        pass

    disk = 0.0
    try:
        disk_usage = psutil.disk_usage("/")
        disk = disk_usage.percent
    except Exception:
        pass

    uptime = time.time() - psutil.boot_time()

    return {"cpu": cpu, "ram": ram, "temp": temp, "disk": disk, "uptime": uptime}


@router.get("/os-info", dependencies=[Depends(rate_limit_dependency(os_info_limiter))])
async def os_info():
    """Return OS type, hardware model, Pi model, Docker detection."""
    os_name = "unknown"
    is_raspbian = False
    is_ubuntu = False
    is_debian = False
    architecture = platform.machine()
    is_docker = False
    is_pinet_installed = False
    hardware_model = "Generic System"
    pi_model = "generic"

    try:
        model_path = Path("/proc/device-tree/model")
        if model_path.exists():
            hardware_model = model_path.read_text().replace("\x00", "")
            model_lower = hardware_model.lower()
            if "pi 5" in model_lower or "bcm2712" in model_lower:
                pi_model = "pi5"
            elif "pi 4" in model_lower or "bcm2711" in model_lower:
                pi_model = "pi4"
            elif "pi 3" in model_lower or "bcm2837" in model_lower:
                pi_model = "pi3"
            elif "pi 2" in model_lower or "bcm2836" in model_lower:
                pi_model = "pi2"
            elif "zero 2" in model_lower or "zero2" in model_lower:
                pi_model = "zero2w"
            elif "zero" in model_lower:
                pi_model = "zero"
            elif "compute module 4" in model_lower or "cm4" in model_lower:
                pi_model = "cm4"
            elif "compute module 3" in model_lower or "cm3" in model_lower:
                pi_model = "cm3"
            elif "compute module" in model_lower:
                pi_model = "cm"
            elif "pi 1" in model_lower or "model a" in model_lower or "model b" in model_lower:
                pi_model = "pi1"
            elif "raspberry pi" in model_lower:
                pi_model = "pi"

        cpuinfo_path = Path("/proc/cpuinfo")
        if pi_model == "generic" and cpuinfo_path.exists():
            cpuinfo = cpuinfo_path.read_text().lower()
            if "bcm2712" in cpuinfo:
                pi_model = "pi5"
            elif "bcm2711" in cpuinfo:
                pi_model = "pi4"
            elif "bcm2837" in cpuinfo:
                pi_model = "pi3"
            elif "bcm2836" in cpuinfo:
                pi_model = "pi2"
            elif "bcm2835" in cpuinfo:
                pi_model = "pi1"

        os_release_path = Path("/etc/os-release")
        if os_release_path.exists():
            os_release = os_release_path.read_text().lower()
            if "raspbian" in os_release or "raspberrypi" in os_release:
                is_raspbian = True
                os_name = "raspbian"
            elif "ubuntu" in os_release:
                is_ubuntu = True
                os_name = "ubuntu"
            elif "debian" in os_release:
                is_debian = True
                os_name = "debian"

        is_docker = Path("/.dockerenv").exists()
        is_pinet_installed = (
            Path("/app/pinet-functions-python.py").exists()
            or Path("/opt/venv/bin/python3").exists()
            or Path(os.getcwd(), "pinet-config.json").exists()
        )
    except Exception:
        pass

    default_context = os_name if (is_raspbian or is_ubuntu or is_debian) else "pinet"

    return {
        "platform": platform.system().lower(),
        "architecture": architecture,
        "osName": os_name,
        "isRaspbian": is_raspbian,
        "isUbuntu": is_ubuntu,
        "isDebian": is_debian,
        "isDocker": is_docker,
        "isPiNetInstalled": is_pinet_installed,
        "hardwareModel": hardware_model,
        "piModel": pi_model,
        "defaultContext": default_context,
    }


@router.post("/system/switch-os", dependencies=[Depends(rate_limit_dependency(sys_exec_limiter))])
async def switch_os(body: dict):
    """Hypervisor OS context switch."""
    target_os = body.get("targetOS", "")
    node_id = body.get("nodeId", "")

    supported = {"pinet", "raspbian", "ubuntu", "debian"}
    if target_os not in supported:
        raise HTTPException(400, f"Unsupported target OS: {target_os}")

    safe_id_pattern = re.compile(r"^[a-zA-Z0-9._:@-]+$")
    if node_id and not safe_id_pattern.match(node_id):
        raise HTTPException(400, "Invalid node identifier supplied.")

    local_ids = {"n1", "localhost", ""}
    is_remote = node_id not in local_ids
    action = "restart" if target_os == "pinet" else "isolate"
    unit = "pinet-desktop.service" if target_os == "pinet" else "graphical.target"
    transport = "rpi-connect" if is_remote else "local-systemd"

    try:
        if is_remote:
            remote_cmd = (
                "sudo -n systemctl restart pinet-desktop.service"
                if target_os == "pinet"
                else "sudo -n systemctl isolate graphical.target"
            )
            result = subprocess.run(
                ["rpi-connect", "shell", node_id, remote_cmd],
                capture_output=True, text=True, timeout=30,
            )
        else:
            result = subprocess.run(
                ["sudo", "-n", "systemctl", action, unit],
                capture_output=True, text=True, timeout=30,
            )

        if result.returncode != 0:
            return {
                "success": False,
                "error": result.stderr or f"Command exited with status {result.returncode}",
                "targetOS": target_os,
                "nodeId": node_id or "localhost",
                "transport": transport,
                "strategy": "systemd",
                "action": action,
                "unit": unit,
                "requiresReboot": False,
                "rebootScheduled": False,
                "stdout": result.stdout,
                "stderr": result.stderr,
            }

        return {
            "success": True,
            "targetOS": target_os,
            "nodeId": node_id or "localhost",
            "transport": transport,
            "strategy": "systemd",
            "action": action,
            "unit": unit,
            "requiresReboot": False,
            "rebootScheduled": False,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except FileNotFoundError:
        tool = "rpi-connect" if is_remote else "sudo/systemctl"
        return {
            "success": False,
            "error": f"{tool} is not installed or not on PATH.",
            "targetOS": target_os,
            "nodeId": node_id or "localhost",
            "transport": transport,
            "strategy": "systemd",
            "action": action,
            "unit": unit,
            "requiresReboot": False,
            "rebootScheduled": False,
            "stdout": "",
            "stderr": "",
        }
    except Exception:
        return {
            "success": False,
            "error": "An unexpected error occurred during OS switch.",
            "targetOS": target_os,
            "nodeId": node_id or "localhost",
            "transport": transport,
            "strategy": "systemd",
            "action": action,
            "unit": unit,
            "requiresReboot": False,
            "rebootScheduled": False,
            "stdout": "",
            "stderr": "",
        }


@router.get("/system/scan-subnet", dependencies=[Depends(rate_limit_dependency(sys_exec_limiter))])
async def scan_subnet(subnet: str = Query(...)):
    """ARP-style subnet scanning with ping concurrency."""
    sanitized = subnet.strip()
    subnet_match = re.match(r"^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$", sanitized)
    if not subnet_match:
        raise HTTPException(400, "Invalid subnet format")

    octets = [int(o) for o in subnet_match.groups()]
    if any(o < 0 or o > 255 for o in octets):
        raise HTTPException(400, "Invalid subnet octets")

    base = f"{octets[0]}.{octets[1]}.{octets[2]}"
    active_nodes: list[dict[str, Any]] = []

    # Local host
    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    active_nodes.append({
        "id": "n1",
        "name": "pinet-alpha",
        "ip": "192.168.1.10",
        "hat": "SSD_NVME",
        "status": "online",
        "metrics": {"cpu": round(cpu), "ram": round(mem.used / (1024**3), 1), "temp": 0, "iops": 0},
    })

    # Known cluster nodes (matches pinet-config.json)
    known = [
        {"id": "n2", "name": "pinet-beta", "ip": "192.168.1.11", "hat": "SSD_NVME"},
        {"id": "n3", "name": "pinet-sigma", "ip": "192.168.1.12", "hat": "AI_NPU"},
        {"id": "n4", "name": "pinet-rho", "ip": "192.168.1.13", "hat": "AI_NPU"},
    ]

    async def ping_host(ip: str) -> bool:
        try:
            proc = await asyncio.create_subprocess_exec(
                "ping", "-c", "1", "-W", "2", ip,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            code = await proc.wait()
            return code == 0
        except Exception:
            return False

    for node in known:
        reachable = await ping_host(node["ip"])
        active_nodes.append({
            **node,
            "status": "online" if reachable else "offline",
            "metrics": {"cpu": 0, "ram": 0, "temp": 0, "iops": 0},
        })

    # Scan remaining /24
    known_ips = {"192.168.1.10", "192.168.1.11", "192.168.1.12", "192.168.1.13", "127.0.0.1"}
    batch_size = 30
    for batch_start in range(1, 255, batch_size):
        tasks = []
        ips = []
        for i in range(batch_start, min(batch_start + batch_size, 255)):
            ip = f"{base}.{i}"
            if ip in known_ips:
                continue
            ips.append(ip)
            tasks.append(ping_host(ip))
        results = await asyncio.gather(*tasks)
        for ip, alive in zip(ips, results):
            if alive:
                active_nodes.append({
                    "id": f"n_{ip.replace('.', '_')}",
                    "name": f"Node-{ip}",
                    "ip": ip,
                    "hat": "NONE",
                    "status": "online",
                    "metrics": {"cpu": 0, "ram": 0, "temp": 0, "iops": 0},
                })

    return {"nodes": active_nodes}


@router.get("/system/health")
async def system_health():
    """Lightweight health response used by cluster discovery probes."""
    cpu = 0.0
    ram = 0.0
    temp = 0.0
    iops = 0.0
    try:
        cpu = psutil.cpu_percent(interval=0.1)
    except Exception:
        pass
    try:
        mem = psutil.virtual_memory()
        ram = mem.percent
    except Exception:
        pass
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            first_sensor = next(iter(temps.values()))
            if first_sensor:
                temp = first_sensor[0].current
    except Exception:
        pass
    try:
        io = psutil.disk_io_counters()
        if io:
            iops = float(io.read_count + io.write_count)
    except Exception:
        pass
    return {"status": "ok", "cpu": cpu, "ram": ram, "temp": temp, "iops": iops}
