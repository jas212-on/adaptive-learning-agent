"""Pluggable LLM provider abstraction.

Set LLM_PROVIDER env var to switch between models:
  - gemini (default)
  - claude
  - openai
  - ollama

Each provider also tracks cost and latency telemetry.
"""

from __future__ import annotations

import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

log = logging.getLogger("ala.llm")


@dataclass
class LLMTelemetry:
    provider: str = ""
    model: str = ""
    total_calls: int = 0
    total_latency_ms: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    errors: int = 0

    @property
    def avg_latency_ms(self) -> float:
        return self.total_latency_ms / max(1, self.total_calls)

    def record(self, latency_ms: float, input_tokens: int = 0, output_tokens: int = 0) -> None:
        self.total_calls += 1
        self.total_latency_ms += latency_ms
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens

    def record_error(self) -> None:
        self.errors += 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model,
            "totalCalls": self.total_calls,
            "avgLatencyMs": round(self.avg_latency_ms, 1),
            "totalLatencyMs": round(self.total_latency_ms, 1),
            "totalInputTokens": self.total_input_tokens,
            "totalOutputTokens": self.total_output_tokens,
            "errors": self.errors,
        }


class LLMProvider(ABC):
    telemetry: LLMTelemetry

    @abstractmethod
    def ask(self, prompt: str) -> str: ...

    def ask_with_telemetry(self, prompt: str) -> tuple[str, float]:
        start = time.monotonic()
        try:
            result = self.ask(prompt)
            latency = (time.monotonic() - start) * 1000
            self.telemetry.record(latency)
            return result, latency
        except Exception:
            self.telemetry.record_error()
            raise

    def ping(self) -> tuple[str, float]:
        return self.ask_with_telemetry("Say 'pong'.")


class GeminiProvider(LLMProvider):
    def __init__(self) -> None:
        import google.generativeai as genai
        from dotenv import load_dotenv

        load_dotenv()
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Gemini API key not found. Set GOOGLE_API_KEY or GEMINI_API_KEY.")
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(model_name)
        self.telemetry = LLMTelemetry(provider="gemini", model=model_name)

    def ask(self, prompt: str) -> str:
        response = self._model.generate_content(prompt)
        return response.text


class ClaudeProvider(LLMProvider):
    def __init__(self) -> None:
        try:
            import anthropic
        except ImportError:
            raise RuntimeError("anthropic package not installed. Run: pip install anthropic")

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set.")
        model_name = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model_name
        self.telemetry = LLMTelemetry(provider="claude", model=model_name)

    def ask(self, prompt: str) -> str:
        message = self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text


class OpenAIProvider(LLMProvider):
    def __init__(self) -> None:
        try:
            from openai import OpenAI
        except ImportError:
            raise RuntimeError("openai package not installed. Run: pip install openai")

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set.")
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o")
        self._client = OpenAI(api_key=api_key)
        self._model = model_name
        self.telemetry = LLMTelemetry(provider="openai", model=model_name)

    def ask(self, prompt: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4096,
        )
        return response.choices[0].message.content or ""


class OllamaProvider(LLMProvider):
    def __init__(self) -> None:
        self._base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self._model = os.getenv("OLLAMA_MODEL", "llama3.2")
        self.telemetry = LLMTelemetry(provider="ollama", model=self._model)

    def ask(self, prompt: str) -> str:
        import urllib.request
        import json

        data = json.dumps({"model": self._model, "prompt": prompt, "stream": False}).encode()
        req = urllib.request.Request(
            f"{self._base_url}/api/generate",
            data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read())
        return result.get("response", "")


_PROVIDERS: dict[str, type[LLMProvider]] = {
    "gemini": GeminiProvider,
    "claude": ClaudeProvider,
    "openai": OpenAIProvider,
    "ollama": OllamaProvider,
}

_provider_instance: LLMProvider | None = None


def get_provider() -> LLMProvider:
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    name = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    cls = _PROVIDERS.get(name)
    if cls is None:
        supported = ", ".join(_PROVIDERS.keys())
        raise RuntimeError(f"Unknown LLM_PROVIDER '{name}'. Supported: {supported}")

    _provider_instance = cls()
    log.info("LLM provider initialized: %s (%s)", name, _provider_instance.telemetry.model)
    return _provider_instance


def get_telemetry() -> dict[str, Any]:
    if _provider_instance is None:
        return {"provider": "not_initialized"}
    return _provider_instance.telemetry.to_dict()
