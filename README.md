# Minima-PiNet-OS

Minima-PiNet-OS is a Raspberry Pi focused control-plane project that now runs on a **single Python stack**:

- **Backend:** FastAPI (`backend/`)
- **Frontend:** Jinja2 + static assets (`frontend/`)
- **Entry point:** `run.py`

The legacy Node/React/Electron desktop stack has been removed.

## Project Layout

- `run.py` — local/dev startup entrypoint
- `backend/` — API routes, services, websocket handlers, app state
- `frontend/` — templates and static desktop assets
- `PiNetOS/` — system scripts + service definitions
- `k3s/` — Kubernetes manifests
- `scripts/` — release and packaging helpers
- `build-system/` — image build tooling

## Quick Start

### 1) Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2) Start the desktop server

```bash
python run.py
```

Default URL: `http://localhost:3000`

## Environment

Optional environment variables:

- `PINET_DESKTOP_PORT` (default: `3000`)
- `PINET_HOST` (default: `0.0.0.0`)
- `PINET_RELOAD` (`true/false`)
- `MINIMA_RPC_URL` (if Minima RPC is not local default)

## API and Runtime

- API routes are mounted under `/api`
- Desktop UI is served from `/`
- WebSocket routes are registered in `backend/websocket/`
- Minima integration client is in `backend/minima_client.py`

## Release Artifacts

Primary release packaging scripts:

- `bash scripts/create-release-img.sh`
- `node scripts/package-img-release.js`
- `node scripts/generate-release-packages.js`

## Notes

- This repository now treats the Python backend + Jinja frontend as the canonical desktop implementation.
- Any references to the old Node/React/Electron stack are considered historical and should not be used for new work.
