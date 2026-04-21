#!/usr/bin/env python3
"""PiNet-OS — Application entry point.

Start the Python backend + frontend server:

    python run.py

Or with uvicorn directly:

    uvicorn backend.main:app --host 0.0.0.0 --port 3000 --reload
"""
from __future__ import annotations

import os
import sys

import uvicorn
from dotenv import load_dotenv

# Load .env if present
load_dotenv()


def main() -> None:
    """Start the PiNet-OS server."""
    from backend.main import create_app

    app = create_app()

    port = int(os.getenv("PINET_DESKTOP_PORT", "3000"))
    host = os.getenv("PINET_HOST", "0.0.0.0")
    reload_enabled = os.getenv("PINET_RELOAD", "").lower() in ("1", "true", "yes")

    print(f"🚀 PiNet-OS starting on http://{host}:{port}")
    print(f"   Python {sys.version}")
    print(f"   Reload: {'enabled' if reload_enabled else 'disabled'}")

    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=reload_enabled,
        log_level="info",
    )


if __name__ == "__main__":
    main()
