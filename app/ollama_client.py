import json
import logging
import os
from typing import Any, Dict, List, Optional
import httpx

from app.config import settings

logger = logging.getLogger("kyumei.ollama")


class OllamaClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None
    ):
        self.base_url = (base_url or settings.ollama_host).rstrip("/")
        self.model = model or settings.kyumei_model
        self.timeout = timeout or settings.kyumei_request_timeout
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY") or settings.openrouter_api_key
        self.openrouter_model = os.environ.get("OPENROUTER_MODEL") or settings.openrouter_model

    async def check_connection(self) -> Dict[str, Any]:
        """Check if OpenRouter or local Ollama is available."""
        # 1. If OpenRouter API key is configured, verify OpenRouter connectivity
        if self.openrouter_api_key:
            return {
                "connected": True,
                "target_model": f"{self.openrouter_model} (OpenRouter)",
                "model_present": True,
                "available_models": [self.openrouter_model],
                "error": None
            }

        # 2. Otherwise verify local Ollama daemon
        url = f"{self.base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    is_model_present = any(
                        self.model == m or self.model in m or m.startswith(self.model)
                        for m in models
                    )
                    return {
                        "connected": True,
                        "target_model": self.model,
                        "model_present": is_model_present,
                        "available_models": models,
                        "error": None
                    }
                return {
                    "connected": False,
                    "target_model": self.model,
                    "model_present": False,
                    "available_models": [],
                    "error": f"Ollama returned HTTP {res.status_code}"
                }
        except httpx.ConnectError:
            return {
                "connected": False,
                "target_model": self.model,
                "model_present": False,
                "available_models": [],
                "error": f"Cannot connect to Ollama at {self.base_url}. Is Ollama running?"
            }
        except Exception as e:
            return {
                "connected": False,
                "target_model": self.model,
                "model_present": False,
                "available_models": [],
                "error": str(e)
            }

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        response_format: Optional[str] = "json"
    ) -> str:
        """Call OpenRouter or local Ollama chat endpoint with JSON response format."""
        temp = temperature if temperature is not None else settings.kyumei_temperature

        # 1. Route to OpenRouter if API key configured
        if self.openrouter_api_key:
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.openrouter_api_key}",
                "HTTP-Referer": "https://agent-kyumei.embarko.app",
                "X-Title": "Kyumei Hardware Diagnostics",
                "Content-Type": "application/json"
            }
            payload: Dict[str, Any] = {
                "model": self.openrouter_model,
                "messages": messages,
                "temperature": temp,
            }
            if response_format:
                payload["response_format"] = {"type": "json_object"}

            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "").strip()
                    raise RuntimeError("No completion choices returned by OpenRouter API")
            except Exception as exc:
                logger.error("OpenRouter request failed: %s", exc)
                raise

        # 2. Route to local Ollama daemon
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temp,
            }
        }
        if response_format:
            payload["format"] = response_format

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                content = data.get("message", {}).get("content", "")
                return content.strip()
        except httpx.ConnectError as exc:
            logger.error("Connection error to Ollama at %s: %s", url, exc)
            raise ConnectionError(
                f"Failed to connect to local Ollama server at {self.base_url}. "
                f"Please ensure Ollama is running ('ollama serve')."
            ) from exc
        except httpx.TimeoutException as exc:
            logger.error("Timeout waiting for Ollama response (%s s): %s", self.timeout, exc)
            raise TimeoutError(
                f"Ollama request timed out after {self.timeout}s. "
                "The local model may still be loading into GPU VRAM."
            ) from exc
        except httpx.HTTPStatusError as exc:
            logger.error("HTTP error from Ollama: %s", exc)
            raise RuntimeError(f"Ollama API returned HTTP {exc.response.status_code}: {exc.response.text}") from exc
