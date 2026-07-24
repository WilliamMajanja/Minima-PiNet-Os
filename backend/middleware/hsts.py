"""PiNet-OS — HSTS & Security Headers Middleware

Adds HTTP Strict Transport Security (HSTS) and additional security headers
to all responses. Integrates with CPIP security provider.
"""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class HSTSMiddleware(BaseHTTPMiddleware):
    """Middleware that adds HSTS and security headers to all responses.

    Headers added:
        - Strict-Transport-Security (HSTS)
        - Content-Security-Policy
        - Permissions-Policy
        - X-Content-Type-Options
        - X-Frame-Options
        - X-XSS-Protection
        - Referrer-Policy
        - X-Permitted-Cross-Domain-Policies
        - Cross-Origin-Embedder-Policy
        - Cross-Origin-Opener-Policy
        - Cross-Origin-Resource-Policy
    """

    def __init__(
        self,
        app,
        hsts_max_age: int = 31536000,
        hsts_include_subdomains: bool = True,
        hsts_preload: bool = True,
    ):
        super().__init__(app)
        self.hsts_max_age = hsts_max_age
        self.hsts_include_subdomains = hsts_include_subdomains
        self.hsts_preload = hsts_preload

        self._hsts_value = self._build_hsts_value()
        self._csp_value = self._build_csp_value()
        self._permissions_value = self._build_permissions_value()

    def _build_hsts_value(self) -> str:
        parts = [f"max-age={self.hsts_max_age}"]
        if self.hsts_include_subdomains:
            parts.append("includeSubDomains")
        if self.hsts_preload:
            parts.append("preload")
        return "; ".join(parts)

    def _build_csp_value(self) -> str:
        return (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self' data:; "
            "connect-src 'self' ws: wss: http: https:; "
            "media-src 'self' blob:; "
            "object-src 'none'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )

    def _build_permissions_value(self) -> str:
        return (
            "camera=(), "
            "microphone=(), "
            "geolocation=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "accelerometer=(), "
            "autoplay=(), "
            "fullscreen=(self), "
            "picture-in-picture=(self)"
        )

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # HSTS — only on HTTPS responses or when behind a reverse proxy
        is_secure = (
            request.url.scheme == "https"
            or request.headers.get("x-forwarded-proto") == "https"
            or request.headers.get("x-forwarded-ssl") == "on"
        )
        if is_secure:
            response.headers["Strict-Transport-Security"] = self._hsts_value

        # Security headers on all responses
        response.headers["Content-Security-Policy"] = self._csp_value
        response.headers["Permissions-Policy"] = self._permissions_value
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

        return response
