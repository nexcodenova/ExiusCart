#!/usr/bin/env python3
"""
SSL certificate expiry watchdog — runs daily via cron on the production
droplet, completely independent of the app/venv so it still works even if
the app itself is broken.

Why this exists (2026-09-07): both production certs (exiuscart.com and
store.exiuscart.com) silently failed to renew for over a week because
they bundled domains (exiuscart.com, www, app, shop, affiliates) that had
since moved to Vercel and no longer resolve to this droplet — Let's
Encrypt's HTTP-01 challenge for those domains 404'd, aborting the whole
multi-domain renewal, and nobody found out until browsers started
rejecting the site outright. certbot's own renewal log recorded the
failure every single time, but nothing ever surfaced it.

This checks the REAL served certificate for each production hostname —
exactly what a visitor's browser sees — rather than trusting certbot's
own renewal bookkeeping, so it catches this exact failure mode (and any
other reason a cert might be near/past expiry) regardless of cause.
Emails the account owner via the same AWS SES SMTP already used for
transactional email (app/core/email.py) if any cert is within
ALERT_THRESHOLD_DAYS of expiring, or already expired.

Deliberately dependency-free (stdlib only + system `openssl`) so it
never breaks alongside a broken venv/deploy — the one scenario this
script exists to catch.
"""
import os
import re
import smtplib
import subprocess
import sys
from datetime import datetime, timezone
from email.mime.text import MIMEText

ALERT_THRESHOLD_DAYS = 14
ALERT_TO = os.getenv("CERT_ALERT_EMAIL", "mizairyakthar@gmail.com")

# Production hostnames actually served by THIS droplet. Deliberately not
# "every domain in every cert" — that's precisely the bug that caused the
# outage this script exists to prevent. Update this list if/when domains
# move on or off this server.
DOMAINS = [
    "api.exiuscart.com",
    "admin.exiuscart.com",
    "store.exiuscart.com",
    "thedersi.lk",
    "www.thedersi.lk",
]

ENV_FILE = "/var/www/ExiusCart/exiuscart-backend/.env"


def _load_env_var(name: str) -> str:
    """Read a single KEY=value line directly out of .env — no python-dotenv
    dependency, so this script has zero pip requirements."""
    try:
        with open(ENV_FILE) as f:
            for line in f:
                m = re.match(rf'^{re.escape(name)}=(.*)$', line.strip())
                if m:
                    return m.group(1).strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return ""


def get_cert_expiry(hostname: str, port: int = 443, timeout: float = 10) -> datetime | None:
    """Real served-certificate expiry, via a live TLS handshake — the same
    thing a visitor's browser actually checks. Returns None on any
    connection failure (reported separately, not treated as "fine").

    Shells out to `openssl` rather than Python's ssl module: with
    verify_mode=CERT_NONE (deliberate here — we want the expiry even when
    the cert is already invalid/expired, which is exactly the failure case
    this script exists to catch), socket.getpeercert() only ever returns
    an empty dict — it silently skips parsing the certificate whenever
    verification is off. openssl's x509 -enddate has no such limitation.
    """
    try:
        handshake = subprocess.run(
            ["openssl", "s_client", "-servername", hostname, "-connect", f"{hostname}:{port}"],
            input="", capture_output=True, text=True, timeout=timeout,
        )
        result = subprocess.run(
            ["openssl", "x509", "-noout", "-enddate"],
            input=handshake.stdout, capture_output=True, text=True, timeout=timeout,
        )
        # e.g. "notAfter=Dec  6 02:02:58 2026 GMT"
        m = re.search(r"notAfter=(.+)", result.stdout.strip())
        if not m:
            return None
        return datetime.strptime(m.group(1).strip(), "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def send_alert(subject: str, body_lines: list[str]) -> None:
    smtp_host = os.getenv("SMTP_HOST") or _load_env_var("SMTP_HOST") or "email-smtp.ap-southeast-1.amazonaws.com"
    smtp_port = int(os.getenv("SMTP_PORT") or _load_env_var("SMTP_PORT") or "2587")
    smtp_user = os.getenv("SMTP_USERNAME") or _load_env_var("SMTP_USERNAME")
    smtp_pass = os.getenv("SMTP_PASSWORD") or _load_env_var("SMTP_PASSWORD")
    from_addr = _load_env_var("SMTP_FROM_NOREPLY") or "noreply@exiuscart.com"

    body = "\n".join(body_lines)
    print(f"[cert-watchdog] {subject}\n{body}")  # always land in cron's own mail/log too

    if not smtp_user or not smtp_pass:
        print("[cert-watchdog] SMTP not configured — alert NOT emailed, see above output.")
        return

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = f"ExiusCart Ops <{from_addr}>"
    msg["To"] = ALERT_TO

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_addr, [ALERT_TO], msg.as_string())
        print(f"[cert-watchdog] Alert emailed to {ALERT_TO}")
    except Exception as e:
        print(f"[cert-watchdog] FAILED to send alert email: {e}")


def main() -> int:
    now = datetime.now(timezone.utc)
    problems = []

    for domain in DOMAINS:
        expiry = get_cert_expiry(domain)
        if expiry is None:
            problems.append(f"  - {domain}: could NOT check (connection/handshake failed — site may be down)")
            continue
        days_left = (expiry - now).days
        if days_left < 0:
            problems.append(f"  - {domain}: EXPIRED {abs(days_left)} day(s) ago ({expiry.date()})")
        elif days_left <= ALERT_THRESHOLD_DAYS:
            problems.append(f"  - {domain}: expires in {days_left} day(s) ({expiry.date()}) — renewal may be failing")
        else:
            print(f"[cert-watchdog] OK: {domain} valid for {days_left} more day(s)")

    if problems:
        send_alert(
            subject=f"⚠️ ExiusCart SSL alert — {len(problems)} domain(s) need attention",
            body_lines=[
                "One or more production SSL certificates are expired or expiring soon.",
                "This can silently take down checkout/admin/API in real browsers even",
                "while the server itself is fully up (exactly what happened 2026-09-07).",
                "",
                *problems,
                "",
                "Check: ssh exiuscart-prod \"sudo certbot certificates\"",
                "Renew (drop any domain that no longer resolves here from the -d list):",
                "  sudo certbot certonly --nginx -d api.exiuscart.com -d admin.exiuscart.com "
                "-d store.exiuscart.com --cert-name store.exiuscart.com --non-interactive --agree-tos --expand",
                "  sudo systemctl reload nginx",
            ],
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
