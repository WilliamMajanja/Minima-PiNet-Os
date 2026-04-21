"""WebSocket cluster events handler."""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Connected WebSocket clients
_cluster_ws_clients: set[WebSocket] = set()


async def broadcast_cluster_event(event_type: str, payload: Any) -> None:
    """Broadcast a cluster event to all connected WebSocket clients."""
    message = json.dumps({"type": event_type, "payload": payload, "timestamp": int(time.time() * 1000)})
    dead = set()
    for ws in list(_cluster_ws_clients):
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    _cluster_ws_clients.difference_update(dead)


@router.websocket("/ws/cluster")
async def websocket_cluster(websocket: WebSocket):
    """WebSocket endpoint that streams cluster state and events."""
    await websocket.accept()
    _cluster_ws_clients.add(websocket)
    try:
        # Send current cluster state immediately on connect
        from ..routes.cluster import fetch_cluster_state
        state = await fetch_cluster_state()
        await websocket.send_text(
            json.dumps({"type": "cluster-state", "payload": state, "timestamp": int(time.time() * 1000)})
        )

        # Keep connection alive; real events are pushed via broadcast_cluster_event
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # Send a keep-alive ping
                await websocket.send_text(json.dumps({"type": "ping", "timestamp": int(time.time() * 1000)}))
    except WebSocketDisconnect:
        pass
    finally:
        _cluster_ws_clients.discard(websocket)
