"""Syslog endpoints — reads from systemd-journald when available."""
from __future__ import annotations

import json
import subprocess
import time
from typing import Any

from fastapi import APIRouter, Query

router = APIRouter()


def _read_journal(limit: int = 100, unit: str | None = None) -> list[dict[str, Any]]:
    """Read journal entries using journalctl --output=json."""
    cmd = [
        "journalctl",
        f"-n", str(limit),
        "--output=json",
        "--no-pager",
    ]
    if unit:
        cmd += ["-u", unit]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=10, shell=False
        )
        if result.returncode != 0:
            return []
        entries = []
        for line in result.stdout.splitlines():
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
                entries.append(entry)
            except json.JSONDecodeError:
                continue
        return entries
    except Exception:
        return []


def _journal_to_syslog(entry: dict[str, Any]) -> dict[str, Any]:
    priority_map = {
        "0": "emerg", "1": "alert", "2": "crit", "3": "err",
        "4": "warning", "5": "notice", "6": "info", "7": "debug",
    }
    facility_map = {
        "0": "kern", "1": "user", "2": "mail", "3": "daemon",
        "4": "auth", "5": "syslog", "6": "lpr", "7": "news",
        "8": "uucp", "9": "cron", "10": "authpriv",
    }
    priority = str(entry.get("PRIORITY", "6"))
    facility_num = str(entry.get("SYSLOG_FACILITY", "3"))
    ts_us = int(entry.get("__REALTIME_TIMESTAMP", time.time() * 1_000_000))
    return {
        "id": entry.get("__CURSOR", ""),
        "timestamp": ts_us // 1000,
        "facility": facility_map.get(facility_num, "daemon"),
        "severity": priority_map.get(priority, "info"),
        "process": entry.get("SYSLOG_IDENTIFIER") or entry.get("_COMM", "unknown"),
        "pid": entry.get("_PID"),
        "message": entry.get("MESSAGE", ""),
        "hostname": entry.get("_HOSTNAME", ""),
    }


@router.get("/syslog")
async def get_syslog(
    limit: int = Query(default=100, le=500),
    facility: str = Query(default=None),
    severity: str = Query(default=None),
    process: str = Query(default=None),
    search: str = Query(default=None),
):
    entries = _read_journal(limit=min(limit * 3, 1500))
    logs = [_journal_to_syslog(e) for e in entries]

    if facility:
        logs = [l for l in logs if l.get("facility") == facility]
    if severity:
        logs = [l for l in logs if l.get("severity") == severity]
    if process:
        logs = [l for l in logs if process.lower() in (l.get("process") or "").lower()]
    if search:
        search_lower = search.lower()
        logs = [l for l in logs if search_lower in (l.get("message") or "").lower()]

    return {"logs": logs[:limit]}


@router.get("/syslog/stats")
async def syslog_stats():
    entries = _read_journal(limit=1000)
    logs = [_journal_to_syslog(e) for e in entries]

    facilities: dict[str, int] = {}
    severities: dict[str, int] = {}
    for l in logs:
        f = l.get("facility", "unknown")
        s = l.get("severity", "info")
        facilities[f] = facilities.get(f, 0) + 1
        severities[s] = severities.get(s, 0) + 1

    return {"totalEntries": len(logs), "facilities": facilities, "severities": severities}


@router.get("/syslog/processes")
async def syslog_processes():
    entries = _read_journal(limit=1000)
    logs = [_journal_to_syslog(e) for e in entries]
    procs = sorted({l.get("process", "unknown") for l in logs if l.get("process")})
    return {"processes": procs}
