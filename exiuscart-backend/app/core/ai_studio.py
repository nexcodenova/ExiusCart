"""
AI Studio: better product copy and product images, for sellers and for the
Prodora catalogue.

Each job goes to the model that is best at it, with a fallback so one provider
being down (or its key missing) never breaks the feature:

  SEO keywords          Gemini with Google Search grounding (real search data) -> GPT -> Claude
  Title/description/FAQ GPT -> Claude -> Gemini
  Product photos and
  clothing-on-a-model   Gemini image (keeps the real product) -> GPT image
  Ad banners with text  GPT image (best at readable text) -> Gemini image

Nothing here is saved to a product: callers show the result and the seller
accepts it. Every call is logged as an `ai_studio_call` event with its
estimated cost, for the admin spend meter and for the per-plan image limits.

Keys (server environment): OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY.
Models can be changed without a deploy:
  OPENAI_TEXT_MODEL (gpt-5-mini), OPENAI_IMAGE_MODEL (gpt-image-1.5),
  GEMINI_TEXT_MODEL (gemini-2.5-flash), GEMINI_IMAGE_MODEL (gemini-2.5-flash-image)
Prices for the estimate (USD): AI_STUDIO_IMAGE_USD (0.067), AI_STUDIO_TEXT_USD (0.005)

UNVERIFIED against live accounts: the OpenAI and Gemini request shapes follow
their public REST docs; they have not run with real keys yet.
"""
import base64
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

STUDIO_EVENT = "ai_studio_call"

# AI images a month per plan (founder's decision 2026-10-02). Launch has none.
IMAGE_LIMITS = {"growth": 75, "scale": 200}
# Copy rewrites cost under a cent; this only stops runaway use.
TEXT_DAILY_LIMIT = 100

IMAGE_MODES = ("studio", "lifestyle", "model", "ad")


class StudioError(Exception):
    def __init__(self, message: str, code: str = "ai_failed"):
        super().__init__(message)
        self.message, self.code = message, code


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _price(name: str, default: float) -> float:
    try:
        return max(0.0, float(os.getenv(name, default)))
    except ValueError:
        return default


def available() -> Dict[str, bool]:
    return {"openai": bool(_env("OPENAI_API_KEY")), "gemini": bool(_env("GEMINI_API_KEY")),
            "claude": bool(_env("ANTHROPIC_API_KEY"))}


# ── usage + limits ───────────────────────────────────────────────────────────

def log_call(db, shop_id: Optional[int], kind: str, provider: str, purpose: str) -> None:
    """Never raises: logging must not lose the seller a result they paid for."""
    try:
        from app.core.intel import record_event
        cost = _price("AI_STUDIO_IMAGE_USD", 0.067) if kind == "image" else _price("AI_STUDIO_TEXT_USD", 0.005)
        record_event(db, STUDIO_EVENT, shop_id=shop_id, entity_type="ai_studio",
                     payload={"kind": kind, "provider": provider, "purpose": purpose, "cost": cost})
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[ai-studio] could not log usage: {type(e).__name__}: {e}")


def _month_start() -> datetime:
    return datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _count(db, shop_id: int, kind: str, since: datetime) -> int:
    from app.models.intel import PlatformEvent
    rows = db.query(PlatformEvent.payload).filter(
        PlatformEvent.event_type == STUDIO_EVENT, PlatformEvent.shop_id == shop_id, PlatformEvent.created_at >= since,
    ).all()
    return sum(1 for (p,) in rows if (p or {}).get("kind") == kind)


def usage(db, shop_id: int, plan: str) -> dict:
    limit = IMAGE_LIMITS.get(plan, 0)
    used = _count(db, shop_id, "image", _month_start())
    return {"plan": plan, "images_used": used, "images_limit": limit, "images_left": max(0, limit - used),
            "providers": available()}


def check_image_allowance(db, shop_id: int, plan: str) -> None:
    u = usage(db, shop_id, plan)
    if u["images_limit"] == 0:
        raise StudioError("AI images are part of the Growth (75 a month) and Scale (200 a month) plans.", "plan_required")
    if u["images_left"] <= 0:
        raise StudioError(f"You've used all {u['images_limit']} AI images for this month. They reset on the 1st.", "limit_reached")


def check_text_allowance(db, shop_id: int) -> None:
    day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if _count(db, shop_id, "text", day) >= TEXT_DAILY_LIMIT:
        raise StudioError(f"That's {TEXT_DAILY_LIMIT} AI rewrites today, the daily limit. Try again tomorrow.", "limit_reached")


# ── providers: text ──────────────────────────────────────────────────────────

def _parse_json(raw: str) -> Optional[Any]:
    from app.intel.ai import parse_json
    return parse_json(raw or "")


def _openai_text(prompt: str) -> Optional[dict]:
    key = _env("OPENAI_API_KEY")
    if not key:
        return None
    r = httpx.post("https://api.openai.com/v1/chat/completions", timeout=60, headers={"Authorization": f"Bearer {key}"}, json={
        "model": _env("OPENAI_TEXT_MODEL", "gpt-5-mini"),
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
    })
    if r.status_code >= 300:
        raise StudioError(f"OpenAI: {r.text[:200]}")
    return _parse_json(r.json()["choices"][0]["message"]["content"])


def _gemini_text(prompt: str, search: bool = False) -> Optional[dict]:
    key = _env("GEMINI_API_KEY")
    if not key:
        return None
    body: Dict[str, Any] = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    if search:
        body["tools"] = [{"google_search": {}}]  # grounding: real search results behind the keywords
    else:
        body["generationConfig"] = {"responseMimeType": "application/json"}
    model = _env("GEMINI_TEXT_MODEL", "gemini-2.5-flash")
    r = httpx.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                   params={"key": key}, json=body, timeout=60)
    if r.status_code >= 300:
        raise StudioError(f"Gemini: {r.text[:200]}")
    parts = ((r.json().get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
    return _parse_json("".join(p.get("text", "") for p in parts))


def _claude_text(prompt: str) -> Optional[dict]:
    from app.intel import ai
    return ai.ask_json(prompt, max_tokens=2500, purpose="ai_studio_copy")


def _first_working(order: List[Tuple[str, Any]]) -> Tuple[Optional[dict], Optional[str]]:
    last_error = None
    for name, fn in order:
        try:
            out = fn()
        except StudioError as e:
            last_error = e.message
            logger.warning(f"[ai-studio] {name} failed: {e.message}")
            continue
        except Exception as e:  # noqa: BLE001 - network etc.: try the next provider
            last_error = str(e)
            logger.warning(f"[ai-studio] {name} failed: {type(e).__name__}: {e}")
            continue
        if isinstance(out, dict) and out:
            return out, name
    if last_error is None:
        raise StudioError("No AI provider is set up yet. Add OPENAI_API_KEY or GEMINI_API_KEY on the server.", "not_configured")
    raise StudioError("The AI couldn't write this right now. Try again in a minute.")


# ── copy ─────────────────────────────────────────────────────────────────────

def _product_brief(p: dict) -> str:
    return json.dumps({k: v for k, v in p.items() if v}, ensure_ascii=False)[:6000]


def seo_keywords(product: dict, country: str = "") -> Tuple[List[str], str]:
    where = f" in {country}" if country else ""
    prompt = (
        "You are an ecommerce SEO researcher. Using Google Search, find the search phrases real shoppers"
        f"{where} type to find this product. Prefer specific buying phrases over single generic words.\n"
        f"PRODUCT: {_product_brief(product)}\n"
        'Reply with JSON only: {"keywords": ["...", ...]} with 8 to 12 phrases, most valuable first, lowercase.'
    )
    out, provider = _first_working([
        ("gemini", lambda: _gemini_text(prompt, search=True)),
        ("openai", lambda: _openai_text(prompt)),
        ("claude", lambda: _claude_text(prompt)),
    ])
    kws = [str(k).strip().lower() for k in (out.get("keywords") or []) if str(k).strip()]
    return list(dict.fromkeys(kws))[:12], provider


def improve_copy(product: dict, keywords: List[str], language: str = "English") -> Tuple[dict, str]:
    prompt = (
        "You are a senior ecommerce conversion copywriter. Rewrite this product's listing so it ranks on Google "
        "and sells. Rules: only claim what the product data supports (no invented specs, certifications, reviews "
        "or numbers); no ALL CAPS; no emojis in the title; plain, confident sentences; write in " + language + ".\n"
        f"PRODUCT DATA: {_product_brief(product)}\n"
        f"TARGET SEARCH KEYWORDS: {', '.join(keywords) or 'choose sensible ones'}\n"
        "Reply with JSON only, exactly these keys:\n"
        '{"title": "max 70 chars, main keyword near the start",'
        ' "seo_title": "max 60 chars, for the Google result",'
        ' "meta_description": "max 155 chars, a reason to click",'
        ' "description_html": "3-5 short paragraphs and one <ul> of features, using only <p>, <ul>, <li>, <strong>",'
        ' "benefits": ["5 short benefit lines, max 60 chars each"],'
        ' "faq": [{"question": "...", "answer": "..."}] (4 to 6 real buyer questions the data can answer)}'
    )
    out, provider = _first_working([
        ("openai", lambda: _openai_text(prompt)),
        ("claude", lambda: _claude_text(prompt)),
        ("gemini", lambda: _gemini_text(prompt)),
    ])
    return {
        "title": str(out.get("title") or "")[:200].strip(),
        "seo_title": str(out.get("seo_title") or "")[:80].strip(),
        "meta_description": str(out.get("meta_description") or "")[:200].strip(),
        "description_html": _clean_html(str(out.get("description_html") or "")),
        "benefits": [str(b)[:80].strip() for b in (out.get("benefits") or []) if str(b).strip()][:6],
        "faq": [{"question": str(f.get("question", ""))[:200], "answer": str(f.get("answer", ""))[:800]}
                for f in (out.get("faq") or []) if isinstance(f, dict) and f.get("question") and f.get("answer")][:8],
    }, provider


def _clean_html(html: str) -> str:
    """Only the tags we asked for: an AI reply is untrusted text going onto a storefront."""
    import re
    html = re.sub(r"<(script|style|iframe)[\s\S]*?</\1>", "", html, flags=re.I)
    return re.sub(r"<(?!/?(p|ul|ol|li|strong|em|br)\b)[^>]*>", "", html, flags=re.I).strip()


# ── images ───────────────────────────────────────────────────────────────────

def image_prompt(mode: str, product_name: str, extra: str = "", model_look: str = "") -> str:
    base = f'The product is "{product_name}". Keep the product exactly as it is in the reference photo: same shape, colours, logo, print and text. Do not add brand names or text unless asked.'
    prompts = {
        "studio": "Professional ecommerce product photo on a clean pure white background, soft studio lighting, sharp focus, centred, natural shadow. " + base,
        "lifestyle": "Realistic lifestyle photo of the product being used in a natural, attractive real-world setting that suits it, natural light, shallow depth of field, magazine quality. " + base,
        "model": ("Realistic fashion photo of a model wearing this exact garment, front view, full outfit visible, natural pose, "
                  "clean light studio background, the garment's print/graphic placed and scaled exactly as in the reference. "
                  + (f"Model: {model_look}. " if model_look else "") + base),
        "ad": "Eye-catching square social media ad image for the product with a short bold headline and clean modern layout, high contrast, product clearly visible. " + base,
    }
    return prompts[mode] + (f" Extra direction: {extra}" if extra else "")


def _gemini_image(prompt: str, ref: Optional[Tuple[bytes, str]]) -> Optional[bytes]:
    key = _env("GEMINI_API_KEY")
    if not key:
        return None
    parts: List[dict] = [{"text": prompt}]
    if ref:
        parts.append({"inline_data": {"mime_type": ref[1], "data": base64.b64encode(ref[0]).decode()}})
    model = _env("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
    r = httpx.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                   params={"key": key}, json={"contents": [{"role": "user", "parts": parts}]}, timeout=120)
    if r.status_code >= 300:
        raise StudioError(f"Gemini image: {r.text[:200]}")
    for part in ((r.json().get("candidates") or [{}])[0].get("content") or {}).get("parts") or []:
        data = (part.get("inlineData") or part.get("inline_data") or {}).get("data")
        if data:
            return base64.b64decode(data)
    raise StudioError("Gemini returned no image (it may have declined this photo).")


def _openai_image(prompt: str, ref: Optional[Tuple[bytes, str]], transparent: bool = False) -> Optional[bytes]:
    key = _env("OPENAI_API_KEY")
    if not key:
        return None
    model = _env("OPENAI_IMAGE_MODEL", "gpt-image-1.5")
    headers = {"Authorization": f"Bearer {key}"}
    if ref:
        ext = "png" if "png" in ref[1] else "jpg"
        r = httpx.post("https://api.openai.com/v1/images/edits", headers=headers, timeout=180,
                       data={"model": model, "prompt": prompt, "size": "1024x1024", "quality": "medium"},
                       files={"image[]": (f"ref.{ext}", ref[0], ref[1])})
    else:
        body = {"model": model, "prompt": prompt, "size": "1024x1024", "quality": "medium"}
        if transparent:
            body.update({"background": "transparent", "output_format": "png"})  # a print file needs no background
        r = httpx.post("https://api.openai.com/v1/images/generations", headers=headers, timeout=180, json=body)
    if r.status_code >= 300:
        raise StudioError(f"OpenAI image: {r.text[:200]}")
    b64 = ((r.json().get("data") or [{}])[0]).get("b64_json")
    if not b64:
        raise StudioError("OpenAI returned no image.")
    return base64.b64decode(b64)


def fetch_reference(url: str) -> Tuple[bytes, str]:
    if not url or not url.startswith(("http://", "https://")):
        raise StudioError("Pick one of the product's photos to start from.", "no_reference")
    r = httpx.get(url, timeout=30, follow_redirects=True)
    ctype = (r.headers.get("content-type") or "image/jpeg").split(";")[0].strip()
    if r.status_code >= 300 or not ctype.startswith("image/"):
        raise StudioError("Couldn't load that photo. Try another one.", "no_reference")
    if len(r.content) > 15 * 1024 * 1024:
        raise StudioError("That photo is too large (over 15 MB).", "no_reference")
    return r.content, ctype


def generate_image(mode: str, product_name: str, reference_url: str, extra: str = "", model_look: str = "") -> Tuple[bytes, str]:
    if mode not in IMAGE_MODES:
        raise StudioError("Unknown image type.", "bad_request")
    ref = fetch_reference(reference_url)
    prompt = image_prompt(mode, product_name, extra.strip()[:300], model_look.strip()[:120])
    order = [("openai", _openai_image), ("gemini", _gemini_image)] if mode == "ad" else [("gemini", _gemini_image), ("openai", _openai_image)]
    return _run_image(order, prompt, ref)


# ── print on demand: designs + mockups ───────────────────────────────────────

DESIGN_STYLES = {
    "vintage": "vintage distressed retro print, faded textures, 70s/80s feel",
    "minimal": "minimal clean line art, few colours, lots of breathing room",
    "typography": "bold typography-led design, the words are the design",
    "retro_sunset": "retro sunset with stripes and bold outlines",
    "cartoon": "fun cartoon illustration with thick outlines",
    "streetwear": "edgy streetwear graphic, high contrast",
    "floral": "hand-drawn floral illustration",
    "badge": "circular badge/emblem style, like a vintage patch",
}

GARMENTS = {
    "tshirt": "crew-neck t-shirt", "oversized_tshirt": "oversized drop-shoulder t-shirt", "hoodie": "pullover hoodie",
    "sweatshirt": "crew-neck sweatshirt", "tank": "tank top", "kids_tshirt": "kids t-shirt", "tote": "canvas tote bag",
    "mug": "11oz ceramic mug", "cap": "baseball cap", "poster": "framed poster", "phone_case": "phone case",
}

MOCKUP_STYLES = {
    "model": "worn by a realistic model, natural pose, the print clearly visible on the chest",
    "flat_lay": "flat lay on a clean surface, styled with a few simple props, shot from above",
    "hanging": "hanging on a wooden hanger against a plain wall",
    "folded": "neatly folded, styled product shot",
    "bundle": "a grid of several of these products in different garment colours, Etsy bundle listing style, all with the same print",
    "lifestyle": "in a real lifestyle scene where the buyer would use it",
    "closeup": "a close-up detail shot of the print on the fabric, showing the ink texture and stitching",
}

# Ready-made scenes for "on a model" / "lifestyle" shots (Etsy best-seller look)
MOCKUP_SCENES = {
    "street": "on a sunny city street with cafés and old buildings behind",
    "cafe": "at a cosy café table, holding an iced coffee",
    "beach": "on a bright beach boardwalk in summer light",
    "home": "relaxing at home in a bright, airy living room",
    "park": "in a green park with soft golden-hour light",
    "studio": "against a plain light studio backdrop",
}

# The washed, garment-dyed look of Comfort Colors style shirts
FABRICS = {
    "standard": "",
    "garment_dyed": "Heavyweight garment-dyed cotton with a soft, washed, slightly faded vintage look (Comfort Colors style).",
}

# One click, a full listing set
MOCKUP_SET = [
    {"style": "model", "placement": "front", "label": "Front on a model"},
    {"style": "model", "placement": "back", "label": "Back on a model"},
    {"style": "closeup", "placement": "front", "label": "Print close-up"},
    {"style": "flat_lay", "placement": "front", "label": "Flat lay"},
]


def design_prompt(idea: str, style: str = "", text: str = "") -> str:
    parts = [
        "A print-ready graphic design for a t-shirt / print-on-demand product.",
        f"Idea: {idea.strip()[:400]}.",
    ]
    if style in DESIGN_STYLES:
        parts.append(f"Style: {DESIGN_STYLES[style]}.")
    if text.strip():
        parts.append(f'Include exactly this text, spelled correctly: "{text.strip()[:80]}".')
    parts.append("Only the artwork itself, centred, isolated, no t-shirt, no mockup, no background scene, no watermark. "
                 "Crisp edges and a limited colour palette that prints well. Do not copy any brand, logo or copyrighted character.")
    return " ".join(parts)


def mockup_prompt(garment: str, color: str, style: str, model_look: str = "", extra: str = "",
                  placement: str = "front", scene: str = "", fabric: str = "standard") -> str:
    g = GARMENTS.get(garment, "t-shirt")
    st = MOCKUP_STYLES.get(style, MOCKUP_STYLES["model"])
    if placement == "back":
        st = st.replace("the print clearly visible on the chest", "seen from behind, looking over the shoulder")
        st += ", the print large on the BACK of the garment between the shoulder blades"
    p = (f"Photorealistic product mockup of a {color or 'white'} {g}, {st}. "
         "Print the reference artwork on it exactly as given: same design, colours, text and proportions, "
         "placed and scaled like a real screen print, following the fabric's folds. Do not change or redraw the artwork. "
         "Professional ecommerce photo, soft natural light, sharp focus.")
    if FABRICS.get(fabric):
        p += " " + FABRICS[fabric]
    if scene in MOCKUP_SCENES and style in ("model", "lifestyle"):
        p += f" Setting: {MOCKUP_SCENES[scene]}."
    if model_look and style in ("model", "lifestyle"):
        p += f" Model: {model_look.strip()[:120]}."
    if extra:
        p += f" Extra direction: {extra.strip()[:300]}"
    return p


def generate_design(idea: str, style: str = "", text: str = "") -> Tuple[bytes, str]:
    """GPT first: it handles text in images best and can return a transparent PNG."""
    if not idea.strip():
        raise StudioError("Describe the design you want.", "bad_request")
    prompt = design_prompt(idea, style, text)

    def gemini_cutout(p, r):
        # Gemini has no transparent output: draw on solid chroma green, then cut the green out for free
        raw = _gemini_image(p + " Place the artwork on a solid, flat, pure bright green (#00FF00) background filling the whole image, "
                                "with no shadow, no gradient and no green anywhere inside the artwork itself.", r)
        if not raw:
            return raw
        from app.core.cutout import remove_green_background
        try:
            return remove_green_background(raw)
        except Exception as e:  # noqa: BLE001 - a failed cut-out still returns the design
            logger.warning(f"[ai-studio] background removal failed: {type(e).__name__}")
            return raw

    order = [("openai", lambda p, r: _openai_image(p, r, transparent=True)), ("gemini", gemini_cutout)]
    return _run_image(order, prompt, None)


def generate_mockup(design_url: str, garment: str, color: str, style: str, model_look: str = "", extra: str = "",
                    placement: str = "front", scene: str = "", fabric: str = "standard", ref=None) -> Tuple[bytes, str]:
    if garment not in GARMENTS or style not in MOCKUP_STYLES:
        raise StudioError("Unknown product or mockup style.", "bad_request")
    ref = ref or fetch_reference(design_url)
    prompt = mockup_prompt(garment, color.strip()[:40], style, model_look, extra,
                           "back" if placement == "back" else "front", scene, fabric if fabric in FABRICS else "standard")
    return _run_image([("gemini", _gemini_image), ("openai", _openai_image)], prompt, ref)


def _run_image(order, prompt: str, ref) -> Tuple[bytes, str]:
    last_error = None
    for name, fn in order:
        try:
            out = fn(prompt, ref)
        except StudioError as e:
            last_error = e.message
            logger.warning(f"[ai-studio] {name} image failed: {e.message}")
            continue
        except Exception as e:  # noqa: BLE001
            last_error = str(e)
            logger.warning(f"[ai-studio] {name} image failed: {type(e).__name__}: {e}")
            continue
        if out:
            return out, name
    if last_error is None:
        raise StudioError("AI images aren't set up yet. Add GEMINI_API_KEY or OPENAI_API_KEY on the server.", "not_configured")
    low = last_error.lower()
    # Account-side problems (no credit, quota, billing) are not the seller's fault: say so plainly
    if any(w in low for w in ("billing", "prepay", "credit", "quota", "resource_exhausted", "insufficient", "429", "payment")):
        logger.error(f"[ai-studio] image provider account problem: {last_error[:300]}")
        raise StudioError("AI images are paused on our side for a moment (provider account limit). Please try again later.", "provider_unavailable")
    raise StudioError("The AI couldn't make this image right now. Please try again in a moment.")
