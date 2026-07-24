"""CPIP Version Watcher for PiNet-OS.

Background process that continuously monitors for new CPIP versions
via GitHub releases API and local file changes. When a new version
is detected, it can auto-update, notify via webhook, or both.

Features:
  - GitHub release polling (configurable interval)
  - Local version file watching (inotify-style via stat mtime)
  - Webhook callback notifications on new versions
  - SSE (Server-Sent Events) streaming for real-time UI updates
  - Automatic update with rollback on failure
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .config import (
    CPIP_ENABLED,
    CPIP_GITHUB_REPO,
    CPIP_VERSION,
    GITHUB_TOKEN,
)

logger = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────────────────

CPIP_WATCHER_ENABLED = os.getenv("CPIP_WATCHER_ENABLED", "1") == "1"
CPIP_WATCHER_POLL_INTERVAL = int(os.getenv("CPIP_WATCHER_POLL_INTERVAL", "21600"))  # 6h
CPIP_WATCHER_VERSION_FILE = os.getenv(
    "CPIP_WATCHER_VERSION_FILE",
    os.path.expanduser("~/.local/share/pinet/cpip-version.json"),
)
CPIP_WATCHER_WEBHOOK_URL = os.getenv("CPIP_WATCHER_WEBHOOK_URL", "")
CPIP_WATCHER_WEBHOOK_SECRET = os.getenv("CPIP_WATCHER_WEBHOOK_SECRET", "")
CPIP_WATCHER_AUTO_UPDATE = os.getenv("CPIP_WATCHER_AUTO_UPDATE", "1") == "1"
CPIP_WATCHER_ROLLBACK_ON_FAIL = os.getenv("CPIP_WATCHER_ROLLBACK", "1") == "1"
CPIP_WATCHER_STATE_DIR = os.getenv(
    "CPIP_WATCHER_STATE_DIR",
    os.path.expanduser("~/.local/share/pinet"),
)

# ─── State ────────────────────────────────────────────────────────────────────


@dataclass
class WatcherState:
    """Runtime state of the CPIP watcher."""

    running: bool = False
    last_check: float = 0.0
    last_update: float = 0.0
    last_version: str = ""
    check_count: int = 0
    update_count: int = 0
    error_count: int = 0
    last_error: str = ""
    subscribers: list[Callable[..., Any]] = field(default_factory=list)


_watcher_state = WatcherState()


def get_watcher_state() -> dict[str, Any]:
    """Return current watcher state as a dict."""
    return {
        "running": _watcher_state.running,
        "enabled": CPIP_WATCHER_ENABLED,
        "poll_interval": CPIP_WATCHER_POLL_INTERVAL,
        "auto_update": CPIP_WATCHER_AUTO_UPDATE,
        "last_check": _watcher_state.last_check,
        "last_update": _watcher_state.last_update,
        "last_version": _watcher_state.last_version,
        "check_count": _watcher_state.check_count,
        "update_count": _watcher_state.update_count,
        "error_count": _watcher_state.error_count,
        "last_error": _watcher_state.last_error,
        "webhook_configured": bool(CPIP_WATCHER_WEBHOOK_URL),
        "installed_version": CPIP_VERSION,
    }


# ─── Version File Watcher ────────────────────────────────────────────────────


def _read_version_file() -> dict[str, Any]:
    """Read the local version file."""
    try:
        path = Path(CPIP_WATCHER_VERSION_FILE)
        if path.exists():
            return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        logger.debug("Failed to read version file: %s", exc)
    return {}


def _write_version_file(version: str, source: str = "auto") -> None:
    """Write version info to the local file."""
    try:
        path = Path(CPIP_WATCHER_VERSION_FILE)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({
            "version": version,
            "source": source,
            "timestamp": time.time(),
        }, indent=2))
    except OSError as exc:
        logger.warning("Failed to write version file: %s", exc)


def _check_version_file_changed() -> str | None:
    """Check if the local version file has been updated externally.

    Returns the new version string if changed, None otherwise.
    """
    data = _read_version_file()
    version = data.get("version", "")
    if version and version != _watcher_state.last_version:
        return version
    return None


# ─── GitHub Polling ──────────────────────────────────────────────────────────


def _github_get_latest_release() -> dict[str, Any] | None:
    """Fetch the latest tag from GitHub API (not releases/latest)."""
    import urllib.request

    url = f"https://api.github.com/repos/{CPIP_GITHUB_REPO}/tags"
    headers: dict[str, str] = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "PiNet-OS-CPIP-Watcher",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    req = urllib.request.Request(url, headers=headers)  # noqa: S310
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310
            data = json.loads(resp.read().decode())
            # /tags returns a list; first entry is the most recent
            if isinstance(data, list) and len(data) > 0:
                return data[0]
            return None
    except Exception as exc:
        logger.error("GitHub API request failed: %s", exc)
        return None


def _parse_version(v: str) -> tuple[int, ...]:
    """Parse a semver string into a comparable tuple."""
    parts = v.strip().lstrip("v").split(".")
    result: list[int] = []
    for p in parts:
        digits = "".join(c for c in p if c.isdigit())
        if digits:
            result.append(int(digits))
    return tuple(result)


# ─── Webhook Notifications ───────────────────────────────────────────────────


def _send_webhook_notification(
    event: str,
    data: dict[str, Any],
) -> bool:
    """Send a webhook notification about a CPIP event."""
    if not CPIP_WATCHER_WEBHOOK_URL:
        return False

    import hashlib
    import hmac
    import urllib.request

    payload = json.dumps({
        "event": event,
        "timestamp": time.time(),
        "source": "pinet-cpip-watcher",
        **data,
    }).encode()

    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "User-Agent": "PiNet-OS-CPIP-Watcher",
    }

    if CPIP_WATCHER_WEBHOOK_SECRET:
        sig = hmac.new(
            CPIP_WATCHER_WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        headers["X-CPIP-Signature"] = f"sha256={sig}"

    req = urllib.request.Request(
        CPIP_WATCHER_WEBHOOK_URL,
        data=payload,
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201, 204)
    except Exception as exc:
        logger.error("Webhook notification failed: %s", exc)
        return False


# ─── SSE Subscribers ─────────────────────────────────────────────────────────


def subscribe_sse(callback: Callable[..., Any]) -> None:
    """Register a callback for SSE events."""
    _watcher_state.subscribers.append(callback)


def unsubscribe_sse(callback: Callable[..., Any]) -> None:
    """Unregister an SSE callback."""
    _watcher_state.subscribers = [s for s in _watcher_state.subscribers if s is not callback]


def _broadcast_event(event: str, data: dict[str, Any]) -> None:
    """Broadcast an event to all SSE subscribers."""
    message = f"event: {event}\ndata: {json.dumps(data)}\n\n"
    dead: list[Callable[..., Any]] = []
    for subscriber in _watcher_state.subscribers:
        try:
            subscriber(message)
        except Exception:
            dead.append(subscriber)
    for d in dead:
        _watcher_state.subscribers = [s for s in _watcher_state.subscribers if s is not d]


# ─── Core Watch Loop ─────────────────────────────────────────────────────────


async def _watch_iteration() -> None:
    """Perform a single watch iteration."""
    _watcher_state.check_count += 1
    _watcher_state.last_check = time.time()

    # 1. Check local version file
    file_version = _check_version_file_changed()
    if file_version:
        logger.info("Version file changed: %s -> %s", _watcher_state.last_version, file_version)
        _watcher_state.last_version = file_version
        _broadcast_event("version_changed", {
            "version": file_version,
            "source": "file",
        })
        _send_webhook_notification("version_changed", {
            "version": file_version,
            "source": "file",
        })

    # 2. Check GitHub for new releases
    release = _github_get_latest_release()
    if release is None:
        return

    tag = release.get("name", "")
    if not tag:
        return

    latest = tag.lstrip("v")
    current = CPIP_VERSION

    try:
        lat = _parse_version(latest)
        cur = _parse_version(current)
        update_available = lat > cur
    except (ValueError, TypeError):
        update_available = latest != current

    _broadcast_event("check_complete", {
        "current": current,
        "latest": latest,
        "update_available": update_available,
    })

    if not update_available:
        return

    logger.info("CPIP update detected: %s -> %s", current, latest)

    _broadcast_event("update_available", {
        "current": current,
        "latest": latest,
        "release_url": f"https://github.com/{CPIP_GITHUB_REPO}/releases/tag/{tag}",
        "release_notes": "",
    })

    _send_webhook_notification("update_available", {
        "current": current,
        "latest": latest,
        "release_url": f"https://github.com/{CPIP_GITHUB_REPO}/releases/tag/{tag}",
    })

    # 3. Auto-update if enabled
    if CPIP_WATCHER_AUTO_UPDATE:
        _broadcast_event("update_starting", {
            "from": current,
            "to": latest,
        })

        from .cpip_updater import apply_update

        old_version = current
        result = apply_update(target_version=latest)

        _watcher_state.last_update = time.time()

        if result.get("success"):
            _watcher_state.update_count += 1
            _watcher_state.last_version = latest
            _write_version_file(latest, "auto-update")

            _broadcast_event("update_complete", {
                "from": old_version,
                "to": latest,
                "result": result,
            })

            _send_webhook_notification("update_complete", {
                "from": old_version,
                "to": latest,
            })

            logger.info("CPIP auto-updated: %s -> %s", old_version, latest)
        else:
            _watcher_state.error_count += 1
            _watcher_state.last_error = result.get("message", "unknown error")

            _broadcast_event("update_failed", {
                "from": old_version,
                "to": latest,
                "error": result.get("message", ""),
            })

            _send_webhook_notification("update_failed", {
                "from": old_version,
                "to": latest,
                "error": result.get("message", ""),
            })

            logger.error("CPIP auto-update failed: %s", result.get("message"))

            # Rollback config.py if enabled
            if CPIP_WATCHER_ROLLBACK_ON_FAIL:
                _rollback_version(old_version)


def _rollback_version(target_version: str) -> None:
    """Rollback config.py to a previous version."""
    config_path = Path(__file__).parent / "config.py"
    try:
        content = config_path.read_text()
        # Find any CPIP_VERSION line and replace it
        import re
        content = re.sub(
            r'CPIP_VERSION = "[^"]*"',
            f'CPIP_VERSION = "{target_version}"',
            content,
        )
        config_path.write_text(content)
        logger.info("Rolled back CPIP_VERSION to %s", target_version)
    except OSError as exc:
        logger.error("Failed to rollback config.py: %s", exc)


# ─── Background Watcher Task ─────────────────────────────────────────────────


async def _watcher_loop() -> None:
    """Main watcher loop — runs as a background asyncio task."""
    _watcher_state.running = True
    logger.info(
        "CPIP watcher started (poll=%ds, auto_update=%s)",
        CPIP_WATCHER_POLL_INTERVAL,
        CPIP_WATCHER_AUTO_UPDATE,
    )

    # Initialize last_version from current config
    _watcher_state.last_version = CPIP_VERSION
    _write_version_file(CPIP_VERSION, "startup")

    _broadcast_event("watcher_started", {
        "version": CPIP_VERSION,
        "poll_interval": CPIP_WATCHER_POLL_INTERVAL,
    })

    while _watcher_state.running:
        try:
            await _watch_iteration()
        except Exception as exc:
            _watcher_state.error_count += 1
            _watcher_state.last_error = str(exc)
            logger.error("Watcher iteration failed: %s", exc)

            _broadcast_event("watcher_error", {"error": str(exc)})

        await asyncio.sleep(CPIP_WATCHER_POLL_INTERVAL)

    logger.info("CPIP watcher stopped")
    _broadcast_event("watcher_stopped", {})


_watcher_task: asyncio.Task[None] | None = None


async def start_watcher() -> None:
    """Start the background CPIP watcher task."""
    global _watcher_task
    if not CPIP_WATCHER_ENABLED:
        logger.info("CPIP watcher disabled")
        return
    if not CPIP_ENABLED:
        logger.info("CPIP disabled, watcher not starting")
        return
    if _watcher_task and not _watcher_task.done():
        logger.info("CPIP watcher already running")
        return

    _watcher_task = asyncio.create_task(_watcher_loop())
    logger.info("CPIP watcher task created")


async def stop_watcher() -> None:
    """Stop the background CPIP watcher task."""
    global _watcher_task
    _watcher_state.running = False
    if _watcher_task and not _watcher_task.done():
        _watcher_task.cancel()
        try:
            await _watcher_task
        except asyncio.CancelledError:
            pass
    _watcher_task = None


async def force_check_now() -> dict[str, Any]:
    """Force an immediate check (outside the normal polling cycle)."""
    try:
        await _watch_iteration()
        return {"success": True, "check_count": _watcher_state.check_count}
    except Exception as exc:
        return {"success": False, "error": str(exc)}
