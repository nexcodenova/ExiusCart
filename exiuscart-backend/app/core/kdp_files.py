"""Print-ready files for Amazon KDP paperbacks, built from a finished PDF.

KDP has no upload API: the seller uploads these in the KDP dashboard by hand.
This only prepares the files so that step takes minutes. Numbers below are KDP's
published paperback rules for black-and-white interiors; the seller should still
confirm the cover size in KDP's own cover calculator before uploading.
"""
import io
import re
from typing import Optional

from PIL import Image
from pypdf import PdfReader, PdfWriter, Transformation, PageObject

# Trim sizes (inches) commonly used for drawing and coloring books.
TRIMS = {
    "8.5x11": (8.5, 11.0),
    "8.5x8.5": (8.5, 8.5),
    "8x10": (8.0, 10.0),
    "7x10": (7.0, 10.0),
    "6x9": (6.0, 9.0),
}
# Paper thickness per page, in inches (KDP black-and-white interiors).
PAPER = {
    "white_bw": ("White paper, black ink", 0.002252),
    "cream_bw": ("Cream paper, black ink", 0.0025),
}
MIN_PAGES = 24     # KDP paperback minimum
MAX_PAGES = 828    # KDP paperback maximum
MIN_SPINE_TEXT_PAGES = 79   # spine text is only allowed from here
COVER_BLEED = 0.125         # inches, each outer edge
DPI = 300
MAX_SOURCE_BYTES = 120 * 1024 * 1024


class KdpError(ValueError):
    pass


def check_options(trim: str, paper: str) -> None:
    if trim not in TRIMS:
        raise KdpError(f"Unknown trim size '{trim}'. Choose one of: {', '.join(TRIMS)}.")
    if paper not in PAPER:
        raise KdpError(f"Unknown paper '{paper}'. Choose one of: {', '.join(PAPER)}.")


def spine_width(pages: int, paper: str) -> float:
    return round(pages * PAPER[paper][1], 4)


def cover_size(trim: str, pages: int, paper: str) -> dict:
    w, h = TRIMS[trim]
    spine = spine_width(pages, paper)
    return {
        "width_in": round(2 * w + spine + 2 * COVER_BLEED, 4),
        "height_in": round(h + 2 * COVER_BLEED, 4),
        "spine_in": spine,
        "spine_text_allowed": pages >= MIN_SPINE_TEXT_PAGES,
    }


def final_page_count(source_pages: int) -> int:
    """KDP needs at least 24 pages; pad with blanks, and keep the count even so
    the last sheet is not half blank."""
    if source_pages > MAX_PAGES:
        raise KdpError(f"This book has {source_pages} pages; KDP paperbacks allow at most {MAX_PAGES}.")
    n = max(source_pages, MIN_PAGES)
    return n + (n % 2)


def read_source(pdf_bytes: bytes) -> PdfReader:
    if len(pdf_bytes) > MAX_SOURCE_BYTES:
        raise KdpError("The source PDF is too large to process.")
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        if reader.is_encrypted:
            raise KdpError("The source PDF is password protected.")
        if len(reader.pages) == 0:
            raise KdpError("The source PDF has no pages.")
        return reader
    except KdpError:
        raise
    except Exception:
        raise KdpError("The source file is not a readable PDF.")


def build_interior(pdf_bytes: bytes, trim: str) -> tuple:
    """Every page scaled to fit the trim size (no bleed, centred), padded with
    blank pages to a valid KDP count. Returns (pdf bytes, page count)."""
    reader = read_source(pdf_bytes)
    tw, th = TRIMS[trim][0] * 72, TRIMS[trim][1] * 72
    writer = PdfWriter()
    for src in reader.pages:
        sw, sh = float(src.mediabox.width), float(src.mediabox.height)
        rot = (src.get("/Rotate") or 0) % 360
        if rot in (90, 270):
            sw, sh = sh, sw
        page = PageObject.create_blank_page(width=tw, height=th)
        scale = min(tw / sw, th / sh)
        tx, ty = (tw - sw * scale) / 2, (th - sh * scale) / 2
        page.merge_transformed_page(src, Transformation().scale(scale).translate(tx, ty))
        writer.add_page(page)
    total = final_page_count(len(reader.pages))
    for _ in range(total - len(reader.pages)):
        writer.add_blank_page(width=tw, height=th)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue(), total


def build_cover(trim: str, pages: int, paper: str, front_image: Optional[bytes]) -> bytes:
    """A full wrap cover (back + spine + front) at 300 dpi with the front art
    placed on the front panel. The back is left blank on purpose: KDP places
    its own barcode there."""
    size = cover_size(trim, pages, paper)
    W, H = round(size["width_in"] * DPI), round(size["height_in"] * DPI)
    canvas = Image.new("RGB", (W, H), "white")
    if front_image:
        try:
            art = Image.open(io.BytesIO(front_image)).convert("RGB")
            tw, th = TRIMS[trim]
            # Front panel = right half incl. the outer bleed; scale to cover it, centre-crop.
            panel_w = round((tw + COVER_BLEED) * DPI)
            panel_h = H
            k = max(panel_w / art.width, panel_h / art.height)
            art = art.resize((max(1, round(art.width * k)), max(1, round(art.height * k))), Image.LANCZOS)
            left, top = (art.width - panel_w) // 2, (art.height - panel_h) // 2
            art = art.crop((left, top, left + panel_w, top + panel_h))
            canvas.paste(art, (W - panel_w, 0))
        except Exception:
            pass  # a cover picture that will not open just leaves the front white
    out = io.BytesIO()
    canvas.save(out, "PDF", resolution=float(DPI))
    return out.getvalue()


_TAG = re.compile(r"<[^>]+>")


def plain_text(html: Optional[str]) -> str:
    text = _TAG.sub(" ", html or "")
    text = re.sub(r"&nbsp;|&amp;|&quot;|&#39;", lambda m: {"&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&#39;": "'"}[m.group(0)], text)
    return re.sub(r"\s+", " ", text).strip()


_STOP = {"the", "a", "an", "and", "or", "for", "of", "to", "in", "on", "with", "your", "you", "this", "that", "is", "are", "it", "by", "from", "at", "as", "pack", "bundle"}


def keyword_ideas(name: str, description: Optional[str]) -> list:
    """Up to 7 phrases taken only from the book's own title and description
    (KDP allows 7 keyword slots). Suggestions to edit, not researched keywords."""
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z'-]+", name) if w.lower() not in _STOP]
    phrases = []
    for i in range(len(words)):
        for n in (3, 2):
            if i + n <= len(words):
                phrases.append(" ".join(words[i:i + n]).lower())
    for w in re.findall(r"[A-Za-z][A-Za-z'-]{4,}", plain_text(description)):
        if w.lower() not in _STOP:
            phrases.append(w.lower())
    seen, out = set(), []
    for p in phrases:
        if p not in seen:
            seen.add(p); out.append(p)
        if len(out) == 7:
            break
    return out
