"""Kernel & process management endpoints."""
from __future__ import annotations

import os
import platform
import time
import re

import psutil
from fastapi import APIRouter, Depends, HTTPException

from ..rate_limiter import sys_exec_limiter, rate_limit_dependency

router = APIRouter()


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


@router.get("/kernel/cgroups")
async def cgroups():
    return {"cgroups": [], "note": "cgroup support requires Linux with cgroup fs mounted"}


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
    return {"targets": [], "currentRunLevel": 5, "note": "Systemd targets require Linux"}


@router.get("/kernel/services-log")
async def services_log(limit: int = 100):
    limit = min(limit, 500)
    return {"logs": [], "note": "Service logs require systemd/journald"}


@router.get("/kernel/syscalls")
async def syscalls():
    return {"syscalls": [], "totalExecuted": 0, "note": "Syscall tracking requires Linux kernel support"}
