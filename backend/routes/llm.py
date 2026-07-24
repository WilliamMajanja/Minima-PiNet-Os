"""On-Device LLM Gateway API routes (v1.3.0).

OpenAI-compatible endpoints for local LLM inference via Ollama, with
automatic fallback to Gemini cloud when no local model is loaded.

Hailo-8L NPU acceleration is detected and reported in responses.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..config import LLM_GATEWAY_ENABLED
from ..llm_gateway import llm_gateway
from ..models import LLMChatRequest
from ..rate_limiter import RateLimiter, rate_limit_dependency

router = APIRouter()

_llm_limiter = RateLimiter(10, 60)


@router.get("/llm/status")
async def llm_status() -> dict[str, Any]:
    """Return LLM gateway configuration and backend availability."""
    status = llm_gateway.status()
    status["available"] = await llm_gateway.is_available()
    return status


@router.get("/llm/models")
async def list_models() -> dict[str, Any]:
    """List all locally installed LLM models."""
    if not LLM_GATEWAY_ENABLED:
        raise HTTPException(503, "LLM gateway is disabled")
    models = await llm_gateway.list_models()
    return {"models": models, "count": len(models)}


@router.post("/llm/chat", dependencies=[Depends(rate_limit_dependency(_llm_limiter))])
async def llm_chat(req: LLMChatRequest) -> dict[str, Any]:
    """Send a chat completion to the local LLM gateway.

    Routes to Ollama (local) first, then falls back to Gemini cloud.
    """
    if not LLM_GATEWAY_ENABLED:
        raise HTTPException(503, "LLM gateway is disabled")
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(400, "prompt is required")
    result = await llm_gateway.chat(
        prompt=req.prompt,
        model=req.model,
        system=req.system,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        context=req.context,
    )
    if result.get("error") and not result.get("text"):
        raise HTTPException(502, result["error"])
    return result


@router.post("/llm/models/pull")
async def pull_model(body: dict) -> dict[str, Any]:
    """Download a model to the local Ollama instance."""
    model_name = body.get("model", "")
    if not model_name:
        raise HTTPException(400, "model is required")
    return await llm_gateway.pull_model(model_name)


@router.delete("/llm/models/{model_name}")
async def delete_model(model_name: str) -> dict[str, Any]:
    """Delete a model from the local Ollama instance."""
    return await llm_gateway.delete_model(model_name)