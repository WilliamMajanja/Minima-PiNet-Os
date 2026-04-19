"""Syslog endpoints."""
from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/syslog")
async def get_syslog(
    limit: int = Query(default=100, le=500),
    facility: str = Query(default=None),
    severity: str = Query(default=None),
    process: str = Query(default=None),
    search: str = Query(default=None),
):
    return {"logs": [], "note": "Syslog integration requires syslog daemon"}


@router.get("/syslog/stats")
async def syslog_stats():
    return {"totalEntries": 0, "facilities": {}, "severities": {}}


@router.get("/syslog/processes")
async def syslog_processes():
    return {"processes": []}
