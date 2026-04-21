"""In-memory per-IP rate limiter with bounded memory — ported from server.ts."""
from __future__ import annotations
import time
from collections import defaultdict
from typing import Callable
from fastapi import Request, HTTPException


class RateLimiter:
    """Simple in-memory per-key rate limiter."""

    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> bool:
        now = time.time()
        timestamps = self._requests[key]
        recent = [t for t in timestamps if now - t < self.window_seconds]
        if len(recent) >= self.max_requests:
            self._requests[key] = recent
            return False
        recent.append(now)
        self._requests[key] = recent
        # Prune stale entries
        if len(self._requests) > 10000:
            to_delete = [
                k for k, ts in self._requests.items()
                if not any(now - t < self.window_seconds for t in ts)
            ]
            for k in to_delete:
                del self._requests[k]
        return True


def rate_limit_dependency(limiter: RateLimiter) -> Callable:
    """FastAPI dependency that enforces rate limiting."""
    async def _check(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        if not limiter.check(client_ip):
            raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
    return _check


# Pre-configured limiters (matching server.ts)
fs_read_limiter = RateLimiter(60, 60)
fs_write_limiter = RateLimiter(20, 60)
os_info_limiter = RateLimiter(30, 60)
exec_rate_limiter = RateLimiter(10, 60)
sys_exec_limiter = RateLimiter(5, 60)
dapp_install_limiter = RateLimiter(10, 60)
dapp_serve_limiter = RateLimiter(120, 60)
auth_login_limiter = RateLimiter(5, 60)
security_check_limiter = RateLimiter(10, 60)
