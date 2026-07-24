"""Network management endpoints."""
from __future__ import annotations

import asyncio
import logging
import re
import subprocess

import psutil
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter()

# Valid interface name pattern (alphanumerics, dash, dot, colon, underscore)
_IFACE_RE = re.compile(r"^[a-zA-Z0-9._:-]{1,16}$")


@router.get("/network/interfaces")
async def list_interfaces():
    interfaces = []
    addrs = psutil.net_if_addrs()
    stats = psutil.net_if_stats()
    io = psutil.net_io_counters(pernic=True)

    for name, addr_list in addrs.items():
        iface = {
            "name": name,
            "addresses": [],
            "isUp": stats.get(name, None) and stats[name].isup,
            "speed": stats[name].speed if name in stats else 0,
            "mtu": stats[name].mtu if name in stats else 0,
        }
        for addr in addr_list:
            iface["addresses"].append({
                "family": str(addr.family),
                "address": addr.address,
                "netmask": addr.netmask,
                "broadcast": addr.broadcast,
            })
        if name in io:
            iface["stats"] = {
                "bytesRecv": io[name].bytes_recv,
                "bytesSent": io[name].bytes_sent,
                "packetsRecv": io[name].packets_recv,
                "packetsSent": io[name].packets_sent,
            }
        interfaces.append(iface)

    total_io = psutil.net_io_counters()
    net_stats = {
        "totalBytesRecv": total_io.bytes_recv,
        "totalBytesSent": total_io.bytes_sent,
    }
    return {"interfaces": interfaces, "stats": net_stats}


@router.get("/network/routes")
async def get_routes():
    routes = []
    try:
        result = await asyncio.to_thread(
            subprocess.run,
            ["ip", "-json", "route"],
            capture_output=True, text=True, timeout=5, shell=False, check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            import json
            for r in json.loads(result.stdout):
                routes.append({
                    "destination": r.get("dst", ""),
                    "gateway": r.get("gateway", ""),
                    "interface": r.get("dev", ""),
                    "metric": r.get("metric", 0),
                    "protocol": r.get("protocol", ""),
                    "scope": r.get("scope", ""),
                })
    except Exception:
        logger.debug("Failed to read network routes", exc_info=True)
    return {"routes": routes}


@router.get("/network/dns")
async def get_dns():
    dns_servers = []
    try:
        from pathlib import Path
        resolv = Path("/etc/resolv.conf")
        if resolv.exists():
            for line in resolv.read_text().splitlines():
                if line.strip().startswith("nameserver"):
                    dns_servers.append(line.strip().split()[1])
    except Exception:
        logger.debug("Failed to read DNS configuration", exc_info=True)
    return {"servers": dns_servers or ["8.8.8.8", "8.8.4.4"]}


@router.get("/network/firewall")
async def get_firewall():
    rules = []
    default_policy = "deny"
    try:
        result = await asyncio.to_thread(
            subprocess.run,
            ["iptables", "-L", "-n", "--line-numbers", "-v"],
            capture_output=True, text=True, timeout=5, shell=False, check=False,
        )
        if result.returncode == 0:
            current_chain = ""
            for line in result.stdout.splitlines():
                if line.startswith("Chain "):
                    parts = line.split()
                    current_chain = parts[1] if len(parts) > 1 else ""
                    if "policy" in line:
                        policy_match = re.search(r"policy (\w+)", line)
                        if policy_match and current_chain == "INPUT":
                            pol = policy_match.group(1)
                            default_policy = "deny" if pol in ("DROP", "REJECT") else "accept"
                elif line.strip() and not line.startswith("target") and not line.startswith("pkts"):
                    parts = line.split()
                    if len(parts) >= 4:
                        rules.append({
                            "chain": current_chain,
                            "action": parts[0],
                            "protocol": parts[3],
                            "source": parts[7] if len(parts) > 7 else "any",
                            "destination": parts[8] if len(parts) > 8 else "any",
                        })
    except Exception:
        logger.debug("Failed to read iptables rules", exc_info=True)
    return {"rules": rules, "defaultPolicy": default_policy}


@router.get("/network/wireguard")
async def get_wireguard():
    interfaces = []
    try:
        result = await asyncio.to_thread(
            subprocess.run,
            ["wg", "show", "all", "dump"],
            capture_output=True, text=True, timeout=5, shell=False, check=False,
        )
        if result.returncode == 0:
            current_iface = None
            for line in result.stdout.splitlines():
                parts = line.split("\t")
                if len(parts) >= 5 and not parts[0].startswith("\t"):
                    current_iface = {
                        "name": parts[0],
                        "publicKey": parts[1],
                        "listenPort": int(parts[2]) if parts[2].isdigit() else 0,
                        "peers": [],
                    }
                    interfaces.append(current_iface)
                elif current_iface and len(parts) >= 4:
                    current_iface["peers"].append({
                        "publicKey": parts[0],
                        "endpoint": parts[2],
                        "allowedIPs": parts[3],
                        "lastHandshake": int(parts[4]) if len(parts) > 4 and parts[4].isdigit() else 0,
                    })
    except Exception:
        logger.debug("Failed to read WireGuard interfaces", exc_info=True)
    return {"interfaces": interfaces}


@router.post("/network/interfaces/{name}")
async def update_interface(name: str, body: dict):
    """Apply network interface configuration using the `ip` command."""
    if not _IFACE_RE.match(name):
        raise HTTPException(400, "Invalid interface name")

    applied = []
    errors = []

    state = body.get("state")
    if state in ("up", "down"):
        try:
            await asyncio.to_thread(
                subprocess.run,
                ["ip", "link", "set", name, state],
                capture_output=True, timeout=5, shell=False, check=True
            )
            applied.append(f"link {state}")
        except subprocess.CalledProcessError as exc:
            stderr_output = exc.stderr.decode(errors="replace").strip() if isinstance(exc.stderr, bytes) else str(exc.stderr or "").strip()
            errors.append(f"Could not set link {state}: {stderr_output or 'command failed'}")
        except FileNotFoundError:
            errors.append("'ip' command not available")

    address = body.get("address")
    prefix = body.get("prefix", 24)
    if address and isinstance(prefix, int):
        try:
            await asyncio.to_thread(
                subprocess.run,
                ["ip", "addr", "add", f"{address}/{prefix}", "dev", name],
                capture_output=True, timeout=5, shell=False, check=True
            )
            applied.append(f"addr {address}/{prefix}")
        except subprocess.CalledProcessError as exc:
            stderr_output = exc.stderr.decode(errors="replace").strip() if isinstance(exc.stderr, bytes) else str(exc.stderr or "").strip()
            errors.append(f"Could not set address: {stderr_output or 'command failed'}")
        except FileNotFoundError:
            errors.append("'ip' command not available")

    if errors:
        return {"success": False, "interface": name, "applied": applied, "errors": errors}
    if not applied:
        return {"success": True, "interface": name, "message": "No changes requested"}
    return {"success": True, "interface": name, "applied": applied}
