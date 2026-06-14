"""Gemini LLM client — thin backwards-compatible wrapper around GeminiProvider."""
from __future__ import annotations

import os
from dotenv import load_dotenv

load_dotenv()

# Re-export the provider for direct use within the llm package.
from llm.provider import GeminiProvider as _GeminiProvider  # noqa: E402

_instance: _GeminiProvider | None = None


def _get_instance() -> _GeminiProvider:
    global _instance
    if _instance is None:
        _instance = _GeminiProvider()
    return _instance


def ask_gemini(prompt: str) -> str:
    """Ask Gemini a question. Raises RuntimeError if the API key is not configured."""
    return _get_instance().ask(prompt)
