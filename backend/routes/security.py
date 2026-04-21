"""Security endpoints — dashboard, policies, audit, integrity, threats."""
from __future__ import annotations

import hashlib
import os
import subprocess
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Query

from ..rate_limiter import security_check_limiter, rate_limit_dependency

router = APIRouter()

# In-memory audit log (real events recorded during runtime)
_audit_log: list[dict[str, Any]] = []
_threats: list[dict[str, Any]] = []
_next_audit_id = 1


def _record_audit(event_type: str, action: str, result: str, message: str = "") -> None:
    global _next_audit_id
    _audit_log.append({
        "id": f"audit-{_next_audit_id}",
        "timestamp": int(time.time() * 1000),
        "type": event_type,
        "action": action,
        "result": result,
        "message": message or f"{event_type}: {action} => {result}",
    })
    _next_audit_id += 1
    if len(_audit_log) > 10000:
        del _audit_log[:5000]


def _get_firewall_status() -> dict[str, Any]:
    """Try to detect firewall status from iptables/nftables/ufw."""
    active = False
    policy = "deny"
    rules_count = 0

    # Try nftables first
    try:
        result = subprocess.run(
            ["nft", "list", "ruleset"],
            capture_output=True, text=True, timeout=3, shell=False
        )
        if result.returncode == 0 and result.stdout.strip():
            active = True
            rules_count = result.stdout.count("rule")
    except Exception:
        pass

    # Try iptables if nft not available
    if not active:
        try:
            result = subprocess.run(
                ["iptables", "-L", "-n", "--line-numbers"],
                capture_output=True, text=True, timeout=3, shell=False
            )
            if result.returncode == 0:
                active = True
                lines = [ln for ln in result.stdout.splitlines() if ln and not ln.startswith("Chain") and not ln.startswith("target")]
                rules_count = len(lines)
                if "policy DROP" in result.stdout or "policy REJECT" in result.stdout:
                    policy = "deny"
                elif "policy ACCEPT" in result.stdout:
                    policy = "accept"
        except Exception:
            pass

    # Try ufw
    if not active:
        try:
            result = subprocess.run(
                ["ufw", "status"],
                capture_output=True, text=True, timeout=3, shell=False
            )
            if result.returncode == 0:
                active = "active" in result.stdout.lower()
        except Exception:
            pass

    return {"active": active, "policy": policy, "rulesCount": rules_count}


def _hash_file(path: str) -> str | None:
    """Compute SHA-256 of a file, returning None if not readable."""
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


# Integrity baseline: populated on first call
_integrity_baseline: dict[str, str] = {}
_integrity_checked_at: int = 0

# Files to monitor for integrity
_MONITORED_PATHS = [
    "/boot/config.txt",
    "/boot/firmware/config.txt",
    "/boot/cmdline.txt",
    "/boot/firmware/cmdline.txt",
    "/etc/hosts",
    "/etc/passwd",
    "/etc/ssh/sshd_config",
]

# Privileged files: only monitored when readable (requires root)
_PRIVILEGED_MONITORED_PATHS = [
    "/etc/shadow",
    "/etc/sudoers",
]


def _build_integrity_baseline() -> None:
    global _integrity_baseline, _integrity_checked_at
    _integrity_baseline = {}
    all_paths = list(_MONITORED_PATHS) + [
        p for p in _PRIVILEGED_MONITORED_PATHS
        if os.access(p, os.R_OK)
    ]
    for p in all_paths:
        h = _hash_file(p)
        if h is not None:
            _integrity_baseline[p] = h
    _integrity_checked_at = int(time.time() * 1000)


@router.get("/security/dashboard")
async def security_dashboard():
    fw = _get_firewall_status()
    open_threats = len([t for t in _threats if not t.get("mitigated")])
    failed_logins = len([
        e for e in _audit_log
        if e.get("type") == "auth" and e.get("result") == "failure"
        and e.get("timestamp", 0) > (int(time.time() * 1000) - 86400000)
    ])
    blocked = len([
        e for e in _audit_log
        if e.get("type") == "network" and e.get("result") == "denied"
        and e.get("timestamp", 0) > (int(time.time() * 1000) - 86400000)
    ])
    # Calculate an overall security score from real indicators
    score = 100
    if not fw["active"]:
        score -= 20
    if open_threats > 0:
        score -= min(open_threats * 5, 30)
    if failed_logins > 5:
        score -= 10

    return {
        "threatLevel": "critical" if open_threats > 5 else "high" if open_threats > 2 else "medium" if open_threats > 0 else "none",
        "openThreats": open_threats,
        "failedLogins24h": failed_logins,
        "blockedConnections24h": blocked,
        "overallScore": max(score, 0),
        "activePolicies": 3,
        "firewallActive": fw["active"],
        "firewallPolicy": fw["policy"],
        "vpnActive": Path("/sys/class/net/wg0").exists(),
        "auditingEnabled": True,
        "integrityStatus": "valid" if _integrity_baseline else "unchecked",
        "lastScan": _integrity_checked_at,
        "policyCount": 3,
        "selinuxMode": _get_selinux_mode(),
    }


def _get_selinux_mode() -> str:
    try:
        result = subprocess.run(
            ["getenforce"], capture_output=True, text=True, timeout=2, shell=False
        )
        return result.stdout.strip().lower() if result.returncode == 0 else "unknown"
    except Exception:
        return "unknown"


@router.get("/security/policies")
async def security_policies():
    fw = _get_firewall_status()
    selinux = _get_selinux_mode()
    return {
        "policies": [
            {
                "id": "firewall",
                "name": "Firewall",
                "status": "enforced" if fw["active"] else "inactive",
                "type": "network",
                "enabled": fw["active"],
                "mode": "MAC",
                "description": f"Network firewall — {fw['rulesCount']} rules, default {fw['policy']}",
                "rules": [],
            },
            {
                "id": "selinux",
                "name": "SELinux / AppArmor",
                "status": selinux if selinux not in ("unknown", "") else "inactive",
                "type": "mac",
                "enabled": selinux not in ("disabled", "unknown", ""),
                "mode": "MAC",
                "description": f"Mandatory access control — mode: {selinux}",
                "rules": [],
            },
            {
                "id": "ssh-hardening",
                "name": "SSH Hardening",
                "status": "enforced" if _sshd_hardened() else "partial",
                "type": "access",
                "enabled": True,
                "mode": "DAC",
                "description": "SSH server configuration hardening",
                "rules": [],
            },
        ]
    }


def _sshd_hardened() -> bool:
    """Return True if common SSH hardening options are set."""
    try:
        cfg = Path("/etc/ssh/sshd_config").read_text(errors="replace")
        return "PermitRootLogin no" in cfg or "PasswordAuthentication no" in cfg
    except Exception:
        return False


@router.get("/security/audit")
async def security_audit(
    limit: int = Query(default=100, le=500),
    type: str = Query(default=None),
):
    events = _audit_log
    if type:
        events = [e for e in events if e.get("type") == type]
    return {"events": list(reversed(events[-limit:]))}


@router.get("/security/profiles")
async def security_profiles():
    """Return running processes with notable capability/privilege info."""
    profiles = []
    try:
        result = subprocess.run(
            ["ps", "-eo", "pid,user,comm,args", "--no-headers"],
            capture_output=True, text=True, timeout=5, shell=False
        )
        for line in result.stdout.splitlines()[:50]:
            parts = line.split(None, 3)
            if len(parts) >= 3:
                profiles.append({
                    "name": parts[2],
                    "pid": int(parts[0]) if parts[0].isdigit() else 0,
                    "user": parts[1],
                    "capabilities": [],
                    "seccompFilter": "system",
                    "noNewPrivileges": False,
                })
    except Exception:
        pass
    return {"profiles": profiles}


@router.get("/security/integrity", dependencies=[Depends(rate_limit_dependency(security_check_limiter))])
async def verify_integrity():
    """Compute SHA-256 of monitored files and compare against baseline."""
    if not _integrity_baseline:
        _build_integrity_baseline()

    results = []
    violations = []
    for path, expected_hash in _integrity_baseline.items():
        actual_hash = _hash_file(path)
        valid = actual_hash == expected_hash
        results.append({
            "path": path,
            "expectedHash": expected_hash,
            "actualHash": actual_hash or "",
            "algorithm": "sha256",
            "valid": valid,
            "checkedAt": int(time.time() * 1000),
        })
        if not valid:
            violations.append(path)

    # Record the check in audit log
    _record_audit(
        "integrity", "filesystem-check",
        "success" if not violations else "warning",
        f"Checked {len(results)} files; {len(violations)} violation(s)"
    )

    return {
        "status": "verified" if not violations else "violations-detected",
        "checkedFiles": len(results),
        "violations": violations,
        "results": results,
        "valid": len(violations) == 0,
    }


@router.get("/security/threats")
async def get_threats():
    return {"threats": _threats, "open": len([t for t in _threats if not t.get("mitigated")])}
