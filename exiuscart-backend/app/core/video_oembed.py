"""
Server-side oEmbed lookups for seller-pasted YouTube/TikTok video links.

Both platforms expose a free, keyless oEmbed endpoint — this is the only
place in ExiusCart that talks to them. A seller pastes a link, we resolve
it to a thumbnail/title/embed snippet once and store it, so every
storefront (any Custom Website seller connects) gets a ready-to-render
video without reimplementing YouTube/TikTok parsing itself. Clicking
through plays the real platform video, so views genuinely count there.
"""
import re
import logging
import httpx

logger = logging.getLogger(__name__)

_YOUTUBE_RE = re.compile(r"(youtube\.com|youtu\.be)", re.I)
_TIKTOK_RE = re.compile(r"tiktok\.com", re.I)


def detect_platform(url: str) -> str | None:
    if _YOUTUBE_RE.search(url):
        return "youtube"
    if _TIKTOK_RE.search(url):
        return "tiktok"
    return None


def fetch_oembed(url: str) -> dict | None:
    """Returns {platform, thumbnail_url, title, embed_html}, or None if the
    URL isn't a recognized YouTube/TikTok link or the lookup fails (private
    video, deleted, malformed link, platform temporarily unreachable)."""
    platform = detect_platform(url)
    if not platform:
        return None

    endpoint = "https://www.youtube.com/oembed" if platform == "youtube" else "https://www.tiktok.com/oembed"
    try:
        with httpx.Client(timeout=8) as client:
            r = client.get(endpoint, params={"url": url, "format": "json"})
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning(f"[VIDEO OEMBED] {platform} lookup failed for {url}: {e}")
        return None

    return {
        "platform": platform,
        "thumbnail_url": data.get("thumbnail_url"),
        "title": data.get("title"),
        "embed_html": data.get("html"),
    }
