"""Maxima P2P messaging endpoints."""
from __future__ import annotations

import base64
import json
import re
import time

from fastapi import APIRouter, Depends, HTTPException

from ..minima_client import minima_client
from ..rate_limiter import exec_rate_limiter, rate_limit_dependency

router = APIRouter()


@router.get("/maxima/contacts")
async def get_contacts():
    """List Maxima contacts using the correct maxcontacts command."""
    data = await minima_client.maxima_contacts()
    if data and data.get("status"):
        response = data.get("response") or {}
        contact_list = response.get("contacts", []) if isinstance(response, dict) else response
        if isinstance(contact_list, list):
            contacts = []
            for c in contact_list:
                if not isinstance(c, dict):
                    continue
                extra = c.get("extradata") or {}
                if isinstance(extra, str):
                    try:
                        extra = json.loads(extra)
                    except (json.JSONDecodeError, TypeError):
                        extra = {}
                lastseen = c.get("lastseen", 0)
                try:
                    lastseen_num = int(lastseen) if lastseen else 0
                except (ValueError, TypeError):
                    lastseen_num = 0
                contacts.append({
                    "id": c.get("id", ""),
                    "name": extra.get("name", f"Node-{c.get('id', '?')}") if isinstance(extra, dict) else f"Node-{c.get('id', '?')}",
                    "address": c.get("currentaddress", ""),
                    "status": "online" if (int(time.time()) - lastseen_num / 1000) < 60 else "offline",
                    "lastSeen": lastseen,
                    "publicKey": c.get("publickey", ""),
                    "sameChain": c.get("samechain", False),
                })
            return {"contacts": contacts}
    return {"contacts": []}


@router.post("/maxima/send", dependencies=[Depends(rate_limit_dependency(exec_rate_limiter))])
async def send_message(body: dict):
    """Send a Maxima P2P message with base64-encoded payload."""
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

    json_bytes = json.dumps(data, separators=(",", ":")).encode("utf-8")
    if len(json_bytes) > 10000:
        raise HTTPException(400, "Data payload too large")

    encoded_data = f"base64:{base64.urlsafe_b64encode(json_bytes).decode('ascii')}"
    result = await minima_client.maxima_send(to, application, encoded_data)
    if result is not None:
        return {"status": result.get("status"), "delivered": (result.get("response") or {}).get("delivered")}

    raise HTTPException(503, "Maxima RPC is not reachable")


@router.get("/maxima/messages")
async def get_messages():
    """Poll for incoming Maxima messages."""
    data = await minima_client.maxima_poll()
    if data and data.get("status") and data.get("response"):
        return {"messages": data["response"]}
    return {"messages": []}


@router.get("/maxima/info")
async def maxima_info():
    """Get this node's Maxima identity."""
    data = await minima_client.maxima_info()
    if data and data.get("status"):
        resp = data.get("response") or {}
        return {
            "publicKey": resp.get("publickey", ""),
            "address": resp.get("address", resp.get("mxpublickey", "")),
            "name": resp.get("name", ""),
        }
    raise HTTPException(503, "Minima node is not reachable")