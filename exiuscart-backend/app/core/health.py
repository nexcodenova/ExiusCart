"""Live health of everything ExiusCart runs on, for the admin dashboard.

Every check answers with one of four states:
  ok    working
  warn  working but needs attention (slow, certificate close to expiry, half configured)
  down  broken
  off   not set up yet (grey; never counts against the overall status)
"""
import logging
import os
import socket
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional
from urllib.parse import urlparse

import httpx
from sqlalchemy import text

logger = logging.getLogger(__name__)

STARTED_AT = time.time()

# The public sites, probed from the server. Override a URL with HEALTH_SITE_<KEY>.
SITES = [
    ("website", "Marketing website", "https://exiuscart.com"),
    ("store", "Store dashboard", "https://store.exiuscart.com"),
    ("admin", "Admin panel", "https://admin.exiuscart.com"),
    ("prodora", "Prodora", "https://prodora.exiuscart.com"),
    ("affiliates", "Affiliate portal", "https://affiliates.exiuscart.com"),
    ("api_public", "API public address", "https://api.exiuscart.com/health"),
]

SLOW_MS = 3000
CERT_WARN_DAYS = 14
CACHE_SECONDS = 30

_cache: Dict[str, object] = {"at": 0.0, "value": None}
_cache_lock = threading.Lock()


def _check(key: str, name: str, group: str, status: str, detail: str = "", ms: Optional[int] = None, **extra) -> dict:
    return {"key": key, "name": name, "group": group, "status": status, "detail": detail, "ms": ms, **extra}


# ── certificate ──────────────────────────────────────────────────────────────

def _cert_days_left(host: str, port: int = 443) -> Optional[int]:
    """Days until the site's TLS certificate expires; negative once it has. None if unreadable."""
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=6) as raw:
            with ctx.wrap_socket(raw, server_hostname=host) as tls:
                cert = tls.getpeercert()
        expires = datetime.fromtimestamp(ssl.cert_time_to_seconds(cert["notAfter"]), tz=timezone.utc)
        return (expires - datetime.now(timezone.utc)).days
    except ssl.SSLCertVerificationError:
        return -1  # the certificate is invalid or already expired: visitors see a browser warning
    except Exception:
        return None


# ── individual checks ────────────────────────────────────────────────────────

def _check_site(key: str, name: str, default_url: str) -> dict:
    url = os.getenv(f"HEALTH_SITE_{key.upper()}", default_url)
    host = urlparse(url).hostname or ""
    started = time.perf_counter()
    try:
        with httpx.Client(timeout=8, follow_redirects=True, headers={"User-Agent": "ExiusCart-HealthCheck/1.0"}) as client:
            resp = client.get(url)
        ms = int((time.perf_counter() - started) * 1000)
    except httpx.TimeoutException:
        return _check(key, name, "sites", "down", "Did not answer within 8 seconds", url=url)
    except Exception as exc:
        reason = "Certificate problem" if "CERTIFICATE" in str(exc).upper() else "Could not connect"
        return _check(key, name, "sites", "down", reason, url=url)

    days = _cert_days_left(host) if url.startswith("https") else None
    if resp.status_code >= 400:
        return _check(key, name, "sites", "down", f"Answered with error {resp.status_code}", ms, url=url, ssl_days=days)
    if days is not None and days <= 0:
        return _check(key, name, "sites", "down", "Certificate has expired", ms, url=url, ssl_days=days)
    if days is not None and days < CERT_WARN_DAYS:
        return _check(key, name, "sites", "warn", f"Certificate expires in {days} days", ms, url=url, ssl_days=days)
    if ms > SLOW_MS:
        return _check(key, name, "sites", "warn", "Answering slowly", ms, url=url, ssl_days=days)
    return _check(key, name, "sites", "ok", "Online", ms, url=url, ssl_days=days)


def _check_database() -> dict:
    from app.core.database import SessionLocal
    started = time.perf_counter()
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        ms = int((time.perf_counter() - started) * 1000)
    except Exception:
        return _check("database", "Database", "platform", "down", "Query failed")
    finally:
        db.close()
    return _check("database", "Database", "platform", "warn" if ms > 500 else "ok",
                  "Slow to answer" if ms > 500 else "Connected", ms)


def _check_api() -> dict:
    secs = int(time.time() - STARTED_AT)
    if secs < 3600:
        up = f"{secs // 60} min"
    elif secs < 172800:
        up = f"{secs // 3600} h"
    else:
        up = f"{secs // 86400} days"
    return _check("api", "API server", "platform", "ok", f"Running · up {up}")


def _check_jobs() -> dict:
    """The background jobs (trial billing, tracking sync, drip flows...) are threads in this process."""
    try:
        import app.main as main_module
        threads = [(n, t) for n, t in vars(main_module).items() if n.endswith("_thread") and isinstance(t, threading.Thread)]
    except Exception:
        return _check("jobs", "Background jobs", "platform", "warn", "Could not inspect the job threads")
    if not threads:
        return _check("jobs", "Background jobs", "platform", "off", "No jobs found")
    dead = [n.strip("_").replace("_thread", "").replace("_", " ") for n, t in threads if not t.is_alive()]
    if dead:
        return _check("jobs", "Background jobs", "platform", "down", f"Stopped: {', '.join(dead)}")
    return _check("jobs", "Background jobs", "platform", "ok", f"All {len(threads)} running")


def _check_lemonsqueezy() -> dict:
    from app.core import lemonsqueezy as ls
    if not ls.is_configured():
        return _check("lemonsqueezy", "Card payments (Lemon Squeezy)", "integrations", "off", "Not configured")
    missing = [k for k, v in ls.VARIANT_MAP.items() if not v]
    started = time.perf_counter()
    try:
        r = httpx.get(
            f"https://api.lemonsqueezy.com/v1/stores/{ls.LEMONSQUEEZY_STORE_ID}",
            headers={"Authorization": f"Bearer {ls.LEMONSQUEEZY_API_KEY}", "Accept": "application/vnd.api+json"},
            timeout=8,
        )
    except Exception:
        return _check("lemonsqueezy", "Card payments (Lemon Squeezy)", "integrations", "down", "Could not reach Lemon Squeezy")
    ms = int((time.perf_counter() - started) * 1000)
    if r.status_code in (401, 403):
        return _check("lemonsqueezy", "Card payments (Lemon Squeezy)", "integrations", "down", "API key was rejected", ms)
    if r.status_code >= 400:
        return _check("lemonsqueezy", "Card payments (Lemon Squeezy)", "integrations", "down", f"Answered with error {r.status_code}", ms)
    if not ls.LEMONSQUEEZY_WEBHOOK_SECRET:
        return _check("lemonsqueezy", "Card payments (Lemon Squeezy)", "integrations", "warn", "Webhook secret is not set: payments will not be recorded", ms)
    if missing:
        return _check("lemonsqueezy", "Card payments (Lemon Squeezy)", "integrations", "warn", f"{len(missing)} plan variant(s) not set", ms)
    return _check("lemonsqueezy", "Card payments (Lemon Squeezy)", "integrations", "ok", "Connected · webhook and plans set", ms)


def _check_email() -> dict:
    host = os.getenv("SMTP_HOST", "email-smtp.ap-southeast-1.amazonaws.com")
    port = int(os.getenv("SMTP_PORT", "2587"))
    if not (os.getenv("SMTP_USERNAME") and os.getenv("SMTP_PASSWORD")):
        return _check("email", "Email (SMTP)", "integrations", "off", "Not configured")
    if os.getenv("SMTP_ENABLED", "true").lower() in ("0", "false", "no"):
        return _check("email", "Email (SMTP)", "integrations", "off", "Switched off")
    started = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=6):
            pass
    except Exception:
        return _check("email", "Email (SMTP)", "integrations", "down", "Mail server unreachable")
    return _check("email", "Email (SMTP)", "integrations", "ok", "Mail server reachable", int((time.perf_counter() - started) * 1000))


def _check_suppliers() -> List[dict]:
    from app.core.database import SessionLocal
    from app.models.dropship import DropshipConnection
    out = []
    db = SessionLocal()
    try:
        for stype, label in (("cj", "CJ Dropshipping"), ("aliexpress", "AliExpress")):
            conn = db.query(DropshipConnection).filter(
                DropshipConnection.shop_id.is_(None), DropshipConnection.supplier_type == stype,
                DropshipConnection.is_active == True,
            ).first()
            if conn:
                out.append(_check(stype, label, "integrations", "ok", "Connected for the Prodora catalogue"))
            else:
                out.append(_check(stype, label, "integrations", "off", "Not connected"))
    except Exception:
        out = [_check(k, n, "integrations", "warn", "Could not read the connection") for k, n in (("cj", "CJ Dropshipping"), ("aliexpress", "AliExpress"))]
    finally:
        db.close()
    return out


def _configured(key: str, name: str, ok_detail: str, off_detail: str, *env_names: str) -> dict:
    ok = all(os.getenv(n) for n in env_names)
    return _check(key, name, "integrations", "ok" if ok else "off", ok_detail if ok else off_detail)


def _check_prodora_whop() -> dict:
    if os.getenv("PRODORA_WHOP_WEBHOOK_SECRET"):
        return _check("whop", "Prodora digital sales (Whop)", "integrations", "ok", "Webhook secret set")
    return _check("whop", "Prodora digital sales (Whop)", "integrations", "warn", "Webhook secret missing: digital purchases are rejected")


# ── run everything ───────────────────────────────────────────────────────────

def _safe(fn: Callable[[], object], key: str, name: str, group: str):
    try:
        return fn()
    except Exception as exc:  # a broken check must never break the whole panel
        logger.warning("[health] %s failed: %s", key, exc)
        return _check(key, name, group, "warn", "The check itself failed")


def run_checks() -> dict:
    jobs: List[Callable[[], object]] = [_check_api, _check_database, _check_jobs]
    labels = [("api", "API server", "platform"), ("database", "Database", "platform"), ("jobs", "Background jobs", "platform")]
    for key, name, url in SITES:
        jobs.append(lambda k=key, n=name, u=url: _check_site(k, n, u))
        labels.append((key, name, "sites"))
    jobs += [_check_lemonsqueezy, _check_email, _check_suppliers, _check_prodora_whop,
             lambda: _configured("storage", "File storage (R2)", "Configured", "Not configured",
                                 "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"),
             lambda: _configured("meta_ads", "Meta Ad Library", "Token set", "Token not set", "META_AD_LIBRARY_TOKEN")]
    labels += [("lemonsqueezy", "Card payments (Lemon Squeezy)", "integrations"), ("email", "Email (SMTP)", "integrations"),
               ("suppliers", "Suppliers", "integrations"), ("whop", "Prodora digital sales (Whop)", "integrations"),
               ("storage", "File storage (R2)", "integrations"), ("meta_ads", "Meta Ad Library", "integrations")]

    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(_safe, fn, k, n, g) for fn, (k, n, g) in zip(jobs, labels)]
        results = [f.result() for f in futures]
    checks: List[dict] = []
    for r in results:
        checks.extend(r if isinstance(r, list) else [r])

    critical = [c for c in checks if c["group"] in ("platform", "sites")]
    if any(c["status"] == "down" for c in critical):
        overall = "down"
    elif any(c["status"] in ("warn", "down") for c in checks):
        overall = "degraded"
    else:
        overall = "healthy"
    return {
        "overall": overall,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "counts": {s: sum(1 for c in checks if c["status"] == s) for s in ("ok", "warn", "down", "off")},
        "checks": checks,
    }


def get_health(refresh: bool = False) -> dict:
    """Cached for a few seconds so many open dashboards cannot hammer the sites."""
    with _cache_lock:
        fresh = _cache["value"] is not None and time.time() - float(_cache["at"]) < CACHE_SECONDS
        if fresh and not refresh:
            return _cache["value"]  # type: ignore[return-value]
        value = run_checks()
        _cache["value"], _cache["at"] = value, time.time()
        return value
