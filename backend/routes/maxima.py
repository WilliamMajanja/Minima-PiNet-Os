"""Maxima P2P messaging endpoints."""
from __future__ import annotations

import json
import re
import time

from fastapi import APIRouter, Depends, HTTPException

from ..minima_client import minima_client
from ..rate_limiter import exec_rate_limiter, rate_limit_dependency

router = APIRouter()


@router.get("/maxima/contacts")
async def get_contacts():
    data = await minima_client.maxima_contacts()
    if data and data.get("status") and data.get("response"):
        contacts = []
        for c in data["response"]:
            extra = c.get("extradata") or {}
            contacts.append({
                "name": extra.get("name", f"Node-{c.get('id', '?')}"),
                "address": c.get("currentaddress", ""),
                "status": "online" if (time.time() * 1000 - c.get("lastseen", 0)) < 60000 else "offline",
                "lastSeen": c.get("lastseen", ""),
                "publicKey": c.get("publickey", ""),
                "sameChain": c.get("samechain", False),
            })
        return {"contacts": contacts}
    return {"contacts": []}


@router.post("/maxima/send", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def send_message(body: dict):
    to = body.get("to", "")
    application = body.get("application", "")
    data = body.get("data")

    if not to or not application or data is None:
        raise HTTPException(400, "to, application, and data required")

    safe_id = re.compile(r"^[a-zA-Z0-9._:@-]+$")
    if not isinstance(to, str) or not safe_id.match(to) or len(to) > 256:
        raise HTTPException(400, "Invalid 'to' address")
    safe_app = re.compile(r"^[a-zA-Z0-9._-]+$")
    if not isinstance(application, str) or not safe_app.match(application) or len(application) > 128:
        raise HTTPException(400, "Invalid application name")

    json_str = json.dumps(data)
    if len(json_str) > 10000:
        raise HTTPException(400, "Data payload too large")

    safe_data = json_str.replace(" ", "_")
    result = await minima_client.maxima_send(to, application, safe_data)
    if result is not None:
        return {"status": result.get("status"), "delivered": (result.get("response") or {}).get("delivered")}

    raise HTTPException(503, "Maxima RPC is not reachable")


@router.get("/maxima/messages")
async def get_messages():
    data = await minima_client.maxima_poll()
    if data and data.get("status") and data.get("response"):
        return {"messages": data["response"]}
    return {"messages": []}
