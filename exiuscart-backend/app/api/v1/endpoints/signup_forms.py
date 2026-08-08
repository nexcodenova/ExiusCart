"""
Signup Forms — seller-built forms (newsletter signup, inquiry/contact form,
etc.) shown via an embeddable JS widget on the seller's Custom Website /
Shopify theme. Same delivery mechanism as Smart Upsells popups
(app/api/v1/endpoints/popups.py), but with a seller-defined field schema
instead of a fixed shape. Submissions land in the Lead Management CRM
(ShopLead) when they include an email field.
"""

import logging
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.signup_form import SignupForm, SignupFormSubmission, CapturedFormSubmission, SIGNUP_FORM_CHANNELS, SIGNUP_FORM_FIELD_TYPES
from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.channels import _check_storefront_channel

logger = logging.getLogger(__name__)
router = APIRouter()


def _shop_or_404(shop_id: int, user: User, db: Session):
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


# ── Schemas ───────────────────────────────────────────────────────────────────

class SignupFormFieldIn(BaseModel):
    id: str
    label: str
    type: str
    required: bool = False
    options: Optional[List[str]] = None


class SignupFormIn(BaseModel):
    channel_type: str
    name: str
    title: str
    description: Optional[str] = None
    fields: List[SignupFormFieldIn]
    success_message: Optional[str] = None
    discount_code: Optional[str] = None
    delay_seconds: int = 3
    is_active: bool = True


def _validate_fields(fields: List[SignupFormFieldIn]):
    if not fields:
        raise HTTPException(status_code=422, detail="Add at least one field.")
    for f in fields:
        if f.type not in SIGNUP_FORM_FIELD_TYPES:
            raise HTTPException(status_code=422, detail=f"Field type must be one of {sorted(SIGNUP_FORM_FIELD_TYPES)}")
        if f.type == "dropdown" and not f.options:
            raise HTTPException(status_code=422, detail=f"Dropdown field '{f.label}' needs at least one option.")


# ── Seller endpoints ──────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/signup-forms")
def list_signup_forms(
    shop_id: int,
    channel_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    q = db.query(SignupForm).filter(SignupForm.shop_id == shop_id)
    if channel_type:
        q = q.filter(SignupForm.channel_type == channel_type)
    forms = q.order_by(SignupForm.created_at.desc()).all()
    return {"forms": [_serialize(f, db) for f in forms]}


@router.post("/shops/{shop_id}/signup-forms", status_code=201)
def create_signup_form(
    shop_id: int,
    data: SignupFormIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    _check_storefront_channel(shop_id, data.channel_type, db)
    _validate_fields(data.fields)

    form = SignupForm(
        shop_id=shop_id,
        channel_type=data.channel_type,
        name=data.name,
        title=data.title,
        description=data.description,
        fields=[f.model_dump() for f in data.fields],
        success_message=data.success_message,
        discount_code=data.discount_code,
        delay_seconds=data.delay_seconds,
        is_active=data.is_active,
    )
    db.add(form)
    db.commit()
    db.refresh(form)
    return _serialize(form, db)


@router.patch("/shops/{shop_id}/signup-forms/{form_id}")
def update_signup_form(
    shop_id: int,
    form_id: int,
    data: SignupFormIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    _check_storefront_channel(shop_id, data.channel_type, db)
    _validate_fields(data.fields)

    form = db.query(SignupForm).filter(SignupForm.id == form_id, SignupForm.shop_id == shop_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    form.channel_type = data.channel_type
    form.name = data.name
    form.title = data.title
    form.description = data.description
    form.fields = [f.model_dump() for f in data.fields]
    form.success_message = data.success_message
    form.discount_code = data.discount_code
    form.delay_seconds = data.delay_seconds
    form.is_active = data.is_active
    db.commit()
    db.refresh(form)
    return _serialize(form, db)


@router.post("/shops/{shop_id}/signup-forms/{form_id}/toggle")
def toggle_signup_form(
    shop_id: int,
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    form = db.query(SignupForm).filter(SignupForm.id == form_id, SignupForm.shop_id == shop_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    form.is_active = not form.is_active
    db.commit()
    return {"id": form.id, "is_active": form.is_active}


@router.delete("/shops/{shop_id}/signup-forms/{form_id}")
def delete_signup_form(
    shop_id: int,
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    form = db.query(SignupForm).filter(SignupForm.id == form_id, SignupForm.shop_id == shop_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    db.delete(form)
    db.commit()
    return {"deleted": True}


@router.get("/shops/{shop_id}/signup-forms/{form_id}/submissions")
def list_signup_form_submissions(
    shop_id: int,
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    form = db.query(SignupForm).filter(SignupForm.id == form_id, SignupForm.shop_id == shop_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    subs = db.query(SignupFormSubmission).filter(
        SignupFormSubmission.form_id == form_id,
    ).order_by(SignupFormSubmission.created_at.desc()).all()
    return {
        "fields": form.fields,
        "submissions": [
            {"id": s.id, "data": s.data, "lead_id": s.lead_id, "created_at": s.created_at.isoformat() if s.created_at else None}
            for s in subs
        ],
    }


def _serialize(f: SignupForm, db: Session) -> dict:
    count = db.query(SignupFormSubmission).filter(SignupFormSubmission.form_id == f.id).count()
    return {
        "id": f.id,
        "channel_type": f.channel_type,
        "name": f.name,
        "title": f.title,
        "description": f.description,
        "fields": f.fields,
        "success_message": f.success_message,
        "discount_code": f.discount_code,
        "delay_seconds": f.delay_seconds,
        "is_active": f.is_active,
        "impressions": f.impressions,
        "submission_count": count,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


# ── Public endpoints (no auth) — used by the embed widget script ─────────────

@router.get("/public/signup-forms/{shop_id}")
def get_active_signup_forms(shop_id: int, db: Session = Depends(get_db)):
    forms = db.query(SignupForm).filter(
        SignupForm.shop_id == shop_id,
        SignupForm.is_active == True,
    ).all()
    return {"forms": [
        {
            "id": f.id,
            "title": f.title,
            "description": f.description,
            "fields": f.fields,
            "delay_seconds": f.delay_seconds,
        }
        for f in forms
    ]}


@router.post("/public/signup-forms/{form_id}/track")
def track_signup_form_impression(form_id: int, db: Session = Depends(get_db)):
    form = db.query(SignupForm).filter(SignupForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    form.impressions = (form.impressions or 0) + 1
    db.commit()
    return {"ok": True}


class SignupFormSubmitIn(BaseModel):
    answers: Dict[str, str]


@router.post("/public/signup-forms/{form_id}/submit")
def submit_signup_form(form_id: int, data: SignupFormSubmitIn, db: Session = Depends(get_db)):
    form = db.query(SignupForm).filter(SignupForm.id == form_id, SignupForm.is_active == True).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    fields = form.fields or []
    labeled: Dict[str, str] = {}
    name = email = phone = None

    for field in fields:
        value = (data.answers.get(field["id"]) or "").strip()
        if field.get("required") and not value:
            raise HTTPException(status_code=422, detail=f"{field['label']} is required.")
        if value:
            labeled[field["label"]] = value
            if field["type"] == "email" and not email:
                email = value
            elif field["type"] == "phone" and not phone:
                phone = value
            elif field["type"] == "text" and not name:
                name = value

    submission = SignupFormSubmission(form_id=form.id, shop_id=form.shop_id, data=labeled)

    if email:
        from app.api.v1.endpoints.public import _save_lead
        lead = _save_lead(form.shop_id, name or "Form Submission", email, phone, None, "signup_form", db)
        if lead:
            submission.lead_id = lead.id

    db.add(submission)
    db.commit()

    return {
        "status": "ok",
        "success_message": form.success_message,
        "discount_code": form.discount_code,
    }


# ── Capture the seller's OWN existing form (not one built here) ─────────────
#
# The seller tags a form they already built — their own Contact Us page,
# a Shopify theme's native newsletter box, anything — with a
# data-exiuscart-capture attribute. The widget script then mirrors every
# submission of that form here, without changing how the form already
# behaves. We don't control its field names, so classify by the HTML
# `type` attribute first (most reliable), falling back to name/id
# keyword matching — same idea as the existing Google Ads lead webhook's
# column-name matching in public.py's google_ads_lead().

def _classify_captured_fields(raw: List[dict]):
    name = email = phone = None
    labeled: Dict[str, str] = {}
    for f in raw:
        fname = (f.get("name") or "").strip()
        ftype = (f.get("type") or "").strip().lower()
        value = (f.get("value") or "").strip()
        if not value:
            continue
        key = fname or ftype or "field"
        labeled[key] = value
        haystack = (fname + " " + (f.get("id") or "")).lower()
        if not email and (ftype == "email" or "email" in haystack or "mail" in haystack):
            email = value
        elif not phone and (ftype == "tel" or "phone" in haystack or "mobile" in haystack):
            phone = value
        elif not name and ftype in ("text", "") and "name" in haystack:
            name = value
    return name, email, phone, labeled


class CapturedFieldIn(BaseModel):
    name: Optional[str] = None
    id: Optional[str] = None
    type: Optional[str] = None
    value: Optional[str] = None


class CapturedFormIn(BaseModel):
    fields: List[CapturedFieldIn]
    url: Optional[str] = None


@router.post("/public/capture-form/{shop_id}/submit")
def capture_existing_form(shop_id: int, data: CapturedFormIn, db: Session = Depends(get_db)):
    from app.models.shop import Shop
    if not db.query(Shop.id).filter(Shop.id == shop_id).first():
        raise HTTPException(status_code=404, detail="Shop not found")

    name, email, phone, labeled = _classify_captured_fields([f.model_dump() for f in data.fields])
    if not labeled:
        return {"status": "ok"}  # nothing usable submitted — don't store an empty row

    submission = CapturedFormSubmission(shop_id=shop_id, source_url=data.url, data=labeled)

    if email:
        from app.api.v1.endpoints.public import _save_lead
        lead = _save_lead(shop_id, name or "Website Visitor", email, phone, None, "captured_form", db)
        if lead:
            submission.lead_id = lead.id

    db.add(submission)
    db.commit()
    return {"status": "ok"}


@router.get("/shops/{shop_id}/captured-submissions")
def list_captured_submissions(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    rows = db.query(CapturedFormSubmission).filter(
        CapturedFormSubmission.shop_id == shop_id,
    ).order_by(CapturedFormSubmission.created_at.desc()).limit(500).all()
    return {"submissions": [
        {"id": r.id, "source_url": r.source_url, "data": r.data, "lead_id": r.lead_id,
         "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ]}


# ── Embed script — served as static JS, added to the seller's website ────────

@router.get("/widget/signup-form.js")
def signup_form_widget_script():
    js = """
(function(){
  var s = document.currentScript;
  var shopId = s ? s.getAttribute('data-shop-id') : null;
  if (!shopId) return;
  var API = 'https://api.exiuscart.com/api/v1';
  var shown = {};

  function track(id) {
    fetch(API + '/public/signup-forms/' + id + '/track', { method: 'POST' }).catch(function(){});
  }

  function fieldInput(f) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:12px;text-align:left;';
    var label = document.createElement('label');
    label.innerText = f.label + (f.required ? ' *' : '');
    label.style.cssText = 'display:block;font-size:12px;color:#555;margin-bottom:4px;';
    wrap.appendChild(label);

    var el;
    if (f.type === 'textarea') {
      el = document.createElement('textarea');
      el.rows = 3;
    } else if (f.type === 'dropdown') {
      el = document.createElement('select');
      (f.options || []).forEach(function(o){
        var opt = document.createElement('option');
        opt.value = o; opt.innerText = o;
        el.appendChild(opt);
      });
    } else if (f.type === 'checkbox') {
      el = document.createElement('input');
      el.type = 'checkbox';
      wrap.style.cssText += 'display:flex;align-items:center;gap:8px;';
      wrap.innerHTML = '';
      wrap.appendChild(el);
      wrap.appendChild(label);
    } else {
      el = document.createElement('input');
      el.type = f.type === 'email' ? 'email' : (f.type === 'phone' ? 'tel' : 'text');
    }
    if (f.type !== 'checkbox') {
      el.style.cssText = 'width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px;font-family:Arial,sans-serif;';
      wrap.appendChild(el);
    }
    el.setAttribute('data-field-id', f.id);
    if (f.required) el.required = true;
    return { wrap: wrap, el: el };
  }

  function renderForm(f) {
    if (shown[f.id]) return;
    shown[f.id] = true;
    track(f.id);

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:16px;max-width:380px;width:90%;padding:28px;text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:85vh;overflow-y:auto;';

    var close = document.createElement('button');
    close.innerHTML = '&times;';
    close.style.cssText = 'position:absolute;top:12px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#888;';
    close.onclick = function(){ overlay.remove(); };
    box.appendChild(close);

    var h2 = document.createElement('h2');
    h2.innerText = f.title;
    h2.style.cssText = 'margin:0 0 8px;font-size:20px;color:#111;';
    box.appendChild(h2);

    if (f.description) {
      var p = document.createElement('p');
      p.innerText = f.description;
      p.style.cssText = 'margin:0 0 16px;font-size:14px;color:#555;line-height:1.5;';
      box.appendChild(p);
    }

    var form = document.createElement('form');
    var inputs = (f.fields || []).map(fieldInput);
    inputs.forEach(function(i){ form.appendChild(i.wrap); });

    var err = document.createElement('div');
    err.style.cssText = 'color:#c0392b;font-size:12px;margin-bottom:10px;display:none;';
    form.appendChild(err);

    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.innerText = 'Submit';
    btn.style.cssText = 'width:100%;background:#6B3FD9;color:#fff;font-weight:700;font-size:14px;border:none;padding:12px 28px;border-radius:8px;cursor:pointer;';
    form.appendChild(btn);

    form.onsubmit = function(e){
      e.preventDefault();
      var answers = {};
      var missing = false;
      inputs.forEach(function(i){
        var val = i.el.type === 'checkbox' ? (i.el.checked ? 'yes' : '') : i.el.value;
        if (i.el.required && !val) missing = true;
        answers[i.el.getAttribute('data-field-id')] = val;
      });
      if (missing) { err.innerText = 'Please fill in all required fields.'; err.style.display = 'block'; return; }

      btn.disabled = true;
      btn.innerText = 'Submitting...';
      fetch(API + '/public/signup-forms/' + f.id + '/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answers }),
      })
        .then(function(r){ return r.json(); })
        .then(function(res){
          if (res.status !== 'ok') { err.innerText = 'Something went wrong. Try again.'; err.style.display = 'block'; btn.disabled = false; btn.innerText = 'Submit'; return; }
          var html = '<div style="font-size:32px;margin-bottom:8px;">&#10003;</div>';
          html += '<p style="font-size:15px;color:#111;font-weight:600;margin:0 0 8px;">' + (res.success_message || 'Thanks for submitting!') + '</p>';
          if (res.discount_code) html += '<div style="background:#f3f0ff;border:1px dashed #6B3FD9;border-radius:8px;padding:10px;margin-top:10px;font-weight:700;color:#6B3FD9;letter-spacing:1px;">' + res.discount_code + '</div>';
          box.innerHTML = html;
          box.appendChild(close);
        })
        .catch(function(){
          err.innerText = 'Could not submit — check your connection and try again.';
          err.style.display = 'block';
          btn.disabled = false;
          btn.innerText = 'Submit';
        });
    };

    box.appendChild(form);
    overlay.appendChild(box);
    overlay.onclick = function(e){ if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  }

  fetch(API + '/public/signup-forms/' + shopId)
    .then(function(r){ return r.json(); })
    .then(function(data){
      (data.forms || []).forEach(function(f){
        setTimeout(function(){ renderForm(f); }, (f.delay_seconds || 3) * 1000);
      });
    })
    .catch(function(){});

  // ── Capture the seller's OWN existing forms — anything tagged
  // data-exiuscart-capture="true", e.g. a Contact Us page or a theme's
  // native newsletter box. We never call preventDefault() here — the
  // form keeps doing exactly what it already did, we just mirror a copy
  // of the submitted values to ExiusCart alongside it. sendBeacon is used
  // (not fetch) because a lot of these forms full-page-navigate right
  // after submit, which would otherwise cancel an in-flight fetch.
  function captureExistingForms() {
    var forms = document.querySelectorAll('[data-exiuscart-capture]');
    for (var i = 0; i < forms.length; i++) {
      (function(form){
        if (form.getAttribute('data-exiuscart-bound')) return;
        form.setAttribute('data-exiuscart-bound', '1');
        form.addEventListener('submit', function(){
          try {
            var fields = [];
            var els = form.elements;
            for (var j = 0; j < els.length; j++) {
              var el = els[j];
              if (!el.name && !el.id) continue;
              if (el.type === 'submit' || el.type === 'button' || el.type === 'file' || el.type === 'password') continue;
              var value = (el.type === 'checkbox' || el.type === 'radio') ? (el.checked ? (el.value || 'yes') : '') : el.value;
              fields.push({ name: el.name, id: el.id, type: el.type, value: value });
            }
            var payload = JSON.stringify({ fields: fields, url: window.location.href });
            var captureUrl = API + '/public/capture-form/' + shopId + '/submit';
            if (navigator.sendBeacon) {
              navigator.sendBeacon(captureUrl, new Blob([payload], { type: 'application/json' }));
            } else {
              fetch(captureUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function(){});
            }
          } catch (e) {}
        });
      })(forms[i]);
    }
  }
  captureExistingForms();
  // Themes/apps sometimes render their form after this script already ran
  // (SPA-style page updates) — keep checking rather than only running once.
  setInterval(captureExistingForms, 2000);
})();
"""
    return Response(content=js, media_type="application/javascript")
