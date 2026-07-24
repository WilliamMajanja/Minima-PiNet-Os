"""PiNet-OS — Python Backend (FastAPI)

Main entry point that registers all API routes, middleware, WebSocket handlers,
and serves the Jinja2 frontend.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from decimal import Decimal
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

logger = logging.getLogger(__name__)

from .config import (
    CORS_ORIGIN,
    CPIP_DEFENSE_ENABLED,
    CPIP_ENABLED,
    DESKTOP_PORT,
    HSTS_ENABLED,
    HSTS_INCLUDE_SUBDOMAINS,
    HSTS_MAX_AGE,
    HSTS_PRELOAD,
    PINET_VERSION,
    SSL_ENABLED,
)
from .cpip_provider import CPIPSecurityMiddleware, initialize_cpip
from .middleware.hsts import HSTSMiddleware

# Import route modules
from .routes import (
    ai,
    attestation,
    cluster,
    cpip,
    dapps,
    devices,
    downloads,
    enclaves,
    enterprise,
    files,
    health,
    ipc,
    kernel,
    llm,
    marketplace,
    maxima,
    minima,
    network,
    power,
    pq_tls,
    provenance,
    quotas,
    security,
    sensors,
    settings,
    syslog_routes,
    system,
    tpm,
    users,
    zk_proofs,
)
from .routes import (
    ssl as ssl_routes,
)
from .state import get_state, save_state
from .websocket.cluster import router as ws_cluster_router
from .websocket.terminal import router as ws_router

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"

# ─── Background task: poll Minima node status and balance ────────────────

async def _poll_minima_status():
    """Periodically poll the local Minima node to keep cached state fresh."""
    from .minima_client import minima_client
    while True:
        try:
            status_data = await minima_client.status()
            if status_data and status_data.get("status"):
                state = get_state()
                response = status_data.get("response") or {}
                chain = response.get("chain") or {}
                net = response.get("network") or {}
                node = response.get("node") or {}

                state.minima.block_height = int(chain.get("block", state.minima.block_height) or state.minima.block_height)
                state.minima.peers = int(net.get("connected", state.minima.peers) or state.minima.peers)
                state.minima.status = "Synced"
                state.minima.version = str(node.get("version", "") or status_data.get("version", "") or state.minima.version)
                state.minima.uptime = str(node.get("uptime", "") or state.minima.uptime)
                state.minima.tip = str(chain.get("tip", "") or state.minima.tip)

                balance_data = await minima_client.balance()
                if balance_data and balance_data.get("status"):
                    parsed = minima_client.parse_balance(balance_data)
                    native = parsed.get("0x00", Decimal(0))
                    state.minima.balance = native

                save_state()
            else:
                state = get_state()
                state.minima.status = "Offline"
        except (OSError, ValueError):
            state = get_state()
            state.minima.status = "Offline"
            try:
                save_state()
            except OSError:
                logger.debug("Failed to save state during poll", exc_info=True)
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    if CPIP_ENABLED:
        initialize_cpip()
        # Start CPIP version watcher (background polling + file watch)
        try:
            from .cpip_watcher import start_watcher
            await start_watcher()
        except Exception as exc:
            logger.debug("CPIP watcher not started: %s", exc)
    task = asyncio.create_task(_poll_minima_status())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    # Stop CPIP watcher
    try:
        from .cpip_watcher import stop_watcher
        await stop_watcher()
    except Exception:
        pass
    from .minima_client import minima_client
    await minima_client.close()


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
    # Also allow HTTPS origins when SSL is enabled
    if SSL_ENABLED:
        https_origins = [o.replace("http://", "https://") for o in origins]
        origins.extend(https_origins)
        if "https://localhost:3000" in origins:
            origins.append("https://localhost")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- HSTS & Security Headers Middleware ---
    if HSTS_ENABLED:
        app.add_middleware(
            HSTSMiddleware,
            hsts_max_age=HSTS_MAX_AGE,
            hsts_include_subdomains=HSTS_INCLUDE_SUBDOMAINS,
            hsts_preload=HSTS_PRELOAD,
        )

    # --- CPIP Security Middleware ---
    if CPIP_ENABLED and CPIP_DEFENSE_ENABLED:
        app.middleware("http")(CPIPSecurityMiddleware())

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
    app.include_router(ai.router, prefix="/api", tags=["ai"])
    app.include_router(cpip.router, prefix="/api", tags=["cpip"])
    app.include_router(sensors.router, prefix="/api", tags=["sensors"])
    app.include_router(llm.router, prefix="/api", tags=["llm"])
    app.include_router(quotas.router, prefix="/api", tags=["lxc-quotas"])
    app.include_router(tpm.router, prefix="/api", tags=["tpm"])
    app.include_router(pq_tls.router, prefix="/api", tags=["pq-tls"])
    app.include_router(attestation.router, prefix="/api", tags=["attestation"])
    app.include_router(enclaves.router, prefix="/api", tags=["enclaves"])
    app.include_router(zk_proofs.router, prefix="/api", tags=["zk"])
    app.include_router(marketplace.router, prefix="/api", tags=["marketplace"])
    app.include_router(ssl_routes.router, prefix="/api", tags=["ssl"])

    # --- WebSocket ---
    app.include_router(ws_router)
    app.include_router(ws_cluster_router)

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