"""Multi-Tenant LXC Quota API routes (v1.3.0).

CRUD endpoints for per-tenant LXC container resource quotas (CPU, RAM,
disk, IO, network, processes). Enforces a maximum tenant count per node.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..config import LXC_QUOTA_ENABLED
from ..lxc_manager import lxc_quota_manager
from ..models import LXCQuota

router = APIRouter()


@router.get("/lxc/status")
async def lxc_status() -> dict[str, Any]:
    """Return LXC quota manager status."""
    return {
        "enabled": LXC_QUOTA_ENABLED,
        "lxcAvailable": lxc_quota_manager.lxc_available,
        "maxTenants": lxc_quota_manager._max_tenants,
        "currentTenants": len(lxc_quota_manager.list_tenants()),
    }


@router.get("/lxc/tenants")
async def list_tenants() -> dict[str, Any]:
    """List all LXC tenants and their quotas."""
    tenants = lxc_quota_manager.list_tenants()
    return {
        "tenants": [t.model_dump(by_alias=True) for t in tenants],
        "count": len(tenants),
    }


@router.post("/lxc/tenants")
async def create_tenant(quota: LXCQuota) -> dict[str, Any]:
    """Create a new LXC tenant with resource quotas."""
    if not LXC_QUOTA_ENABLED:
        raise HTTPException(503, "LXC quota management is disabled")
    try:
        result = lxc_quota_manager.create_tenant(quota)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return {"success": True, "tenant": result.model_dump(by_alias=True)}


@router.get("/lxc/tenants/{tenant_id}")
async def get_tenant(tenant_id: str) -> dict[str, Any]:
    quota = lxc_quota_manager.get_quota(tenant_id)
    if quota is None:
        raise HTTPException(404, f"Tenant not found: {tenant_id}")
    return quota.model_dump(by_alias=True)


@router.put("/lxc/tenants/{tenant_id}")
async def update_tenant(tenant_id: str, updates: dict) -> dict[str, Any]:
    if lxc_quota_manager.get_quota(tenant_id) is None:
        raise HTTPException(404, f"Tenant not found: {tenant_id}")
    try:
        result = lxc_quota_manager.update_quota(tenant_id, updates)
    except (KeyError, ValueError) as exc:
        raise HTTPException(400, str(exc))
    return {"success": True, "tenant": result.model_dump(by_alias=True)}


@router.delete("/lxc/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str) -> dict[str, Any]:
    if not lxc_quota_manager.remove_tenant(tenant_id):
        raise HTTPException(404, f"Tenant not found: {tenant_id}")
    return {"success": True, "tenantId": tenant_id}


@router.get("/lxc/tenants/{tenant_id}/usage")
async def get_tenant_usage(tenant_id: str) -> dict[str, Any]:
    """Get current resource usage for a tenant."""
    try:
        usage = lxc_quota_manager.get_usage(tenant_id)
    except KeyError:
        raise HTTPException(404, f"Tenant not found: {tenant_id}")
    return usage.model_dump(by_alias=True)


@router.get("/lxc/usage")
async def get_all_usage() -> dict[str, Any]:
    """Get resource usage for all tenants."""
    usages = lxc_quota_manager.get_all_usage()
    return {
        "usages": [u.model_dump(by_alias=True) for u in usages],
        "count": len(usages),
    }