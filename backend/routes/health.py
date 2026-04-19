"""Health check endpoint."""
import platform
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    return {"status": "ok", "os": platform.system().lower()}
