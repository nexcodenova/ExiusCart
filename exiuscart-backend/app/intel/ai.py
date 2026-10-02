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
AI_EVENT = "intel_ai_call"
SessionLocal = None      # the session factory used to log usage; the app's own unless a test replaces it


def _get_client():
    """Replaceable in tests. None when AI isn't configured."""
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    import anthropic
    return anthropic.Anthropic(api_key=key, timeout=30.0)


def _log_usage(purpose: str, msg: Any) -> None:
    """One event per Claude call with the tokens it used, for the admin spend meter. Never raises."""
    try:
        usage = getattr(msg, "usage", None)
        tin, tout = int(getattr(usage, "input_tokens", 0) or 0), int(getattr(usage, "output_tokens", 0) or 0)
        from app.core import database
        from app.core.intel import record_event
        db = (SessionLocal or database.SessionLocal)()
        try:
            record_event(db, AI_EVENT, entity_type="ai", payload={"purpose": purpose, "in": tin, "out": tout, "model": MODEL})
        finally:
            db.close()
    except Exception as e:  # noqa: BLE001 - logging must never break an analysis
        logger.warning(f"[intel] could not log AI usage: {type(e).__name__}")


def configured() -> bool:
    """Any AI at all: Claude, or the GPT / Gemini keys AI Studio uses."""
    import os
    return _get_client() is not None or bool(os.getenv("OPENAI_API_KEY", "").strip()) or bool(os.getenv("GEMINI_API_KEY", "").strip())


def ask_json(prompt: str, max_tokens: int = 1000, purpose: str = "analysis") -> Optional[Any]:
    """Claude first; without it (or if it fails), GPT, then Gemini. None = fall back to plain code."""
    client = _get_client()
    if client is not None:
        try:
            msg = client.messages.create(model=MODEL, max_tokens=max_tokens, messages=[{"role": "user", "content": prompt}])
            raw = "".join(getattr(b, "text", "") for b in msg.content).strip()
            _log_usage(purpose, msg)
            return parse_json(raw)
        except Exception as e:  # noqa: BLE001 - any AI failure means "try the next one"
            logger.warning(f"[intel] Claude call failed: {type(e).__name__}: {e}")
    from app.core import ai_studio
    for name, fn in (("openai", ai_studio._openai_text), ("gemini", lambda p: ai_studio._gemini_text(p))):
        try:
            out = fn(prompt)
            if out is not None:
                return out
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[intel] {name} call failed: {type(e).__name__}")
    return None


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
