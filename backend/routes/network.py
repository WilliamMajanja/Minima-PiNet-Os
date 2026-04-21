"""Network management endpoints."""
from __future__ import annotations

import psutil
from fastapi import APIRouter

router = APIRouter()


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
    return {"routes": [], "note": "Routing table requires platform-specific commands"}


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
        pass
    return {"servers": dns_servers or ["8.8.8.8", "8.8.4.4"]}


@router.get("/network/firewall")
async def get_firewall():
    return {"rules": [], "defaultPolicy": "deny"}


@router.get("/network/wireguard")
async def get_wireguard():
    return {"interfaces": []}


@router.post("/network/interfaces/{name}")
async def update_interface(name: str, body: dict):
    return {"success": True, "note": f"Interface {name} configuration updated (simulated)"}
