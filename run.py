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
    from backend.ssl_manager import SSL_ENABLED, ensure_certs

    app = create_app()

    port = int(os.getenv("PINET_DESKTOP_PORT", "3000"))
    host = os.getenv("PINET_HOST", "0.0.0.0")
    reload_enabled = os.getenv("PINET_RELOAD", "").lower() in ("1", "true", "yes")

    # SSL/TLS configuration
    ssl_certfile = None
    ssl_keyfile = None
    scheme = "http"

    if SSL_ENABLED:
        cert_path, key_path = ensure_certs()
        if cert_path and key_path:
            ssl_certfile = cert_path
            ssl_keyfile = key_path
            scheme = "https"
            print("🔒 SSL/TLS enabled")
            print(f"   Certificate: {cert_path}")
            print(f"   Key:         {key_path}")
        else:
            print("⚠️  SSL enabled but no certificates available — falling back to HTTP")
            print("   Generate certs with: pinet ssl generate")

    print(f"🚀 PiNet-OS starting on {scheme}://{host}:{port}")
    print(f"   Python {sys.version}")
    print(f"   Reload: {'enabled' if reload_enabled else 'disabled'}")

    uvicorn_kwargs = {
        "app": app,
        "host": host,
        "port": port,
        "reload": reload_enabled,
        "log_level": "info",
    }

    if ssl_certfile and ssl_keyfile:
        uvicorn_kwargs["ssl_certfile"] = ssl_certfile
        uvicorn_kwargs["ssl_keyfile"] = ssl_keyfile

    uvicorn.run(**uvicorn_kwargs)


if __name__ == "__main__":
    main()
