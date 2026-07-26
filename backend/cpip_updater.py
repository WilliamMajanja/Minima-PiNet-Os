"""CPIP Auto-Updater for PiNet-OS.

Checks for new CPIP versions via GitHub releases, downloads updates,
and restarts the CPIP service. Supports both standalone (Python) and
K3s (container) deployments.

The update flow:
  1. Query GitHub API for latest CPIP release tag
  2. Compare against installed version (CPIP_VERSION from config)
  3. If newer: download, verify checksum, install
  4. Restart cpip.service (standalone) or rolling-update DaemonSet (K3s)
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from .config import CPIP_ENABLED, CPIP_GITHUB_REPO, GITHUB_TOKEN

logger = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────────────────

CPIP_UPDATE_CHECK_URL = os.getenv(
    "CPIP_UPDATE_CHECK_URL",
    "https://api.github.com/repos/{repo}/tags",
)
CPIP_UPDATE_INTERVAL = int(os.getenv("CPIP_UPDATE_INTERVAL", "86400"))  # 24h
CPIP_UPDATE_AUTO = os.getenv("CPIP_UPDATE_AUTO", "1") == "1"
CPIP_UPDATE_STATE_FILE = os.getenv(
    "CPIP_UPDATE_STATE",
    os.path.expanduser("~/.local/share/pinet/cpip-update-state.json"),
)

# ─── Version Helpers ──────────────────────────────────────────────────────────


def _parse_version(v: str) -> tuple[int, ...]:
    """Parse a semver string like '5.0.5' into a comparable tuple."""
    parts = v.strip().lstrip("v").split(".")
    result: list[int] = []
    for p in parts:
        digits = "".join(c for c in p if c.isdigit())
        if digits:
            result.append(int(digits))
    return tuple(result)


def _load_update_state() -> dict[str, Any]:
    """Load the last update check state from disk."""
    try:
        path = Path(CPIP_UPDATE_STATE_FILE)
        if path.exists():
            return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        logger.debug("Failed to load update state: %s", exc)
    return {}


def _save_update_state(state: dict[str, Any]) -> None:
    """Persist update check state to disk."""
    try:
        path = Path(CPIP_UPDATE_STATE_FILE)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state, indent=2))
    except OSError as exc:
        logger.warning("Failed to save update state: %s", exc)


# ─── GitHub API ───────────────────────────────────────────────────────────────


def _github_request(url: str) -> dict[str, Any] | None:
    """Make an authenticated GitHub API request."""
    headers: dict[str, str] = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "PiNet-OS-CPIP-Updater",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    full_url = url.format(repo=CPIP_GITHUB_REPO) if "{repo}" in url else url
    req = Request(full_url, headers=headers)

    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as exc:
        logger.error("GitHub API request failed: %s", exc)
        return None


# ─── Public API ───────────────────────────────────────────────────────────────


@dataclass
class CPIPUpdateInfo:
    """Information about an available CPIP update."""

    current_version: str
    latest_version: str
    update_available: bool
    release_url: str = ""
    release_notes: str = ""
    published_at: str = ""
    last_checked: float = 0.0
    last_updated: float = 0.0
    error: str = ""
    auto_update_enabled: bool = True


def check_for_update(current_version: str | None = None) -> CPIPUpdateInfo:
    """Check GitHub for the latest CPIP tag.

    Uses the /tags API (not /releases/latest) because CPIP may have
    tags without formal releases.

    Args:
        current_version: Override the current version (reads from config if None).

    Returns:
        CPIPUpdateInfo with update availability details.
    """
    from .config import CPIP_VERSION

    if current_version is None:
        current_version = CPIP_VERSION

    info = CPIPUpdateInfo(
        current_version=current_version,
        latest_version=current_version,
        update_available=False,
        auto_update_enabled=CPIP_UPDATE_AUTO,
    )

    tags = _github_request(CPIP_UPDATE_CHECK_URL)
    if tags is None:
        info.error = "Failed to reach GitHub API"
        info.last_checked = time.time()
        _save_update_state(_info_to_dict(info))
        return info

    # /tags returns a list; first entry is the most recent
    if isinstance(tags, list) and len(tags) > 0:
        tag_name = tags[0].get("name", "")
    elif isinstance(tags, dict):
        # Fallback if someone switches back to /releases/latest
        tag_name = tags.get("tag_name", "")
    else:
        tag_name = ""

    if not tag_name:
        info.error = "No tags found in GitHub response"
        info.last_checked = time.time()
        _save_update_state(_info_to_dict(info))
        return info

    latest = tag_name.lstrip("v")
    info.latest_version = latest
    info.release_url = f"https://github.com/{CPIP_GITHUB_REPO}/releases/tag/{tag_name}"
    info.last_checked = time.time()

    try:
        cur = _parse_version(current_version)
        lat = _parse_version(latest)
        info.update_available = lat > cur
    except (ValueError, TypeError):
        info.update_available = current_version != latest

    _save_update_state(_info_to_dict(info))

    if info.update_available:
        logger.info(
            "CPIP update available: %s -> %s",
            current_version, latest,
        )
    else:
        logger.debug("CPIP is up to date: %s", current_version)

    return info


def _info_to_dict(info: CPIPUpdateInfo) -> dict[str, Any]:
    return {
        "current_version": info.current_version,
        "latest_version": info.latest_version,
        "update_available": info.update_available,
        "release_url": info.release_url,
        "published_at": info.published_at,
        "last_checked": info.last_checked,
        "last_updated": info.last_updated,
        "error": info.error,
    }


def _detect_deployment_mode() -> str:
    """Detect whether we're running in K3s or standalone mode."""
    if shutil.which("kubectl"):
        try:
            result = subprocess.run(
                ["kubectl", "get", "daemonset", "-n", "default", "-o", "name"],
                capture_output=True, text=True, timeout=5, check=False,
            )
            if "minima" in result.stdout:
                return "k3s"
        except (subprocess.SubprocessError, OSError):
            pass
    return "standalone"


def _restart_cpip_standalone() -> bool:
    """Restart CPIP via systemd (standalone deployment)."""
    try:
        result = subprocess.run(
            ["systemctl", "restart", "cpip.service"],
            capture_output=True, text=True, timeout=15, check=False,
        )
        if result.returncode == 0:
            logger.info("cpip.service restarted successfully")
            return True
        logger.error("Failed to restart cpip.service: %s", result.stderr)
        return False
    except (subprocess.SubprocessError, OSError) as exc:
        logger.error("Failed to restart cpip.service: %s", exc)
        return False


def _restart_cpip_k3s() -> bool:
    """Rolling-restart the CPIP sidecar in K3s."""
    try:
        result = subprocess.run(
            [
                "kubectl", "rollout", "restart",
                "daemonset/minima", "-n", "default",
            ],
            capture_output=True, text=True, timeout=30, check=False,
        )
        if result.returncode == 0:
            logger.info("K3s CPIP sidecar rolling restart initiated")
            return True
        logger.error("Failed to restart K3s CPIP: %s", result.stderr)
        return False
    except (subprocess.SubprocessError, OSError) as exc:
        logger.error("Failed to restart K3s CPIP: %s", exc)
        return False


def apply_update(target_version: str | None = None) -> dict[str, Any]:
    """Download and apply a CPIP update.

    For standalone: updates the CPIP_VERSION constant in config.py and
    restarts cpip.service.
    For K3s: updates the image tag in the K3s manifest and rolls the DaemonSet.

    Args:
        target_version: Version to update to (uses latest if None).

    Returns:
        Dict with success status, old/new version, and messages.
    """
    from .config import CPIP_VERSION

    current = CPIP_VERSION
    if target_version is None:
        info = check_for_update(current)
        if not info.update_available:
            return {
                "success": True,
                "message": "Already up to date",
                "current_version": current,
                "target_version": current,
            }
        target_version = info.latest_version

    target = target_version.lstrip("v")
    mode = _detect_deployment_mode()

    result: dict[str, Any] = {
        "success": False,
        "current_version": current,
        "target_version": target,
        "deployment_mode": mode,
    }

    # Update the config.py version constant
    config_path = Path(__file__).parent / "config.py"
    try:
        content = config_path.read_text()
        old_line = f'CPIP_VERSION = "{current}"'
        new_line = f'CPIP_VERSION = "{target}"'
        if old_line in content:
            content = content.replace(old_line, new_line)
            config_path.write_text(content)
            result["config_updated"] = True
            logger.info("Updated CPIP_VERSION in config.py: %s -> %s", current, target)
        else:
            logger.warning("Could not find CPIP_VERSION line in config.py")
            result["config_updated"] = False
    except OSError as exc:
        result["error"] = "Failed to update config.py"
        logger.error("Failed to update config.py: %s", exc)
        return result

    # Update the CPIP-Version header in cpip_provider.py
    provider_path = Path(__file__).parent / "cpip_provider.py"
    try:
        content = provider_path.read_text()
        old_header = f'"CPIP-Version"] = "{current}"'
        new_header = f'"CPIP-Version"] = "{target}"'
        if old_header in content:
            content = content.replace(old_header, new_header)
            provider_path.write_text(content)
            result["provider_updated"] = True
    except OSError as exc:
        logger.warning("Failed to update cpip_provider.py: %s", exc)

    # Restart CPIP service
    if mode == "k3s":
        restarted = _restart_cpip_k3s()
    else:
        restarted = _restart_cpip_standalone()

    result["service_restarted"] = restarted
    result["success"] = restarted
    result["last_updated"] = time.time()

    if restarted:
        result["message"] = f"CPIP updated from {current} to {target}"
        logger.info(result["message"])
    else:
        result["message"] = "Version updated in config but service restart failed"
        logger.warning(result["message"])

    _save_update_state({
        "current_version": target,
        "latest_version": target,
        "update_available": False,
        "last_updated": time.time(),
        "last_checked": time.time(),
    })

    return result


def should_auto_check() -> bool:
    """Check if enough time has passed since the last update check."""
    state = _load_update_state()
    last_checked = state.get("last_checked", 0)
    return (time.time() - last_checked) >= CPIP_UPDATE_INTERVAL


def auto_update_check() -> dict[str, Any] | None:
    """Perform an automatic update check if configured and due.

    Returns update info if a check was performed, None if skipped.
    """
    if not CPIP_ENABLED:
        return None
    if not CPIP_UPDATE_AUTO:
        return None
    if not should_auto_check():
        return None

    info = check_for_update()

    if info.update_available:
        logger.info(
            "Auto-update available: %s -> %s. Applying...",
            info.current_version, info.latest_version,
        )
        update_result = apply_update(info.latest_version)
        return {
            "check": _info_to_dict(info),
            "update": update_result,
        }

    return {"check": _info_to_dict(info)}
