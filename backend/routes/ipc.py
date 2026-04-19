"""IPC / D-Bus endpoints."""
from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/ipc/services")
async def ipc_services():
    return {
        "services": [],
        "channels": [],
        "stats": {"totalMessages": 0, "activeChannels": 0},
    }


@router.get("/ipc/messages")
async def ipc_messages(limit: int = Query(default=50, le=200)):
    return {"messages": []}
