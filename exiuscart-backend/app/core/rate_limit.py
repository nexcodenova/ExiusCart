"""Rate limiting for the public, no-auth storefront API (public.py,
checkout.py, wallet.py, digital_delivery.py, blog.py) — these are the
endpoints any Custom Website/storefront calls directly, unauthenticated,
so they're the ones actually reachable by a script instead of a real
shopper. Internal seller-dashboard endpoints (behind get_current_user)
aren't touched here — an authenticated seller hammering their own
dashboard isn't the threat model this addresses.

In-memory storage, not Redis — same lightweight-first convention already
used elsewhere in this codebase (see digital_delivery.py's own per-token
attempt cache, app/core/currency.py's rate cache): this runs as a single
pm2 process, so a per-process counter is enough, and it resets on deploy
like those do. If this ever runs as multiple processes/instances behind a
load balancer, this needs a shared backend (Redis) instead — a single
process's in-memory counts would undercount attacks split across
instances.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _client_ip(request: Request) -> str:
    """nginx (the only public entry point — see app/main.py's CORS comment
    and the 2026-08-31 finding that port 8000 itself was firewalled off)
    sets X-Real-IP from $remote_addr on every request it proxies — that's
    the real client IP, not something the client can override, since nginx
    overwrites whatever header a client sent before forwarding. Falls back
    to the raw socket address for local/direct testing where nginx isn't
    in front (dev machine, hitting uvicorn directly).

    Deliberately NOT keying on X-Forwarded-For — nginx's
    $proxy_add_x_forwarded_for *appends* to whatever a client already sent,
    so an attacker's own forged prefix survives in that header. X-Real-IP
    has no such append behavior; nginx sets it outright."""
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip)
