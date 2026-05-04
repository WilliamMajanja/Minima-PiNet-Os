"""RMPE-2 provenance event store and canonical hashing utilities."""
from __future__ import annotations

import hashlib
import json
import re
import time
from typing import Any

from .config import PINET_VERSION

RMPE_SCHEMA_VERSION = "RMPE-2"
MAX_PROVENANCE_EVENTS = 1000
_EVENT_TYPE_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")
_provenance_events: list[dict[str, Any]] = []


def _now_ms() -> int:
    return int(time.time() * 1000)


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def get_provenance_events(limit: int | None = None) -> list[dict[str, Any]]:
    events = _provenance_events if limit is None else _provenance_events[-limit:]
    return [dict(event) for event in events]


def record_provenance_event(body: dict[str, Any], source: str = "api") -> dict[str, Any]:
    if not isinstance(body, dict):
        raise ValueError("Provenance event body must be an object")

    # `event` is accepted as a legacy alias; new clients should send `eventType`.
    event_type = body.get("eventType") or body.get("event")
    if not isinstance(event_type, str) or not _EVENT_TYPE_RE.fullmatch(event_type):
        raise ValueError("eventType must match [A-Za-z0-9_.:-]{1,80}")

    payload = body.get("payload", {})
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")

    now = _now_ms()
    timestamp = body.get("timestamp", now)
    if not isinstance(timestamp, int):
        timestamp = now

    metadata = {
        key: value
        for key, value in body.items()
        if key not in {"event", "eventType", "payload", "timestamp"}
    }

    previous_hash = _provenance_events[-1]["rmpeHash"] if _provenance_events else None
    unsigned_event = {
        "schemaVersion": RMPE_SCHEMA_VERSION,
        "type": "pinet-provenance-event",
        "eventType": event_type,
        "pinetVersion": PINET_VERSION,
        "source": source,
        "clusterId": str(body.get("clusterId", "local-cluster")),
        "nodeId": str(body.get("nodeId", "local-node")),
        "payload": payload,
        "metadata": metadata,
        "timestamp": timestamp,
        "recordedAt": now,
        "previousHash": previous_hash,
    }

    try:
        digest = hashlib.sha256(canonical_json(unsigned_event).encode("utf-8")).hexdigest()
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid provenance payload") from exc

    event = {
        **unsigned_event,
        "rmpeHash": f"sha256:{digest}",
        "provenanceId": f"rmpe2:{digest[:16]}",
    }
    _provenance_events.append(event)
    if len(_provenance_events) > MAX_PROVENANCE_EVENTS:
        _provenance_events[:] = _provenance_events[-MAX_PROVENANCE_EVENTS:]
    return dict(event)
