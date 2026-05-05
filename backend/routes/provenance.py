"""RMPE-2 provenance recording endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..provenance_store import (
    RMPE_SCHEMA_VERSION,
    get_provenance_events,
    record_provenance_event,
)

router = APIRouter()


@router.post("/provenance/record")
@router.post("/cluster/provenance/record")  # Backward-compatible alias for older cluster clients.
async def record_provenance(body: dict[str, Any]):
    try:
        event = record_provenance_event(body, source="api")
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"success": True, "event": event}


@router.get("/provenance/schema")
async def get_provenance_schema():
    return {
        "schemaVersion": RMPE_SCHEMA_VERSION,
        "recordType": "pinet-provenance-event",
        "hash": "sha256(canonical-json(unsigned-event))",
        "chain": "previousHash links each bounded in-memory event to the preceding RMPE-2 record",
    }
