"""Amazon KDP, as a MANUAL channel.

KDP has no API, so nothing here talks to Amazon. Two things live here:

  1. Print-ready files for a purchased Prodora book (interior PDF, cover PDF,
     listing text) so the seller's upload to KDP takes minutes. Authenticated like
     the other Prodora digital-bundle routes; the seller must own the bundle.
  2. A tracker of the seller's KDP books (status, Amazon link, price) that the
     seller moves along by hand, shown as the "Amazon KDP" card on Sales Channels.
"""
import logging
import re
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.prodora_digital import _seller_shop
from app.api.v1.endpoints.shopping import get_prodora_user
from app.core import kdp_files
from app.core.database import get_db
from app.core.shop_access import get_shop_for_member
from app.core.thedersi import is_thedersi_restricted_shop
from app.models.kdp_book import KdpBook, KDP_STATUSES
from app.models.prodora_digital import ProdoraDigitalBundle, ProdoraDigitalPurchase
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

DESCRIPTION_LIMIT = 4000  # KDP's description length limit


def _download(url: Optional[str], what: str) -> bytes:
    if not url:
        raise HTTPException(status_code=400, detail=f"This book has no {what} file yet.")
    try:
        with httpx.Client(timeout=90, follow_redirects=True) as client:
            r = client.get(url)
        r.raise_for_status()
    except Exception as e:
        logger.warning(f"[KDP] could not fetch {what} {url}: {e}")
        raise HTTPException(status_code=502, detail=f"Could not load the book's {what} file. Try again in a moment.")
    if len(r.content) > kdp_files.MAX_SOURCE_BYTES:
        raise HTTPException(status_code=400, detail="The book file is too large to process.")
    return r.content


def _owned_bundle(bundle_id: int, user: User, db: Session):
    shop = _seller_shop(user, db)
    if not db.query(ProdoraDigitalPurchase.id).filter(
        ProdoraDigitalPurchase.bundle_id == bundle_id, ProdoraDigitalPurchase.shop_id == shop.id,
    ).first():
        raise HTTPException(status_code=403, detail="Purchase this book first.")
    bundle = db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.id == bundle_id).first()
    if not bundle:
        raise HTTPException(status_code=404, detail="Book not found.")
    return shop, bundle


def _options(trim: str, paper: str) -> None:
    try:
        kdp_files.check_options(trim, paper)
    except kdp_files.KdpError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _mark_files_ready(db: Session, shop_id: int, bundle_id: int) -> None:
    book = db.query(KdpBook).filter(KdpBook.shop_id == shop_id, KdpBook.bundle_id == bundle_id).first()
    if book and book.status == "not_started":
        book.status = "files_ready"
        db.commit()


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "book"


# ── 1. Print-ready files (Prodora side) ───────────────────────────────────────

@router.get("/prodora/digital-bundles/{bundle_id}/kdp/pack")
def kdp_pack(bundle_id: int, trim: str = "8.5x11", paper: str = "white_bw",
             db: Session = Depends(get_db), user: User = Depends(get_prodora_user)):
    _options(trim, paper)
    shop, bundle = _owned_bundle(bundle_id, user, db)
    try:
        source_pages = len(kdp_files.read_source(_download(bundle.pdf_file_url, "PDF")).pages)
        final = kdp_files.final_page_count(source_pages)
    except kdp_files.KdpError as e:
        raise HTTPException(status_code=400, detail=str(e))
    description = kdp_files.plain_text(bundle.description)[:DESCRIPTION_LIMIT]
    return {
        "bundle": {"id": bundle.id, "name": bundle.name},
        "options": {"trim": trim, "paper": paper},
        "choices": {
            "trims": list(kdp_files.TRIMS),
            "papers": {k: v[0] for k, v in kdp_files.PAPER.items()},
        },
        "interior": {"source_pages": source_pages, "final_pages": final, "blank_pages_added": final - source_pages,
                     "trim_in": list(kdp_files.TRIMS[trim])},
        "cover": kdp_files.cover_size(trim, final, paper),
        "listing": {
            "title": bundle.name,
            "description": description,
            "keywords": kdp_files.keyword_ideas(bundle.name, bundle.description),
            "suggested_list_price": float(bundle.suggested_resale_price) if bundle.suggested_resale_price is not None else None,
        },
        "checklist": [
            "Confirm the cover size in KDP's cover calculator before you upload; the spine depends on the page count.",
            "KDP gives a free ISBN. Choose that unless you own your own.",
            "Choose the same trim size and paper on KDP as you chose here.",
            "Check that the licence for this book lets you sell it in print, and follow KDP's content and AI-disclosure rules.",
            "Amazon may reject a book that other sellers already publish word for word. Personalise the title, cover or content.",
        ],
    }


@router.get("/prodora/digital-bundles/{bundle_id}/kdp/interior.pdf")
def kdp_interior(bundle_id: int, trim: str = "8.5x11", paper: str = "white_bw",
                 db: Session = Depends(get_db), user: User = Depends(get_prodora_user)):
    _options(trim, paper)
    shop, bundle = _owned_bundle(bundle_id, user, db)
    try:
        pdf, _ = kdp_files.build_interior(_download(bundle.pdf_file_url, "PDF"), trim)
    except kdp_files.KdpError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _mark_files_ready(db, shop.id, bundle.id)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{_slug(bundle.name)}-kdp-interior-{trim}.pdf"'})


@router.get("/prodora/digital-bundles/{bundle_id}/kdp/cover.pdf")
def kdp_cover(bundle_id: int, trim: str = "8.5x11", paper: str = "white_bw",
              db: Session = Depends(get_db), user: User = Depends(get_prodora_user)):
    _options(trim, paper)
    shop, bundle = _owned_bundle(bundle_id, user, db)
    try:
        source_pages = len(kdp_files.read_source(_download(bundle.pdf_file_url, "PDF")).pages)
        pages = kdp_files.final_page_count(source_pages)
    except kdp_files.KdpError as e:
        raise HTTPException(status_code=400, detail=str(e))
    art = None
    if bundle.cover_image_url:
        try:
            art = _download(bundle.cover_image_url, "cover image")
        except HTTPException:
            art = None
    pdf = kdp_files.build_cover(trim, pages, paper, art)
    _mark_files_ready(db, shop.id, bundle.id)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{_slug(bundle.name)}-kdp-cover-{trim}.pdf"'})


# ── 2. The seller's KDP books (manual tracker) ────────────────────────────────

def _est_royalty(book: KdpBook) -> Optional[float]:
    """KDP pays 60% of the list price minus the print cost (paperback). Only
    computed when the seller has typed both numbers."""
    if book.list_price is None or book.print_cost is None:
        return None
    return round(0.6 * float(book.list_price) - float(book.print_cost), 2)


def _book_out(book: KdpBook, bundle: Optional[ProdoraDigitalBundle]) -> dict:
    return {
        "id": book.id, "bundle_id": book.bundle_id, "title": book.title, "status": book.status,
        "trim": book.trim, "paper": book.paper, "amazon_url": book.amazon_url,
        "list_price": float(book.list_price) if book.list_price is not None else None,
        "print_cost": float(book.print_cost) if book.print_cost is not None else None,
        "est_royalty": _est_royalty(book), "notes": book.notes,
        "cover_image_url": bundle.cover_image_url if bundle else None,
        "updated_at": (book.updated_at or book.created_at).isoformat() if (book.updated_at or book.created_at) else None,
    }


class BookIn(BaseModel):
    bundle_id: Optional[int] = None
    title: Optional[str] = None
    trim: str = "8.5x11"
    paper: str = "white_bw"


class BookUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    trim: Optional[str] = None
    paper: Optional[str] = None
    amazon_url: Optional[str] = None
    list_price: Optional[float] = None
    print_cost: Optional[float] = None
    notes: Optional[str] = None

    @field_validator("list_price", "print_cost")
    @classmethod
    def _not_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("Must not be negative.")
        return v


def _shop(db: Session, shop_id: int, user: User):
    shop = get_shop_for_member(db, shop_id, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    # Prodora (where the books come from) is for direct ExiusCart sellers, not TheDersi-managed stores.
    if is_thedersi_restricted_shop(shop.id, db):
        raise HTTPException(status_code=403, detail="Amazon KDP is only available for direct ExiusCart sellers.")
    return shop


@router.get("/shops/{shop_id}/kdp/books")
def list_kdp_books(shop_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    books = db.query(KdpBook).filter(KdpBook.shop_id == shop.id).order_by(KdpBook.id.desc()).all()
    bundle_ids = {b.bundle_id for b in books if b.bundle_id}
    bundles = {b.id: b for b in db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.id.in_(bundle_ids)).all()} if bundle_ids else {}
    purchased = (
        db.query(ProdoraDigitalBundle)
        .join(ProdoraDigitalPurchase, ProdoraDigitalPurchase.bundle_id == ProdoraDigitalBundle.id)
        .filter(ProdoraDigitalPurchase.shop_id == shop.id)
        .all()
    )
    return {
        "books": [_book_out(b, bundles.get(b.bundle_id)) for b in books],
        # Purchased Prodora books not yet added to the tracker.
        "available": [{"id": p.id, "name": p.name, "cover_image_url": p.cover_image_url, "has_pdf": bool(p.pdf_file_url)}
                      for p in purchased if p.id not in bundle_ids],
        "statuses": list(KDP_STATUSES),
    }


@router.post("/shops/{shop_id}/kdp/books", status_code=201)
def add_kdp_book(shop_id: int, data: BookIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    _options(data.trim, data.paper)
    bundle = None
    title = (data.title or "").strip()
    if data.bundle_id is not None:
        bundle = db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.id == data.bundle_id).first()
        owned = db.query(ProdoraDigitalPurchase.id).filter(
            ProdoraDigitalPurchase.bundle_id == data.bundle_id, ProdoraDigitalPurchase.shop_id == shop.id).first()
        if not bundle or not owned:
            raise HTTPException(status_code=403, detail="Purchase this book first.")
        if db.query(KdpBook.id).filter(KdpBook.shop_id == shop.id, KdpBook.bundle_id == data.bundle_id).first():
            raise HTTPException(status_code=409, detail="This book is already in your KDP list.")
        title = title or bundle.name
    if not title:
        raise HTTPException(status_code=400, detail="Give the book a title.")
    book = KdpBook(shop_id=shop.id, bundle_id=data.bundle_id, title=title[:255], trim=data.trim, paper=data.paper)
    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_out(book, bundle)


@router.put("/shops/{shop_id}/kdp/books/{book_id}")
def update_kdp_book(shop_id: int, book_id: int, data: BookUpdate,
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    book = db.query(KdpBook).filter(KdpBook.id == book_id, KdpBook.shop_id == shop.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    fields = data.model_dump(exclude_unset=True)
    if "status" in fields and fields["status"] not in KDP_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(KDP_STATUSES)}.")
    trim, paper = fields.get("trim", book.trim), fields.get("paper", book.paper)
    _options(trim, paper)
    if fields.get("amazon_url"):
        url = fields["amazon_url"].strip()
        if not re.match(r"^https?://", url, re.I):
            raise HTTPException(status_code=400, detail="The Amazon link must start with https://")
        fields["amazon_url"] = url[:1000]
    if "title" in fields and not (fields["title"] or "").strip():
        raise HTTPException(status_code=400, detail="The title can't be empty.")
    if fields.get("status") == "live" and not (fields.get("amazon_url") or book.amazon_url):
        raise HTTPException(status_code=400, detail="Add the Amazon link before marking the book Live.")
    for k, v in fields.items():
        setattr(book, k, v)
    db.commit()
    db.refresh(book)
    bundle = db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.id == book.bundle_id).first() if book.bundle_id else None
    return _book_out(book, bundle)


@router.delete("/shops/{shop_id}/kdp/books/{book_id}")
def delete_kdp_book(shop_id: int, book_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    book = db.query(KdpBook).filter(KdpBook.id == book_id, KdpBook.shop_id == shop.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    db.delete(book)
    db.commit()
    return {"deleted": True}


# Prodora side: one tap "add to my KDP books" (Prodora does not know the shop id).
@router.post("/prodora/digital-bundles/{bundle_id}/kdp/track", status_code=201)
def track_kdp_book(bundle_id: int, db: Session = Depends(get_db), user: User = Depends(get_prodora_user)):
    shop, bundle = _owned_bundle(bundle_id, user, db)
    existing = db.query(KdpBook).filter(KdpBook.shop_id == shop.id, KdpBook.bundle_id == bundle.id).first()
    if existing:
        return _book_out(existing, bundle)
    book = KdpBook(shop_id=shop.id, bundle_id=bundle.id, title=bundle.name[:255])
    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_out(book, bundle)
