"""
Smart Upsells — storefront popups (exit-intent, announcement, email capture, countdown)
shown via an embeddable JS widget on the seller's Custom Website / Shopify theme.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.popup import StorefrontPopup
from app.api.v1.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_TYPES = {"exit_intent", "announcement", "email_capture", "countdown"}


def _shop_or_404(shop_id: int, user: User, db: Session):
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


# ── Schemas ───────────────────────────────────────────────────────────────────

class PopupIn(BaseModel):
    name: str
    popup_type: str
    title: str
    message: Optional[str] = None
    button_text: Optional[str] = None
    button_link: Optional[str] = None
    discount_code: Optional[str] = None
    image_url: Optional[str] = None
    delay_seconds: int = 3
    is_active: bool = True


# ── Seller endpoints ──────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/popups")
def list_popups(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    popups = db.query(StorefrontPopup).filter(StorefrontPopup.shop_id == shop_id).order_by(StorefrontPopup.created_at.desc()).all()
    return {"popups": [_serialize(p) for p in popups]}


@router.post("/shops/{shop_id}/popups")
def create_popup(
    shop_id: int,
    data: PopupIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    if data.popup_type not in VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"popup_type must be one of {sorted(VALID_TYPES)}")

    popup = StorefrontPopup(shop_id=shop_id, **data.model_dump())
    db.add(popup)
    db.commit()
    db.refresh(popup)
    return _serialize(popup)


@router.patch("/shops/{shop_id}/popups/{popup_id}")
def update_popup(
    shop_id: int,
    popup_id: int,
    data: PopupIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    if data.popup_type not in VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"popup_type must be one of {sorted(VALID_TYPES)}")

    popup = db.query(StorefrontPopup).filter(StorefrontPopup.id == popup_id, StorefrontPopup.shop_id == shop_id).first()
    if not popup:
        raise HTTPException(status_code=404, detail="Popup not found")

    for k, v in data.model_dump().items():
        setattr(popup, k, v)
    db.commit()
    db.refresh(popup)
    return _serialize(popup)


@router.post("/shops/{shop_id}/popups/{popup_id}/toggle")
def toggle_popup(
    shop_id: int,
    popup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    popup = db.query(StorefrontPopup).filter(StorefrontPopup.id == popup_id, StorefrontPopup.shop_id == shop_id).first()
    if not popup:
        raise HTTPException(status_code=404, detail="Popup not found")
    popup.is_active = not popup.is_active
    db.commit()
    return {"id": popup.id, "is_active": popup.is_active}


@router.delete("/shops/{shop_id}/popups/{popup_id}")
def delete_popup(
    shop_id: int,
    popup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    popup = db.query(StorefrontPopup).filter(StorefrontPopup.id == popup_id, StorefrontPopup.shop_id == shop_id).first()
    if not popup:
        raise HTTPException(status_code=404, detail="Popup not found")
    db.delete(popup)
    db.commit()
    return {"deleted": True}


def _serialize(p: StorefrontPopup) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "popup_type": p.popup_type,
        "title": p.title,
        "message": p.message,
        "button_text": p.button_text,
        "button_link": p.button_link,
        "discount_code": p.discount_code,
        "image_url": p.image_url,
        "delay_seconds": p.delay_seconds,
        "is_active": p.is_active,
        "impressions": p.impressions,
        "clicks": p.clicks,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# ── Public endpoints (no auth) — used by the embed widget script ─────────────

@router.get("/public/popups/{shop_id}")
def get_active_popups(shop_id: int, db: Session = Depends(get_db)):
    popups = db.query(StorefrontPopup).filter(
        StorefrontPopup.shop_id == shop_id,
        StorefrontPopup.is_active == True,
    ).all()
    return {"popups": [
        {
            "id": p.id,
            "popup_type": p.popup_type,
            "title": p.title,
            "message": p.message,
            "button_text": p.button_text,
            "button_link": p.button_link,
            "discount_code": p.discount_code,
            "image_url": p.image_url,
            "delay_seconds": p.delay_seconds,
        }
        for p in popups
    ]}


@router.post("/public/popups/{popup_id}/track")
def track_popup_event(popup_id: int, event: str, db: Session = Depends(get_db)):
    popup = db.query(StorefrontPopup).filter(StorefrontPopup.id == popup_id).first()
    if not popup:
        raise HTTPException(status_code=404, detail="Popup not found")
    if event == "impression":
        popup.impressions = (popup.impressions or 0) + 1
    elif event == "click":
        popup.clicks = (popup.clicks or 0) + 1
    db.commit()
    return {"ok": True}


# ── Embed script — served as static JS, added to the seller's website ────────

@router.get("/widget/popup.js")
def popup_widget_script():
    js = """
(function(){
  var s = document.currentScript;
  var shopId = s ? s.getAttribute('data-shop-id') : null;
  if (!shopId) return;
  var API = 'https://api.exiuscart.com/api/v1';
  var shown = {};

  function track(id, event) {
    fetch(API + '/public/popups/' + id + '/track?event=' + event, { method: 'POST' }).catch(function(){});
  }

  function renderPopup(p) {
    if (shown[p.id]) return;
    shown[p.id] = true;
    track(p.id, 'impression');

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:16px;max-width:380px;width:90%;padding:28px;text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.3);';

    var close = document.createElement('button');
    close.innerHTML = '&times;';
    close.style.cssText = 'position:absolute;top:12px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#888;';
    close.onclick = function(){ overlay.remove(); };

    var html = '';
    if (p.image_url) html += '<img src="' + p.image_url + '" style="width:100%;max-height:160px;object-fit:cover;border-radius:10px;margin-bottom:16px;" />';
    html += '<h2 style="margin:0 0 8px;font-size:20px;color:#111;">' + p.title + '</h2>';
    if (p.message) html += '<p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.5;">' + p.message + '</p>';
    if (p.discount_code) html += '<div style="background:#f3f0ff;border:1px dashed #6B3FD9;border-radius:8px;padding:10px;margin-bottom:16px;font-weight:700;color:#6B3FD9;letter-spacing:1px;">' + p.discount_code + '</div>';

    box.innerHTML = html;
    box.appendChild(close);

    if (p.button_text) {
      var btn = document.createElement('a');
      btn.innerText = p.button_text;
      btn.href = p.button_link || '#';
      btn.style.cssText = 'display:inline-block;background:#6B3FD9;color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px;';
      btn.onclick = function(){ track(p.id, 'click'); };
      box.appendChild(btn);
    }

    overlay.appendChild(box);
    overlay.onclick = function(e){ if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  }

  fetch(API + '/public/popups/' + shopId)
    .then(function(r){ return r.json(); })
    .then(function(data){
      (data.popups || []).forEach(function(p){
        if (p.popup_type === 'exit_intent') {
          document.addEventListener('mouseleave', function(e){
            if (e.clientY < 10) renderPopup(p);
          });
        } else {
          setTimeout(function(){ renderPopup(p); }, (p.delay_seconds || 3) * 1000);
        }
      });
    })
    .catch(function(){});
})();
"""
    return Response(content=js, media_type="application/javascript")
