"""Free background removal for AI print designs (no outside service, no AI model).

Gemini cannot return a transparent PNG, so for designs it is asked to draw on one
solid chroma-green background. This removes that green with plain Pillow maths:
  * alpha comes from how far each pixel is from the key colour (soft edge, so
    anti-aliased outlines stay smooth instead of jagged);
  * green "spill" left on edge pixels is pulled back toward neutral;
  * the result is trimmed to the artwork with a small margin.
If the picture does not have a mostly-green border (the model ignored the
instruction), the image is returned unchanged rather than damaged.
"""
from io import BytesIO
from typing import Tuple

KEY = (0, 255, 0)          # what the prompt asks for: pure #00FF00
INNER, OUTER = 70.0, 150.0  # colour distance: <= INNER fully clear, >= OUTER fully solid


def _dist(r: int, g: int, b: int, key: Tuple[int, int, int]) -> float:
    return ((r - key[0]) ** 2 + (g - key[1]) ** 2 + (b - key[2]) ** 2) ** 0.5


def _border_key(img) -> Tuple[Tuple[int, int, int], float]:
    """The real background colour, read from the image border, and how much of the border is green."""
    w, h = img.size
    px = img.load()
    samples = []
    step = max(1, min(w, h) // 60)
    for x in range(0, w, step):
        samples += [px[x, 0], px[x, h - 1]]
    for y in range(0, h, step):
        samples += [px[0, y], px[w - 1, y]]
    greens = [s[:3] for s in samples if s[1] > 150 and s[1] > s[0] + 60 and s[1] > s[2] + 60]
    share = len(greens) / max(1, len(samples))
    if not greens:
        return KEY, 0.0
    n = len(greens)
    return (sum(g[0] for g in greens) // n, sum(g[1] for g in greens) // n, sum(g[2] for g in greens) // n), share


def remove_green_background(data: bytes, margin: int = 24) -> bytes:
    from PIL import Image
    img = Image.open(BytesIO(data)).convert("RGBA")
    key, share = _border_key(img)
    if share < 0.6:
        return data                      # not on a green background: leave it as it is
    w, h = img.size
    src = img.load()
    out = Image.new("RGBA", (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            d = _dist(r, g, b, key)
            if d <= INNER:
                dst[x, y] = (0, 0, 0, 0)
                continue
            alpha = 255 if d >= OUTER else int(255 * (d - INNER) / (OUTER - INNER))
            # despill: green that is stronger than both red and blue is clamped to their max
            limit = max(r, b)
            if g > limit:
                g = limit + (g - limit) // 4 if alpha == 255 else limit
            dst[x, y] = (r, g, b, min(a, alpha))
    bbox = out.getbbox()
    if bbox:
        l, t, rr, bb = bbox
        out = out.crop((max(0, l - margin), max(0, t - margin), min(w, rr + margin), min(h, bb + margin)))
    buf = BytesIO()
    out.save(buf, "PNG", optimize=True)
    return buf.getvalue()
