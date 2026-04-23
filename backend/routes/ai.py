"""AI assistant endpoints — real Gemini integration with no simulated fallbacks.

When ``GEMINI_API_KEY`` is set, ``POST /api/ai/chat`` proxies the user prompt
to Google's Gemini REST API and returns the model's text. When the key is not
configured (or the upstream call fails), the endpoint returns an explicit
error response — it never invents an answer.
"""
from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..config import GEMINI_API_KEY
from ..rate_limiter import RateLimiter, rate_limit_dependency

router = APIRouter()

# Modest per-IP cap to protect the upstream API key.
_ai_chat_limiter = RateLimiter(20, 60)

_GEMINI_MODEL = "gemini-1.5-flash-latest"
_GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{_GEMINI_MODEL}:generateContent"
)
_MAX_PROMPT_CHARS = 4000


@router.get("/ai/status")
async def ai_status() -> dict[str, Any]:
    """Report whether a real model backend is configured."""
    return {
        "configured": bool(GEMINI_API_KEY),
        "provider": "gemini" if GEMINI_API_KEY else None,
        "model": _GEMINI_MODEL if GEMINI_API_KEY else None,
    }


@router.post("/ai/chat", dependencies=[Depends(rate_limit_dependency(_ai_chat_limiter))])
async def ai_chat(body: dict) -> dict[str, Any]:
    prompt = body.get("prompt") if isinstance(body, dict) else None
    if not isinstance(prompt, str) or not prompt.strip():
        raise HTTPException(400, "prompt is required")
    if len(prompt) > _MAX_PROMPT_CHARS:
        raise HTTPException(400, f"prompt exceeds {_MAX_PROMPT_CHARS} characters")
    if not GEMINI_API_KEY:
        raise HTTPException(
            503,
            "AI provider not configured. Set GEMINI_API_KEY in the environment to enable the assistant.",
        )

    payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                _GEMINI_URL,
                params={"key": GEMINI_API_KEY},
                json=payload,
            )
    except httpx.HTTPError:
        raise HTTPException(502, "AI provider unreachable")

    if resp.status_code != 200:
        # Surface the upstream status so the user sees the real failure.
        raise HTTPException(502, f"AI provider returned HTTP {resp.status_code}")

    data = resp.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(502, "AI provider returned no text content")

    return {"provider": "gemini", "model": _GEMINI_MODEL, "text": text}
