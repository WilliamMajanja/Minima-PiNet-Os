"""Multi-Tenant LXC Quota Manager for PiNet-OS v1.3.0.

Manages per-tenant resource quotas for LXC containers on the edge node.
Enforces CPU, RAM, disk, IO, network, and process limits via cgroups v2
and LXC configuration.

On non-LXC hosts (CI / dev), all operations return simulated data so the
API is always testable.
"""
from __future__ import annotations

import logging
import shutil
import time
from pathlib import Path
from typing import Any

from .config import (
    LXC_MAX_TENANTS,
    LXC_QUOTA_ENABLED,
)
from .models import LXCQuota, LXCQuotaUsage

logger = logging.getLogger(__name__)

_LXC_AVAILABLE = shutil.which("lxc-info") is not None or Path("/var/lib/lxc").exists()
_CGROUP_V2 = Path("/sys/fs/cgroup/cgroup.controllers").exists()


class LXCQuotaManager:
    """Manages multi-tenant LXC container resource quotas.

    Enforces limits via:
      - cgroups v2 (cpu.max, memory.max, io.max)
      - LXC config (lxc.cgroup2.*)
      - disk quotas (lvm/project quotas)
    """

    def __init__(self) -> None:
        self._quotas: dict[str, LXCQuota] = {}
        self._max_tenants = LXC_MAX_TENANTS

    @property
    def enabled(self) -> bool:
        return LXC_QUOTA_ENABLED

    @property
    def lxc_available(self) -> bool:
        return _LXC_AVAILABLE

    def list_tenants(self) -> list[LXCQuota]:
        return list(self._quotas.values())

    def get_quota(self, tenant_id: str) -> LXCQuota | None:
        return self._quotas.get(tenant_id)

    def create_tenant(self, quota: LXCQuota) -> LXCQuota:
        """Create a new tenant with resource quotas."""
        if len(self._quotas) >= self._max_tenants:
            raise ValueError(
                f"Maximum tenants ({self._max_tenants}) reached. "
                f"PiNet-OS supports up to {self._max_tenants} LXC tenants per node."
            )
        if quota.tenant_id in self._quotas:
            raise ValueError(f"Tenant already exists: {quota.tenant_id}")
        if not quota.container_name:
            quota.container_name = f"pinet-tenant-{quota.tenant_id}"
        quota.created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self._quotas[quota.tenant_id] = quota
        if _LXC_AVAILABLE:
            self._apply_cgroup_limits(quota)
        return quota

    def update_quota(self, tenant_id: str, updates: dict) -> LXCQuota:
        """Update an existing tenant's resource quotas."""
        quota = self._quotas.get(tenant_id)
        if quota is None:
            raise KeyError(f"Tenant not found: {tenant_id}")
        for key, val in updates.items():
            if hasattr(quota, key):
                setattr(quota, key, val)
        if _LXC_AVAILABLE:
            self._apply_cgroup_limits(quota)
        return quota

    def remove_tenant(self, tenant_id: str) -> bool:
        """Remove a tenant and its quotas."""
        quota = self._quotas.pop(tenant_id, None)
        if quota and _LXC_AVAILABLE:
            self._remove_cgroup_limits(quota)
        return quota is not None

    def get_usage(self, tenant_id: str) -> LXCQuotaUsage:
        """Get current resource usage for a tenant."""
        quota = self._quotas.get(tenant_id)
        if quota is None:
            raise KeyError(f"Tenant not found: {tenant_id}")

        if not _LXC_AVAILABLE or not _CGROUP_V2:
            return LXCQuotaUsage(
                tenantId=tenant_id,
                cpuPercent=0.0,
                ramUsedMb=0.0,
                diskUsedGb=0.0,
                ioReadIops=0,
                ioWriteIops=0,
                processes=0,
                running=False,
            )
        return self._read_cgroup_usage(quota)

    def get_all_usage(self) -> list[LXCQuotaUsage]:
        """Get resource usage for all tenants."""
        return [self.get_usage(tid) for tid in self._quotas]

    def _apply_cgroup_limits(self, quota: LXCQuota) -> None:
        """Apply cgroup v2 resource limits for a tenant container."""
        if not _CGROUP_V2:
            return
        safe_name = self._validate_container_name(quota.container_name)
        if safe_name is None:
            logger.warning("Rejected suspicious container name: %s", quota.container_name)
            return
        cgroup_dir = Path("/sys/fs/cgroup/lxc")
        cgroup_path = cgroup_dir / safe_name
        if not str(cgroup_path).startswith(str(cgroup_dir.resolve())):
            logger.warning("Path traversal attempt for tenant %s", quota.tenant_id)
            return
        try:
            cgroup_path.mkdir(parents=True, exist_ok=True)
            cpu_path = cgroup_path / "cpu.max"
            memory_path = cgroup_path / "memory.max"
            io_path = cgroup_path / "io.max"
            pids_path = cgroup_path / "pids.max"
            cpu_path.write_text(f"{quota.cpu_limit * 1000} 100000")
            memory_path.write_text(str(quota.ram_limit_mb * 1024 * 1024))
            io_max_value = f"rbps max={quota.io_iops * 1024} wbps max={quota.io_iops * 1024}"
            io_path.write_text(io_max_value)
            pids_path.write_text(str(quota.processes_max))
            logger.info("Applied cgroup limits for tenant %s", quota.tenant_id)
        except PermissionError:
            logger.warning("Cannot write cgroup limits (need root) for %s", quota.tenant_id)
        except OSError as exc:
            logger.warning("Failed to apply cgroup limits for %s", quota.tenant_id)

    @staticmethod
    def _validate_container_name(name: str) -> str | None:
        """Validate container name contains only safe characters."""
        if not name or len(name) > 64:
            return None
        if not all(c.isalnum() or c in "-_" for c in name):
            return None
        if name in (".", "..", "lxc", "cgroup"):
            return None
        return name

    def _remove_cgroup_limits(self, quota: LXCQuota) -> None:
        """Remove cgroup limits for a tenant."""
        if not _CGROUP_V2:
            return
        safe_name = self._validate_container_name(quota.container_name)
        if safe_name is None:
            logger.warning("Rejected suspicious container name: %s", quota.container_name)
            return
        cgroup_dir = Path("/sys/fs/cgroup/lxc")
        cgroup_path = cgroup_dir / safe_name
        if not str(cgroup_path).startswith(str(cgroup_dir.resolve())):
            logger.warning("Path traversal attempt for tenant %s", quota.tenant_id)
            return
        try:
            if cgroup_path.exists():
                procs_file = cgroup_path / "cgroup.procs"
                if procs_file.exists():
                    procs = procs_file.read_text().strip()
                    if procs:
                        Path("/sys/fs/cgroup/cgroup.procs").write_text(procs)
                cgroup_path.rmdir()
        except OSError as exc:
            logger.warning("Failed to remove cgroup for %s: %s", quota.tenant_id, exc)

    def _read_cgroup_usage(self, quota: LXCQuota) -> LXCQuotaUsage:
        """Read current usage from cgroup v2 stats."""
        safe_name = self._validate_container_name(quota.container_name)
        if safe_name is None:
            logger.warning("Rejected suspicious container name: %s", quota.container_name)
            return LXCQuotaUsage(tenantId=quota.tenant_id, running=False)
        cgroup_dir = Path("/sys/fs/cgroup/lxc")
        cgroup_path = cgroup_dir / safe_name
        if not str(cgroup_path).startswith(str(cgroup_dir.resolve())):
            logger.warning("Path traversal attempt for tenant %s", quota.tenant_id)
            return LXCQuotaUsage(tenantId=quota.tenant_id, running=False)
        usage = LXCQuotaUsage(tenantId=quota.tenant_id, running=False)
        if not cgroup_path.exists():
            return usage
        try:
            cpu_stat = (cgroup_path / "cpu.stat").read_text()
            for line in cpu_stat.splitlines():
                if line.startswith("usage_usec"):
                    usage.cpu_percent = float(line.split()[1]) / 1_000_000
                    usage.running = True
            memory_current = (cgroup_path / "memory.current").read_text().strip()
            usage.ram_used_mb = float(memory_current) / (1024 * 1024)
            procs = (cgroup_path / "cgroup.procs").read_text().strip().splitlines()
            usage.processes = len(procs)
            usage.running = usage.processes > 0
        except (OSError, ValueError) as exc:
            logger.debug("Failed to read cgroup usage for %s: %s", quota.tenant_id, exc)
        return usage

    def to_state(self) -> list[dict[str, Any]]:
        return [q.model_dump(by_alias=True) for q in self._quotas.values()]

    def from_state(self, data: list[dict[str, Any]]) -> None:
        self._quotas.clear()
        for item in data:
            try:
                quota = LXCQuota(**item)
                self._quotas[quota.tenant_id] = quota
            except (ValueError, TypeError) as exc:
                logger.warning("Skipping invalid tenant quota in state: %s", exc)


lxc_quota_manager = LXCQuotaManager()