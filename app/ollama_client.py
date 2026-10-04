import json
import logging
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

    async def check_connection(self) -> Dict[str, Any]:
        """Check if Ollama is running and whether the target model is available."""
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
        """Call Ollama /api/chat endpoint with non-streaming JSON response format."""
        url = f"{self.base_url}/api/chat"
        temp = temperature if temperature is not None else settings.kyumei_temperature
        
        payload: Dict[str, Any] = {
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
