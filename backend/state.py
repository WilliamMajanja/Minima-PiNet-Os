"""PiNet-OS Application State Manager."""
import json
import logging
import os
from pathlib import Path

from .models import PiNetState

logger = logging.getLogger(__name__)

STATE_FILE = Path(os.getcwd()) / "pinet-state.json"

_state: PiNetState | None = None


def get_state() -> PiNetState:
    """Get the current application state, loading from disk if needed."""
    global _state
    if _state is None:
        _state = _load_state()
    return _state


def save_state() -> None:
    """Persist the current state to disk."""
    state = get_state()
    STATE_FILE.write_text(
        json.dumps(state.model_dump(by_alias=True), indent=2, default=str)
    )


def _load_state() -> PiNetState:
    """Load state from the JSON file, or return defaults."""
    if STATE_FILE.exists():
        try:
            data = json.loads(STATE_FILE.read_text())
            return PiNetState(**data)
        except Exception:
            logger.debug("Failed to load state from disk, using defaults", exc_info=True)
    return PiNetState()
