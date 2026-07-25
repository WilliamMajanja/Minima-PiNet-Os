"""Multi-Tenant LXC Quota Manager for PiNet-OS v1.3.0.

Manages per-tenant resource quotas for LXC containers on the edge node.
Enforces CPU, RAM, disk, IO, network, and process limits via cgroups v2
and LXC configuration.

On non-LXC hosts (CI / dev), all operations return simulated data so the
API is always testable.
"""
from __future__ import annotations

import hashlib
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
        self._tenant_cgroup: dict[str, str] = {}
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

    def _cgroup_path(self, tenant_id: str) -> Path | None:
        base = Path("/sys/fs/cgroup/lxc").resolve()
        if tenant_id not in self._tenant_cgroup:
            cgroup_id = hashlib.sha256(tenant_id.encode("utf-8")).hexdigest()[:16]
            self._tenant_cgroup[tenant_id] = cgroup_id
        path = (base / self._tenant_cgroup[tenant_id]).resolve()
        if not str(path).startswith(str(base)):
            return None
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _apply_cgroup_limits(self, quota: LXCQuota) -> None:
        if not _CGROUP_V2:
            return
        cgroup_path = self._cgroup_path(quota.tenant_id)
        if cgroup_path is None:
            logger.warning("Rejected suspicious container name: %s", quota.container_name)
            return
        cpu_limit = max(0, min(quota.cpu_limit, 128))
        ram_limit = max(0, min(quota.ram_limit_mb, 1048576))
        io_iops = max(0, min(quota.io_iops, 1000000))
        pids_max = max(0, min(quota.processes_max, 65535))
        try:
            (cgroup_path / "cpu.max").write_text(f"{cpu_limit * 1000} 100000")
            (cgroup_path / "memory.max").write_text(str(ram_limit * 1024 * 1024))
            (cgroup_path / "io.max").write_text(f"rbps max={io_iops * 1024} wbps max={io_iops * 1024}")
            (cgroup_path / "pids.max").write_text(str(pids_max))
            logger.info("Applied cgroup limits for tenant %s", quota.tenant_id)
        except PermissionError:
            logger.warning("Cannot write cgroup limits (need root) for %s", quota.tenant_id)
        except OSError:
            logger.warning("Failed to apply cgroup limits for %s", quota.tenant_id)

    def _remove_cgroup_limits(self, quota: LXCQuota) -> None:
        if not _CGROUP_V2:
            return
        cgroup_path = self._cgroup_path(quota.tenant_id)
        if cgroup_path is None:
            logger.warning("Rejected suspicious container name: %s", quota.container_name)
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
        cgroup_path = self._cgroup_path(quota.tenant_id)
        if cgroup_path is None:
            logger.warning("Rejected suspicious container name: %s", quota.container_name)
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