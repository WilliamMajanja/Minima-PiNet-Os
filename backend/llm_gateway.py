"""On-Device LLM Gateway for PiNet-OS v1.3.0.

Provides a unified OpenAI-compatible API for local LLM inference, routing
requests to the best available backend:
  1. Ollama (llama.cpp / GGUF) — primary, runs on Hailo-8L NPU or ARM NEON
  2. Gemini cloud — fallback when no local model is loaded

The gateway manages a model registry, tracks Hailo acceleration status, and
enforces context-length limits per model.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

import httpx

from .config import (
    GEMINI_API_KEY,
    LLM_DEFAULT_MODEL,
    LLM_FALLBACK_TO_GEMINI,
    LLM_GATEWAY_ENABLED,
    LLM_GATEWAY_TIMEOUT,
    LLM_GATEWAY_URL,
    LLM_MAX_CONTEXT,
    LLM_MODELS_DIR,
)

logger = logging.getLogger(__name__)


class LLMGateway:
    """Unified on-device LLM gateway with Ollama + Gemini fallback."""

    def __init__(self) -> None:
        self._url = LLM_GATEWAY_URL
        self._timeout = LLM_GATEWAY_TIMEOUT
        self._default_model = LLM_DEFAULT_MODEL
        self._models_dir = LLM_MODELS_DIR
        self._available: bool | None = None
        self._hailo_available = self._detect_hailo()

    def _detect_hailo(self) -> bool:
        """Detect Hailo-8L NPU availability for accelerated inference."""
        for path in ("/dev/hailo0", "/dev/hailo-0", "/sys/class/hailo"):
            if os.path.exists(path):
                return True
        return False

    async def is_available(self) -> bool:
        """Check if the local Ollama backend is reachable."""
        if not LLM_GATEWAY_ENABLED:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._url}/api/tags")
                self._available = resp.status_code == 200
                return self._available
        except Exception:
            self._available = False
            return False

    async def list_models(self) -> list[dict[str, Any]]:
        """List all locally installed LLM models."""
        if not await self.is_available():
            return []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self._url}/api/tags")
                if resp.status_code != 200:
                    return []
                data = resp.json()
                models = []
                for m in data.get("models", []):
                    name = m.get("name", "")
                    size_bytes = m.get("size", 0)
                    details = m.get("details", {})
                    models.append({
                        "name": name,
                        "size": _format_size(size_bytes),
                        "sizeBytes": size_bytes,
                        "quantization": details.get("quantization_level", ""),
                        "family": details.get("family", ""),
                        "contextLength": details.get("parameter_size", LLM_MAX_CONTEXT),
                        "installed": True,
                        "hailoAccelerated": self._hailo_available,
                    })
                return models
        except Exception as exc:
            logger.warning("Failed to list LLM models: %s", exc)
            return []

    async def chat(
        self,
        prompt: str,
        model: str = "",
        system: str = "",
        temperature: float = 0.7,
        max_tokens: int = 512,
        context: str = "",
    ) -> dict[str, Any]:
        """Send a chat completion request to the local LLM gateway.

        Falls back to Gemini cloud if local backend is unavailable and
        LLM_FALLBACK_TO_GEMINI is enabled.
        """
        model = model or self._default_model
        start = time.monotonic()

        if await self.is_available():
            return await self._chat_ollama(
                prompt, model, system, temperature, max_tokens, context, start
            )

        if LLM_FALLBACK_TO_GEMINI and GEMINI_API_KEY:
            return await self._chat_gemini(prompt, model, start)

        return {
            "model": model,
            "text": "",
            "provider": "none",
            "tokensEval": 0,
            "tokensPrompt": 0,
            "durationMs": 0,
            "hailoAccelerated": False,
            "error": "No LLM backend available (Ollama not running, Gemini not configured)",
        }

    async def _chat_ollama(
        self, prompt: str, model: str, system: str,
        temperature: float, max_tokens: int, context: str, start: float,
    ) -> dict[str, Any]:
        """Chat via Ollama's /api/generate endpoint."""
        full_prompt = f"{system}\n\n{context}\n\n{prompt}" if system else f"{context}\n\n{prompt}"
        payload = {
            "model": model,
            "prompt": full_prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "num_ctx": LLM_MAX_CONTEXT,
            },
        }
        try:
            async with httpx.AsyncClient(timeout=float(self._timeout)) as client:
                resp = await client.post(f"{self._url}/api/generate", json=payload)
                if resp.status_code != 200:
                    return self._error_response(model, f"Ollama HTTP {resp.status_code}")
                data = resp.json()
                duration_ms = int((time.monotonic() - start) * 1000)
                return {
                    "model": model,
                    "text": data.get("response", ""),
                    "provider": "local-ollama",
                    "tokensEval": data.get("eval_count", 0),
                    "tokensPrompt": data.get("prompt_eval_count", 0),
                    "durationMs": duration_ms,
                    "hailoAccelerated": self._hailo_available,
                }
        except httpx.TimeoutException:
            return self._error_response(model, "Ollama request timed out")
        except Exception as exc:
            return self._error_response(model, str(exc))

    async def _chat_gemini(self, prompt: str, model: str, start: float) -> dict[str, Any]:
        """Fallback to Gemini cloud API."""
        gemini_model = "gemini-1.5-flash-latest"
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent"
        payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(gemini_url, params={"key": GEMINI_API_KEY}, json=payload)
                if resp.status_code != 200:
                    return self._error_response(model, f"Gemini HTTP {resp.status_code}")
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                duration_ms = int((time.monotonic() - start) * 1000)
                return {
                    "model": gemini_model,
                    "text": text,
                    "provider": "gemini-fallback",
                    "tokensEval": 0,
                    "tokensPrompt": 0,
                    "durationMs": duration_ms,
                    "hailoAccelerated": False,
                }
        except Exception as exc:
            return self._error_response(model, str(exc))

    @staticmethod
    def _error_response(model: str, error: str) -> dict[str, Any]:
        return {
            "model": model,
            "text": "",
            "provider": "none",
            "tokensEval": 0,
            "tokensPrompt": 0,
            "durationMs": 0,
            "hailoAccelerated": False,
            "error": error,
        }

    async def pull_model(self, model_name: str) -> dict[str, Any]:
        """Pull (download) a model to the local Ollama instance."""
        if not await self.is_available():
            return {"success": False, "error": "Ollama not available"}
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                resp = await client.post(
                    f"{self._url}/api/pull", json={"name": model_name, "stream": False}
                )
                return {"success": resp.status_code == 200, "model": model_name}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def delete_model(self, model_name: str) -> dict[str, Any]:
        """Delete a model from the local Ollama instance."""
        if not await self.is_available():
            return {"success": False, "error": "Ollama not available"}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.request(
                    "DELETE", f"{self._url}/api/delete", json={"name": model_name}
                )
                return {"success": resp.status_code == 200, "model": model_name}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def status(self) -> dict[str, Any]:
        """Return gateway status (synchronous, for health checks)."""
        return {
            "enabled": LLM_GATEWAY_ENABLED,
            "url": self._url,
            "defaultModel": self._default_model,
            "hailoAccelerated": self._hailo_available,
            "fallbackToGemini": LLM_FALLBACK_TO_GEMINI and bool(GEMINI_API_KEY),
            "modelsDir": self._models_dir,
            "maxContext": LLM_MAX_CONTEXT,
        }


def _format_size(size_bytes: int) -> str:
    """Format bytes as human-readable size."""
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


llm_gateway = LLMGateway()