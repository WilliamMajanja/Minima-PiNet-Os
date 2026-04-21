"""Kernel & process management endpoints."""
from __future__ import annotations

import json
import platform
import re
import signal
import subprocess
import time

import psutil
from fastapi import APIRouter, Depends, HTTPException

from ..rate_limiter import sys_exec_limiter, rate_limit_dependency

router = APIRouter()

_SIGNAL_MAP = {
    "SIGTERM": signal.SIGTERM,
    "SIGKILL": signal.SIGKILL,
    "SIGSTOP": signal.SIGSTOP,
    "SIGCONT": signal.SIGCONT,
    "SIGHUP": signal.SIGHUP,
    "SIGUSR1": signal.SIGUSR1,
    "SIGUSR2": signal.SIGUSR2,
}


@router.get("/kernel/processes")
async def list_processes():
    procs = []
    for p in psutil.process_iter(["pid", "name", "status", "cpu_percent", "memory_info", "username"]):
        try:
            info = p.info
            mem = info.get("memory_info")
            procs.append({
                "pid": info["pid"],
                "name": info["name"],
                "status": info["status"],
                "cpu": info.get("cpu_percent", 0),
                "memory": mem.rss if mem else 0,
                "user": info.get("username", ""),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return {"processes": procs, "count": len(procs)}


@router.post("/kernel/processes/{pid}/signal", dependencies=[Depends(rate_limit_dependency(sys_exec_limiter))])
async def signal_process(pid: int, body: dict):
    """Send a signal to a process by PID."""
    sig_name = body.get("signal", "SIGTERM").upper()
    if sig_name not in _SIGNAL_MAP:
        raise HTTPException(400, f"Unknown signal: {sig_name}. Allowed: {sorted(_SIGNAL_MAP)}")
    try:
        proc = psutil.Process(pid)
        proc.send_signal(_SIGNAL_MAP[sig_name])
        return {"success": True, "pid": pid, "signal": sig_name}
    except psutil.NoSuchProcess:
        raise HTTPException(404, f"Process {pid} not found")
    except psutil.AccessDenied:
        raise HTTPException(403, f"Permission denied to signal process {pid}")
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.get("/kernel/processes/tree")
async def process_tree():
    tree = {}
    for p in psutil.process_iter(["pid", "ppid", "name"]):
        try:
            info = p.info
            tree[info["pid"]] = {"pid": info["pid"], "ppid": info["ppid"], "name": info["name"], "children": []}
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    for pid, node in tree.items():
        ppid = node["ppid"]
        if ppid in tree and ppid != pid:
            tree[ppid]["children"].append(node)
    roots = [n for n in tree.values() if n["ppid"] not in tree or n["ppid"] == n["pid"]]
    return roots


@router.get("/kernel/processes/top")
async def top_processes(sort: str = "cpu", limit: int = 20):
    limit = min(limit, 100)
    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info"]):
        try:
            info = p.info
            mem = info.get("memory_info")
            procs.append({
                "pid": info["pid"],
                "name": info["name"],
                "cpu": info.get("cpu_percent", 0),
                "memory": mem.rss if mem else 0,
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    key = "memory" if sort == "memory" else "cpu"
    procs.sort(key=lambda x: x[key], reverse=True)
    return {"processes": procs[:limit], "sortBy": sort, "limit": limit}


@router.get("/kernel/services")
async def list_services():
    """List systemd services using systemctl."""
    services = []
    try:
        result = subprocess.run(
            ["systemctl", "list-units", "--type=service", "--all", "--no-pager", "--output=json"],
            capture_output=True, text=True, timeout=10, shell=False
        )
        if result.returncode == 0 and result.stdout.strip():
            for unit in json.loads(result.stdout):
                services.append({
                    "name": unit.get("unit", ""),
                    "load": unit.get("load", ""),
                    "active": unit.get("active", ""),
                    "sub": unit.get("sub", ""),
                    "description": unit.get("description", ""),
                })
    except json.JSONDecodeError:
        # Fall back to plain text output
        try:
            result = subprocess.run(
                ["systemctl", "list-units", "--type=service", "--all", "--no-pager"],
                capture_output=True, text=True, timeout=10, shell=False
            )
            for line in result.stdout.splitlines():
                parts = line.split(None, 4)
                if len(parts) >= 4 and parts[0].endswith(".service"):
                    services.append({
                        "name": parts[0],
                        "load": parts[1] if len(parts) > 1 else "",
                        "active": parts[2] if len(parts) > 2 else "",
                        "sub": parts[3] if len(parts) > 3 else "",
                        "description": parts[4] if len(parts) > 4 else "",
                    })
        except Exception:
            pass
    except Exception:
        pass
    return {"services": services}


@router.post("/kernel/services/{name}/{action}", dependencies=[Depends(rate_limit_dependency(sys_exec_limiter))])
async def control_service(name: str, action: str):
    """Start, stop, restart, or reload a systemd service."""
    if not re.match(r"^[a-zA-Z0-9@._-]{1,128}\.service$", name):
        raise HTTPException(400, "Invalid service name")
    if action not in ("start", "stop", "restart", "reload", "enable", "disable"):
        raise HTTPException(400, f"Invalid action: {action}")
    try:
        result = subprocess.run(
            ["systemctl", action, name],
            capture_output=True, text=True, timeout=30, shell=False
        )
        if result.returncode != 0:
            return {"success": False, "name": name, "action": action, "error": result.stderr or result.stdout}
        return {"success": True, "name": name, "action": action}
    except FileNotFoundError:
        raise HTTPException(503, "systemctl not available")
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.get("/kernel/scheduler/cron")
async def list_cron_jobs():
    """Read crontab entries for the current user."""
    jobs = []
    try:
        result = subprocess.run(
            ["crontab", "-l"],
            capture_output=True, text=True, timeout=5, shell=False
        )
        if result.returncode == 0:
            for idx, line in enumerate(result.stdout.splitlines()):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split(None, 5)
                if len(parts) >= 6:
                    jobs.append({
                        "id": f"cron-{idx}",
                        "schedule": " ".join(parts[:5]),
                        "command": parts[5],
                        "enabled": True,
                        "raw": line,
                    })
    except Exception:
        pass
    return {"jobs": jobs}


@router.get("/kernel/cgroups")
async def cgroups():
    cgroup_data = []
    try:
        from pathlib import Path
        cg_root = Path("/sys/fs/cgroup")
        if cg_root.exists():
            for entry in list(cg_root.iterdir())[:50]:
                if entry.is_dir():
                    cgroup_data.append({"name": entry.name, "path": str(entry)})
    except Exception:
        pass
    return {"cgroups": cgroup_data}


@router.get("/kernel/memory")
async def memory_stats():
    vm = psutil.virtual_memory()
    swap = psutil.swap_memory()
    return {
        "total": vm.total,
        "available": vm.available,
        "used": vm.used,
        "percent": vm.percent,
        "swap_total": swap.total,
        "swap_used": swap.used,
        "swap_percent": swap.percent,
    }


@router.get("/kernel/fs")
async def filesystem_info():
    partitions = []
    for part in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(part.mountpoint)
            partitions.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": usage.percent,
            })
        except Exception:
            continue
    return {"partitions": partitions}


@router.get("/kernel/env")
async def kernel_env():
    return {
        "platform": platform.system(),
        "release": platform.release(),
        "version": platform.version(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "python_version": platform.python_version(),
        "hostname": platform.node(),
    }


@router.get("/kernel/targets")
async def system_targets():
    targets = []
    try:
        result = subprocess.run(
            ["systemctl", "list-units", "--type=target", "--all", "--no-pager"],
            capture_output=True, text=True, timeout=10, shell=False
        )
        current_run_level = 5
        for line in result.stdout.splitlines():
            parts = line.split(None, 4)
            if len(parts) >= 4 and parts[0].endswith(".target"):
                targets.append({
                    "name": parts[0],
                    "load": parts[1],
                    "active": parts[2],
                    "sub": parts[3],
                    "description": parts[4] if len(parts) > 4 else "",
                })
    except Exception:
        current_run_level = 5
    return {"targets": targets, "currentRunLevel": current_run_level}


@router.get("/kernel/services-log")
async def services_log(limit: int = 100):
    limit = min(limit, 500)
    logs = []
    try:
        result = subprocess.run(
            ["journalctl", "-n", str(limit), "--no-pager", "--output=short-iso"],
            capture_output=True, text=True, timeout=10, shell=False
        )
        if result.returncode == 0:
            logs = result.stdout.splitlines()
    except Exception:
        pass
    return {"logs": logs}


@router.get("/kernel/syscalls")
async def syscalls():
    return {"syscalls": [], "totalExecuted": 0}
