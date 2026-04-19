"""PiNet-OS — Python Backend (FastAPI)

Main entry point that registers all API routes, middleware, WebSocket handlers,
and serves the Jinja2 frontend.
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .config import (
    CORS_ORIGIN,
    DESKTOP_PORT,
    MINIMA_RPC_URL,
    PINET_VERSION,
)
from .state import get_state, save_state

# Import route modules
from .routes import (
    health,
    system,
    files,
    settings,
    minima,
    maxima,
    cluster,
    enterprise,
    kernel,
    syslog_routes,
    users,
    security,
    network,
    power,
    devices,
    dapps,
    downloads,
    ipc,
    provenance,
)
from .websocket.terminal import router as ws_router

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"


# --- Background task: poll Minima node status ---
async def _poll_minima_status():
    """Periodically poll the local Minima node to keep cached state fresh."""
    while True:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{MINIMA_RPC_URL}/status")
                if resp.status_code == 200:
                    data = resp.json()
                    state = get_state()
                    chain = (data.get("response") or {}).get("chain") or {}
                    net = (data.get("response") or {}).get("network") or {}
                    state.minima.block_height = chain.get("block", state.minima.block_height)
                    state.minima.peers = net.get("connected", state.minima.peers)
                    state.minima.status = "Synced"
                    save_state()
        except Exception:
            state = get_state()
            state.minima.status = "Offline"
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    task = asyncio.create_task(_poll_minima_status())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


def create_app() -> FastAPI:
    """Factory that creates and configures the FastAPI application."""
    app = FastAPI(
        title="PiNet-OS",
        description="Web3-native OS for Raspberry Pi — Python backend",
        version=PINET_VERSION,
        lifespan=lifespan,
    )

    # --- CORS ---
    origins = [CORS_ORIGIN] if CORS_ORIGIN else [f"http://localhost:{DESKTOP_PORT}"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Request logging ---
    @app.middleware("http")
    async def log_api_requests(request: Request, call_next):
        if request.url.path.startswith("/api/"):
            print(f"[API] {request.method} {request.url.path}")
        response = await call_next(request)
        return response

    # --- Register API routers ---
    app.include_router(health.router, prefix="/api", tags=["health"])
    app.include_router(system.router, prefix="/api", tags=["system"])
    app.include_router(files.router, prefix="/api", tags=["files"])
    app.include_router(settings.router, prefix="/api", tags=["settings"])
    app.include_router(minima.router, prefix="/api", tags=["minima"])
    app.include_router(maxima.router, prefix="/api", tags=["maxima"])
    app.include_router(cluster.router, prefix="/api", tags=["cluster"])
    app.include_router(enterprise.router, prefix="/api", tags=["enterprise"])
    app.include_router(kernel.router, prefix="/api", tags=["kernel"])
    app.include_router(syslog_routes.router, prefix="/api", tags=["syslog"])
    app.include_router(users.router, prefix="/api", tags=["users"])
    app.include_router(security.router, prefix="/api", tags=["security"])
    app.include_router(network.router, prefix="/api", tags=["network"])
    app.include_router(power.router, prefix="/api", tags=["power"])
    app.include_router(devices.router, prefix="/api", tags=["devices"])
    app.include_router(dapps.router, prefix="/api", tags=["dapps"])
    app.include_router(downloads.router, prefix="/api", tags=["downloads"])
    app.include_router(ipc.router, prefix="/api", tags=["ipc"])
    app.include_router(provenance.router, prefix="/api", tags=["provenance"])

    # --- WebSocket ---
    app.include_router(ws_router)

    # --- Frontend (Jinja2 templates + static files) ---
    templates = Jinja2Templates(directory=str(FRONTEND_DIR / "templates"))
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static")

    @app.get("/", include_in_schema=False)
    async def index(request: Request):
        return templates.TemplateResponse(
            request, "desktop.html", {"version": PINET_VERSION}
        )

    # --- Global 404 for /api ---
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        if request.url.path.startswith("/api/"):
            return JSONResponse(
                status_code=404,
                content={"error": "Not Found", "path": request.url.path},
            )
        # For non-API routes, serve the SPA index
        return templates.TemplateResponse(
            request, "desktop.html", {"version": PINET_VERSION}
        )

    return app
