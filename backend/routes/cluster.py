"""Cluster management endpoints."""
from __future__ import annotations

import asyncio
import json
import os
import platform
import re
import subprocess
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..config import CLUSTER_API_PORT, DESKTOP_PORT, PINET_VERSION
from ..minima_client import minima_client
from ..rate_limiter import exec_rate_limiter, rate_limit_dependency
from ..state import get_state, save_state

router = APIRouter()

CLUSTER_API_URL = f"http://127.0.0.1:{CLUSTER_API_PORT}"

# In-memory event stores
cluster_event_log: list[dict[str, Any]] = []
provenance_events: list[dict[str, Any]] = []


async def fetch_cluster_state() -> dict:
    """Fetch cluster state from Go service or fallback to local."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{CLUSTER_API_URL}/cluster/state")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass

    state = get_state()
    return {
        "clusterId": "",
        "version": 0,
        "masterNodeId": "",
        "masterAddress": "",
        "nodes": [
            {
                "nodeId": n.id,
                "maximaAddress": "",
                "hostname": n.name,
                "role": "master" if n.id == "n1" else "worker",
                "status": "active" if n.status == "online" else "offline",
                "lastHeartbeat": int(time.time() * 1000),
                "joinedAt": int(time.time() * 1000),
                "metrics": n.metrics.model_dump() if hasattr(n.metrics, 'model_dump') else {"cpu": 0, "ram": 0, "temp": 0, "disk": 0, "networkIn": 0, "networkOut": 0},
                "capabilities": [],
                "version": PINET_VERSION,
            }
            for n in state.cluster
        ],
        "createdAt": int(time.time() * 1000),
        "lastUpdated": int(time.time() * 1000),
    }


@router.get("/cluster/state")
async def get_cluster_state():
    return await fetch_cluster_state()


@router.get("/cluster/nodes")
async def get_cluster_nodes():
    state = get_state()
    return [n.model_dump(by_alias=True) for n in state.cluster]


@router.post("/cluster/discover", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def discover_cluster():
    """Probe known cluster nodes and return their current status."""
    state = get_state()
    results = []

    async def probe_node(node):
        ip = str(node.ip)
        metrics = {"cpu": 0, "ram": 0, "temp": 0, "iops": 0}
        reachable = False

        # Validate IP before using it in shell command or HTTP request
        ip_pattern = re.compile(r"^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$")
        ip_match = ip_pattern.match(ip)
        if not ip_match or any(int(o) > 255 for o in ip_match.groups()):
            results.append({"id": node.id, "name": node.name, "ip": ip, "hat": node.hat, "status": "offline", "metrics": metrics})
            return

        try:
            proc = await asyncio.create_subprocess_exec(
                "ping", "-c", "1", "-W", "2", ip,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=3.0)
            reachable = proc.returncode == 0
        except Exception:
            reachable = False

        if reachable:
            try:
                async with httpx.AsyncClient(timeout=2.0) as client:
                    resp = await client.get(f"http://{ip}:{DESKTOP_PORT}/api/system/health")
                    if resp.status_code == 200:
                        data = resp.json()
                        metrics = {
                            "cpu": data.get("cpu", 0),
                            "ram": data.get("ram", 0),
                            "temp": data.get("temp", 0),
                            "iops": data.get("iops", 0),
                        }
            except Exception:
                pass

        node.status = "online" if reachable else "offline"
        if hasattr(node.metrics, 'cpu'):
            node.metrics.cpu = metrics["cpu"]
            node.metrics.ram = metrics["ram"]
            node.metrics.temp = metrics["temp"]
        results.append({
            "id": node.id,
            "name": node.name,
            "ip": ip,
            "hat": node.hat,
            "status": node.status,
            "metrics": metrics,
        })

    await asyncio.gather(*(probe_node(n) for n in state.cluster))
    save_state()
    return {"nodes": results}


@router.post("/cluster/join", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def join_cluster(body: dict):
    master_address = body.get("masterAddress", "")
    if not master_address:
        raise HTTPException(400, "masterAddress required")

    safe_pattern = re.compile(r"^[a-zA-Z0-9.:@_-]+$")
    if not isinstance(master_address, str) or not safe_pattern.match(master_address) or len(master_address) > 256:
        raise HTTPException(400, "Invalid masterAddress format")

    join_msg = json.dumps({
        "type": "CLUSTER_JOIN_REQUEST",
        "sender": "local-node",
        "senderAddress": "",
        "timestamp": int(time.time() * 1000),
        "nonce": f"{int(time.time() * 1000)}-{os.urandom(4).hex()}",
        "clusterId": "",
        "payload": {
            "nodeId": "local-node",
            "hostname": platform.node(),
            "platform": f"{platform.system()} {platform.machine()}",
            "version": PINET_VERSION,
            "capabilities": [],
        },
    })

    safe_data = join_msg.replace(" ", "_")
    result = await minima_client.maxima_send(master_address, "pinet-cluster", safe_data)
    if result is not None:
        cluster_event_log.append({"type": "JOIN_REQUEST", "target": master_address, "time": int(time.time() * 1000)})
        return {"success": True, "message": "Join request sent via Maxima"}

    return {"success": False, "message": "Failed to send join request — Maxima not reachable"}


@router.post("/cluster/exec", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def cluster_exec(body: dict):
    target_node_id = body.get("targetNodeId", "")
    command = body.get("command", "")
    if not target_node_id or not command:
        raise HTTPException(400, "targetNodeId and command required")
    cluster_event_log.append({"type": "EXEC_REQUEST", "target": target_node_id, "command": command, "time": int(time.time() * 1000)})
    return {"success": True, "message": "Exec request queued"}


@router.post("/cluster/exec-local", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def cluster_exec_local(body: dict):
    workload_id = body.get("workloadId")
    cmd = body.get("command", "")
    args = body.get("args", [])
    cmd_timeout = min(max(int(body.get("timeout", 30000)), 1000), 60000) / 1000

    ALLOWED_COMMANDS = {
        "ls", "cat", "echo", "date", "uname", "hostname", "whoami",
        "df", "free", "uptime", "ps", "top", "ping", "ip", "ifconfig",
        "systemctl", "journalctl", "vcgencmd", "lsblk", "lscpu",
        "docker", "lxc", "minima",
    }
    if not isinstance(cmd, str) or cmd not in ALLOWED_COMMANDS:
        raise HTTPException(403, f"Command not allowed: {cmd}")

    bad_chars = re.compile(r"[;&|`$(){}<>\\*?\[\]!#\n\r]")
    if not isinstance(args, list) or any(not isinstance(a, str) or bad_chars.search(a) for a in args):
        raise HTTPException(400, "Invalid command arguments")

    start = time.time()
    try:
        result = subprocess.run(
            [cmd] + args,
            capture_output=True, text=True, timeout=cmd_timeout,
            shell=False,
        )
        return {
            "workloadId": workload_id,
            "exitCode": result.returncode,
            "stdout": result.stdout[:10000],
            "stderr": result.stderr[:10000],
            "durationMs": int((time.time() - start) * 1000),
        }
    except subprocess.TimeoutExpired:
        return {
            "workloadId": workload_id,
            "exitCode": -1,
            "stdout": "",
            "stderr": "Command timed out",
            "durationMs": int((time.time() - start) * 1000),
        }
    except Exception:
        return {
            "workloadId": workload_id,
            "exitCode": -1,
            "stdout": "",
            "stderr": "Command execution failed",
            "durationMs": int((time.time() - start) * 1000),
        }


@router.get("/cluster/provenance")
async def get_provenance():
    return provenance_events


@router.get("/cluster/events")
async def get_events():
    return cluster_event_log[-100:]


@router.post("/cluster/provision", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def provision_node(body: dict):
    node_id = body.get("id", "")
    state = get_state()
    node = next((n for n in state.cluster if n.id == node_id), None)
    if not node:
        raise HTTPException(404, "Node not found")

    ip_pattern = re.compile(r"^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$")
    ip_match = ip_pattern.match(str(node.ip))
    if not ip_match or any(int(o) > 255 for o in ip_match.groups()):
        raise HTTPException(400, "Invalid IP address for node")

    node.status = "provisioning"
    save_state()

    install_script = "curl -sSL https://raw.githubusercontent.com/WilliamMajanja/Minima-PiNet-Os/main/install.sh | bash"
    try:
        subprocess.Popen(
            ["rpi-connect", "shell", node.ip, install_script],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except Exception:
        node.status = "offline"
        save_state()

    return {"success": True}
