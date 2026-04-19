"""Provenance recording endpoint."""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter()

# Shared reference to cluster module's provenance store
_provenance_events: list[dict[str, Any]] = []


def get_provenance_events() -> list[dict[str, Any]]:
    return _provenance_events


@router.post("/provenance/record")
async def record_provenance(body: dict):
    if not body or not body.get("eventType"):
        raise HTTPException(400, "Invalid provenance event")
    event = {**body, "recordedAt": int(time.time() * 1000)}
    _provenance_events.append(event)
    # Keep bounded
    if len(_provenance_events) > 1000:
        del _provenance_events[:500]
    return {"success": True}
