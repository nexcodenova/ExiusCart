"""The one place Prodora intelligence talks to Claude.

Small and cheap on purpose: a fast model, short prompts, JSON out. If there is
no ANTHROPIC_API_KEY, or the call fails, `ask_json` returns None and every
caller has a plain-code fallback, so a missing key never breaks an analysis, it
only lowers its confidence.
"""
import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"  # same fast/cheap model the SEO tools use


def _get_client():
    """Replaceable in tests. None when AI isn't configured."""
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    import anthropic
    return anthropic.Anthropic(api_key=key, timeout=30.0)


def ask_json(prompt: str, max_tokens: int = 1000) -> Optional[Any]:
    client = _get_client()
    if client is None:
        return None
    try:
        msg = client.messages.create(model=MODEL, max_tokens=max_tokens, messages=[{"role": "user", "content": prompt}])
        raw = "".join(getattr(b, "text", "") for b in msg.content).strip()
    except Exception as e:  # noqa: BLE001 - any AI failure means "fall back to plain code"
        logger.warning(f"[intel] AI call failed: {type(e).__name__}: {e}")
        return None
    return parse_json(raw)


def parse_json(raw: str) -> Optional[Any]:
    """The first JSON object or array in the reply, or None."""
    starts = [i for i in (raw.find("{"), raw.find("[")) if i != -1]
    if not starts:
        return None
    start = min(starts)
    closer = "}" if raw[start] == "{" else "]"
    end = raw.rfind(closer)
    if end <= start:
        return None
    try:
        return json.loads(raw[start:end + 1])
    except ValueError:
        return None
