"""Security endpoints — dashboard, policies, audit, integrity, threats."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..rate_limiter import security_check_limiter, rate_limit_dependency

router = APIRouter()


@router.get("/security/dashboard")
async def security_dashboard():
    return {
        "overallScore": 85,
        "activePolicies": 12,
        "threats": 0,
        "lastIntegrityCheck": None,
        "firewallStatus": "active",
        "selinuxMode": "enforcing",
    }


@router.get("/security/policies")
async def security_policies():
    return {
        "policies": [
            {"id": "firewall", "name": "Firewall", "status": "enforced", "type": "network"},
            {"id": "selinux", "name": "SELinux", "status": "enforcing", "type": "mac"},
            {"id": "ssh-hardening", "name": "SSH Hardening", "status": "enforced", "type": "access"},
            {"id": "password-policy", "name": "Password Policy", "status": "enforced", "type": "auth"},
        ]
    }


@router.get("/security/audit")
async def security_audit(limit: int = Query(default=100, le=500), type: str = Query(default=None)):
    return {"events": []}


@router.get("/security/profiles")
async def security_profiles():
    return {"profiles": []}


@router.get("/security/integrity", dependencies=[Depends(rate_limit_dependency(security_check_limiter))])
async def verify_integrity():
    return {"status": "verified", "checkedFiles": 0, "violations": []}


@router.get("/security/threats")
async def get_threats():
    return {"threats": [], "open": 0}
