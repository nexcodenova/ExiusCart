"""
Email utility — sends via AWS SES SMTP on port 2587.
Port 587 is blocked by DigitalOcean; port 2587 is AWS SES's alternate SMTP port that bypasses this.
"""
import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.database import SessionLocal

logger = logging.getLogger(__name__)

_SMTP_HOST     = os.getenv("SMTP_HOST", "email-smtp.ap-southeast-1.amazonaws.com")
_SMTP_PORT     = int(os.getenv("SMTP_PORT", "2587"))  # 2587 = AWS SES alt port, open on DigitalOcean
_SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
_SMTP_ENABLED  = os.getenv("SMTP_ENABLED", "true" if _SMTP_USERNAME else "false").lower() == "true"
_FROM_NOREPLY  = os.getenv("SMTP_FROM_NOREPLY", "noreply@exiuscart.com")
_FROM_BILLING  = os.getenv("SMTP_FROM_BILLING", "billing@exiuscart.com")
_FROM_NAME     = os.getenv("SMTP_FROM_NAME", "ExiusCart")


def send_email(to: str, subject: str, html_body: str, text_body: Optional[str] = None,
               from_email: Optional[str] = None) -> bool:
    """Send an email via SMTP on port 2587. Returns True if sent, False if skipped."""
    if not _SMTP_ENABLED:
        logger.info(f"[EMAIL SKIPPED — SMTP disabled] To: {to} | Subject: {subject}")
        return False

    sender_addr = from_email or _FROM_NOREPLY
    sender = f"{_FROM_NAME} <{sender_addr}>"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = sender
    msg["To"]      = to

    if text_body:
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(_SMTP_USERNAME, _SMTP_PASSWORD)
            server.sendmail(sender_addr, [to], msg.as_string())
        logger.info(f"[EMAIL SENT] To: {to} | Subject: {subject}")
        # Log every sent email — count only grows, never decreases
        try:
            from app.models.email_log import EmailLog
            _db = SessionLocal()
            _db.add(EmailLog(recipient=to))
            _db.commit()
        except Exception:
            pass
        finally:
            try:
                _db.close()
            except Exception:
                pass
        return True
    except Exception as exc:
        logger.error(f"[EMAIL FAILED] To: {to} | {exc}")
        return False


# ── OTP email ─────────────────────────────────────────────────────────────────

def send_otp_email(to: str, full_name: str, otp_code: str) -> bool:
    first = (full_name or "there").split()[0]
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B1121;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1121;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#151F32;border-radius:16px;overflow:hidden;border:1px solid #1e2d47;">
        <tr><td style="background:#0B1121;padding:24px 36px;border-bottom:1px solid #1e2d47;">
          <span style="font-size:22px;font-weight:800;color:#fff;"><span style="color:#6B3FD9;">Exius</span>Cart</span>
        </td></tr>
        <tr><td style="padding:36px;color:#e2e8f0;">
          <h2 style="margin:0 0 8px;font-size:20px;color:#fff;">Verify your email, {first}</h2>
          <p style="margin:0 0 28px;color:#94a3b8;line-height:1.7;">
            Enter the code below to verify your email address and activate your ExiusCart account.
            This code expires in <strong style="color:#fff;">10 minutes</strong>.
          </p>
          <div style="background:#0B1121;border:1px solid #1e2d47;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
            <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#6B3FD9;">{otp_code}</span>
          </div>
          <p style="margin:0;color:#64748b;font-size:13px;">
            If you didn't create an ExiusCart account, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid #1e2d47;text-align:center;">
          <p style="margin:0;font-size:12px;color:#64748b;">
            ExiusCart &nbsp;|&nbsp; <a href="mailto:support@exiuscart.com" style="color:#6B3FD9;text-decoration:none;">support@exiuscart.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    return send_email(
        to=to,
        subject="Your ExiusCart verification code",
        html_body=html,
        text_body=f"Hi {first}, your ExiusCart verification code is: {otp_code}\nThis code expires in 10 minutes.",
    )


# ── Welcome email templates ───────────────────────────────────────────────────

def _welcome_base(content: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B1121;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1121;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#151F32;border-radius:16px;overflow:hidden;border:1px solid #1e2d47;">
        <tr><td style="background:#0B1121;padding:24px 36px;border-bottom:1px solid #1e2d47;">
          <span style="font-size:22px;font-weight:800;color:#fff;"><span style="color:#6B3FD9;">Exius</span>Cart</span>
        </td></tr>
        <tr><td style="padding:32px 36px;color:#e2e8f0;">{content}</td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid #1e2d47;text-align:center;">
          <p style="margin:0;font-size:12px;color:#64748b;">
            ExiusCart &nbsp;|&nbsp; <a href="mailto:support@exiuscart.com" style="color:#6B3FD9;text-decoration:none;">support@exiuscart.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def send_welcome_email(to: str, full_name: str, plan_label: str = "Free Trial",
                       login_url: str = "https://store.exiuscart.com/login") -> bool:
    first = (full_name or "there").split()[0]
    content = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:#fff;">Welcome to ExiusCart, {first}!</h2>
      <p style="margin:0 0 20px;color:#94a3b8;line-height:1.7;">
        Your ExiusCart store is live on the <strong style="color:#fff;">{plan_label}</strong> plan.
        Manage products, orders, customers, and more — all in one place.
      </p>
      <a href="{login_url}" style="display:inline-block;background:#6B3FD9;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:14px;margin-bottom:20px;">
        Open Dashboard →
      </a>
      <p style="margin:0;color:#64748b;font-size:12px;">
        Questions? Reply to this email or visit <a href="https://exiuscart.com" style="color:#6B3FD9;">exiuscart.com</a>
      </p>"""
    return send_email(
        to=to,
        subject="Welcome to ExiusCart — Your store is ready!",
        html_body=_welcome_base(content),
        text_body=f"Welcome {first}! Your ExiusCart store ({plan_label}) is ready. Login at {login_url}",
    )


def send_thedersi_welcome_email(to: str, full_name: str,
                                login_url: str = "https://store.exiuscart.com/login") -> bool:
    first = (full_name or "there").split()[0]
    content = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:#fff;">Welcome to ExiusCart, {first}!</h2>
      <p style="margin:0 0 12px;color:#94a3b8;line-height:1.7;">
        Your ExiusCart store is now active through <strong style="color:#fff;">TheDersi</strong>.
        Orders from TheDersi sync automatically to your ExiusCart dashboard.
      </p>
      <a href="{login_url}" style="display:inline-block;background:#6B3FD9;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:14px;margin-bottom:20px;">
        Open Dashboard →
      </a>
      <p style="margin:0;color:#64748b;font-size:12px;">
        Need help? Email <a href="mailto:support@exiuscart.com" style="color:#6B3FD9;">support@exiuscart.com</a>
      </p>"""
    return send_email(
        to=to,
        subject="Your ExiusCart store is ready!",
        html_body=_welcome_base(content),
        text_body=f"Welcome {first}! Your ExiusCart store (via TheDersi) is active. Login at {login_url}",
    )


def send_dashboard_live_email(to: str, full_name: str, shop_name: str,
                              login_url: str = "https://store.exiuscart.com/login") -> bool:
    first = (full_name or "there").split()[0]
    content = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:#fff;">Your dashboard is live, {first}!</h2>
      <p style="margin:0 0 12px;color:#94a3b8;line-height:1.7;">
        Great news — your ExiusCart account for <strong style="color:#fff;">{shop_name}</strong> has been approved.
        Your <strong style="color:#fff;">14-day free trial</strong> has started. You now have full access to
        manage products, inventory, orders, invoices, and more.
      </p>
      <div style="background:#1a2540;border:1px solid #2a3a5c;border-radius:12px;padding:20px;margin:0 0 20px;">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Your trial period</p>
        <p style="margin:0;font-size:18px;font-weight:700;color:#6B3FD9;">14 days free access</p>
        <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">All features included. No credit card required during trial.</p>
      </div>
      <a href="{login_url}" style="display:inline-block;background:#6B3FD9;color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-weight:700;font-size:15px;margin-bottom:20px;">
        Open Your Dashboard &rarr;
      </a>
      <p style="margin:0;color:#64748b;font-size:12px;">
        Need help getting started? Email <a href="mailto:support@exiuscart.com" style="color:#6B3FD9;">support@exiuscart.com</a>
        or visit <a href="https://exiuscart.com" style="color:#6B3FD9;">exiuscart.com</a>
      </p>"""
    return send_email(
        to=to,
        subject=f"Your ExiusCart dashboard is live — 14-day trial started!",
        html_body=_welcome_base(content),
        text_body=f"Hi {first}! Your ExiusCart account ({shop_name}) has been approved. Your 14-day free trial has started. Login at {login_url}",
    )


def send_new_signup_notification(full_name: str, email: str, shop_name: str, plan: str) -> bool:
    admin_url = "https://admin.exiuscart.com/dashboard/users"
    content = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:#fff;">New signup waiting for approval</h2>
      <div style="background:#1a2540;border:1px solid #2a3a5c;border-radius:12px;padding:20px;margin:0 0 20px;">
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">Name: <strong style="color:#fff;">{full_name}</strong></p>
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">Email: <strong style="color:#fff;">{email}</strong></p>
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">Shop: <strong style="color:#fff;">{shop_name}</strong></p>
        <p style="margin:0;font-size:13px;color:#94a3b8;">Plan: <strong style="color:#6B3FD9;">{plan}</strong></p>
      </div>
      <a href="{admin_url}" style="display:inline-block;background:#6B3FD9;color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-weight:700;font-size:15px;">
        Review &amp; Approve &rarr;
      </a>"""
    return send_email(
        to="support@exiuscart.com",
        subject=f"New signup: {full_name} ({shop_name}) — pending approval",
        html_body=_welcome_base(content),
        text_body=(
            f"New signup waiting for approval.\n\n"
            f"Name: {full_name}\nEmail: {email}\nShop: {shop_name}\nPlan: {plan}\n\n"
            f"Approve at: {admin_url}"
        ),
    )


def send_password_setup_email(to: str, full_name: str, setup_url: str) -> bool:
    first = (full_name or "there").split()[0]
    content = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:#fff;">Set your password, {first}</h2>
      <p style="margin:0 0 20px;color:#94a3b8;line-height:1.7;">
        Click the button below to set your password and access your ExiusCart dashboard.
        This link expires in <strong style="color:#fff;">48 hours</strong>.
      </p>
      <a href="{setup_url}" style="display:inline-block;background:#6B3FD9;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:14px;margin-bottom:20px;">
        Set Password →
      </a>
      <p style="margin:0;color:#64748b;font-size:12px;">
        If you didn't request this, ignore this email.
      </p>"""
    return send_email(
        to=to,
        subject="Set your ExiusCart password",
        html_body=_welcome_base(content),
        text_body=f"Hi {first}, set your ExiusCart password here: {setup_url} (expires in 48 hours)",
    )


# ── Affiliate email templates ─────────────────────────────────────────────────

def send_affiliate_pending_email(to: str, full_name: str) -> bool:
    first = (full_name or "there").split()[0]
    content = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:#fff;">Application received, {first}!</h2>
      <p style="margin:0 0 16px;color:#94a3b8;line-height:1.7;">
        Thank you for applying to the <strong style="color:#fff;">ExiusCart Affiliate Program</strong>.
        We've received your application and our team will review it within <strong style="color:#fff;">24 hours</strong>.
      </p>
      <div style="background:#1a2540;border:1px solid #2a3a5c;border-radius:12px;padding:20px;margin:0 0 20px;">
        <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">What happens next</p>
        <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;line-height:1.6;">✓ &nbsp;We review your application</p>
        <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;line-height:1.6;">✓ &nbsp;You'll receive an approval email with your unique referral code</p>
        <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">✓ &nbsp;Start sharing and earn up to <strong style="color:#6B3FD9;">$75 per referral</strong></p>
      </div>
      <p style="margin:0;color:#64748b;font-size:12px;">
        Questions? Email <a href="mailto:affiliates@exiuscart.com" style="color:#6B3FD9;">affiliates@exiuscart.com</a>
      </p>"""
    return send_email(
        to=to,
        subject="Your ExiusCart affiliate application has been received",
        html_body=_welcome_base(content),
        text_body=f"Hi {first}! We received your ExiusCart affiliate application. We'll review it within 24 hours and send you an approval email with your referral code.",
    )


def send_affiliate_approved_email(to: str, full_name: str, setup_url: str) -> bool:
    first = (full_name or "there").split()[0]
    content = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:#fff;">You're approved, {first}!</h2>
      <p style="margin:0 0 20px;color:#94a3b8;line-height:1.7;">
        Congratulations! Your <strong style="color:#fff;">ExiusCart Affiliate</strong> application has been approved.
        Earn up to <strong style="color:#6B3FD9;">$75 per referral</strong> — start by setting up your password below.
      </p>

      <div style="background:#1a2540;border:1px solid #6B3FD9;border-radius:12px;padding:24px;margin:0 0 24px;text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:#94a3b8;">Click the button to create your password and access your dashboard</p>
        <a href="{setup_url}" style="display:inline-block;background:#6B3FD9;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:16px;margin-top:8px;">
          Set Up My Password &rarr;
        </a>
        <p style="margin:12px 0 0;font-size:12px;color:#64748b;">This link expires in <strong style="color:#fff;">72 hours</strong></p>
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin:0 0 20px;font-size:12px;color:#6B3FD9;word-break:break-all;">{setup_url}</p>

      <p style="margin:0;color:#64748b;font-size:12px;">
        Full terms at <a href="https://exiuscart.com/affiliate/terms" style="color:#6B3FD9;">exiuscart.com/affiliate/terms</a>
        &nbsp;·&nbsp; Questions? <a href="mailto:affiliates@exiuscart.com" style="color:#6B3FD9;">affiliates@exiuscart.com</a>
      </p>"""
    return send_email(
        to=to,
        subject="You're approved — set up your ExiusCart affiliate account",
        html_body=_welcome_base(content),
        text_body=(
            f"Hi {first}! Your ExiusCart affiliate application is approved.\n\n"
            f"Earn up to $75 per referral. Set up your password to get started:\n{setup_url}\n\n"
            f"This link expires in 72 hours. Questions? affiliates@exiuscart.com"
        ),
    )


def send_affiliate_dashboard_ready_email(to: str, full_name: str, referral_code: str) -> bool:
    first = (full_name or "there").split()[0]
    referral_link = f"https://exiuscart.com/register?ref={referral_code}"
    dashboard_url = "https://affiliates.exiuscart.com/login"
    content = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:#fff;">Your dashboard is ready, {first}!</h2>
      <p style="margin:0 0 20px;color:#94a3b8;line-height:1.7;">
        Your password has been set. You can now log in to your affiliate dashboard and start earning
        <strong style="color:#6B3FD9;">$75 per referral</strong>.
      </p>

      <div style="background:#1a2540;border:1px solid #2a3a5c;border-radius:12px;padding:20px;margin:0 0 20px;">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Your Login</p>
        <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;">Email: <strong style="color:#fff;">{to}</strong></p>
        <p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">Password: the one you just set</p>
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Your Referral Link</p>
        <p style="margin:0;font-size:13px;color:#6B3FD9;word-break:break-all;">{referral_link}</p>
      </div>

      <a href="{dashboard_url}" style="display:inline-block;background:#6B3FD9;color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-weight:700;font-size:15px;margin-bottom:20px;">
        Open Affiliate Dashboard &rarr;
      </a>

      <p style="margin:20px 0 0;color:#64748b;font-size:12px;">
        Questions? <a href="mailto:affiliates@exiuscart.com" style="color:#6B3FD9;">affiliates@exiuscart.com</a>
      </p>"""
    return send_email(
        to=to,
        subject="Your ExiusCart affiliate dashboard is ready!",
        html_body=_welcome_base(content),
        text_body=(
            f"Hi {first}! Your affiliate dashboard is ready.\n\n"
            f"Login at {dashboard_url}\n"
            f"Email: {to}\n"
            f"Password: the one you just set\n\n"
            f"Your referral link: {referral_link}"
        ),
    )


# ── New order notification to seller ─────────────────────────────────────────

def send_new_order_email(
    seller_email: str,
    seller_name: str,
    shop_name: str,
    order_number: str,
    source: str,
    customer_name: str,
    customer_phone: Optional[str],
    items: list,          # list of dicts: {name, quantity, unit_price, total_price}
    subtotal: float,
    tax_amount: float,
    total: float,
    currency: str = "AED",
) -> bool:
    source_label = {"pos": "POS (In-store)", "online": "Online Store"}.get(source, source.replace("_", " ").title())
    source_color = {"pos": "#10b981", "online": "#6B3FD9"}.get(source, "#6B3FD9")

    items_rows = "".join(
        f"""<tr>
          <td style="padding:10px 16px;border-bottom:1px solid #1e2d47;color:#e2e8f0;">{i['name']}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #1e2d47;color:#94a3b8;text-align:center;">{i['quantity']}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #1e2d47;color:#e2e8f0;text-align:right;">{currency} {float(i['total_price']):,.2f}</td>
        </tr>"""
        for i in items
    )

    customer_line = customer_name or "Walk-in Customer"
    if customer_phone:
        customer_line += f" &nbsp;·&nbsp; {customer_phone}"

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B1121;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1121;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#151F32;border-radius:16px;overflow:hidden;border:1px solid #1e2d47;">

        <!-- Header -->
        <tr><td style="background:#0B1121;padding:22px 32px;border-bottom:1px solid #1e2d47;">
          <span style="font-size:22px;font-weight:800;color:#fff;"><span style="color:#6B3FD9;">Exius</span>Cart</span>
        </td></tr>

        <!-- Alert banner -->
        <tr><td style="background:#6B3FD9;padding:18px 32px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">New Order Received!</p>
          <p style="margin:4px 0 0;font-size:13px;color:#c4b5fd;">{shop_name}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;">

          <!-- Order meta -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="width:50%;padding-right:8px;">
                <div style="background:#0B1121;border:1px solid #1e2d47;border-radius:10px;padding:14px 16px;">
                  <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Order Number</p>
                  <p style="margin:0;font-size:15px;font-weight:700;color:#fff;">{order_number}</p>
                </div>
              </td>
              <td style="width:50%;padding-left:8px;">
                <div style="background:#0B1121;border:1px solid #1e2d47;border-radius:10px;padding:14px 16px;">
                  <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Channel</p>
                  <p style="margin:0;font-size:15px;font-weight:700;color:{source_color};">{source_label}</p>
                </div>
              </td>
            </tr>
          </table>

          <!-- Customer -->
          <div style="background:#0B1121;border:1px solid #1e2d47;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Customer</p>
            <p style="margin:0;font-size:14px;color:#e2e8f0;">{customer_line}</p>
          </div>

          <!-- Items table -->
          <p style="margin:0 0 10px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Items Ordered</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e2d47;border-radius:10px;overflow:hidden;margin-bottom:20px;">
            <thead>
              <tr style="background:#0B1121;">
                <th style="padding:10px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Product</th>
                <th style="padding:10px 16px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">Qty</th>
                <th style="padding:10px 16px;text-align:right;font-size:12px;color:#64748b;font-weight:600;">Amount</th>
              </tr>
            </thead>
            <tbody>{items_rows}</tbody>
          </table>

          <!-- Totals -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="padding:5px 0;color:#94a3b8;font-size:13px;">Subtotal</td>
              <td style="padding:5px 0;text-align:right;color:#e2e8f0;font-size:13px;">{currency} {float(subtotal):,.2f}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;color:#94a3b8;font-size:13px;">Tax</td>
              <td style="padding:5px 0;text-align:right;color:#e2e8f0;font-size:13px;">{currency} {float(tax_amount):,.2f}</td>
            </tr>
            <tr>
              <td style="padding:10px 0 0;color:#fff;font-size:16px;font-weight:700;border-top:1px solid #1e2d47;">Total</td>
              <td style="padding:10px 0 0;text-align:right;color:#6B3FD9;font-size:16px;font-weight:700;border-top:1px solid #1e2d47;">{currency} {float(total):,.2f}</td>
            </tr>
          </table>

          <!-- CTA -->
          <div style="text-align:center;">
            <a href="https://store.exiuscart.com/dashboard/orders"
               style="display:inline-block;background:#6B3FD9;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">
              View Order in Dashboard
            </a>
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #1e2d47;text-align:center;">
          <p style="margin:0;font-size:12px;color:#475569;">This notification was sent to <strong style="color:#94a3b8;">{seller_email}</strong></p>
          <p style="margin:6px 0 0;font-size:11px;color:#334155;">Powered by <strong style="color:#6B3FD9;">ExiusCart</strong></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    return send_email(
        to=seller_email,
        subject=f"New Order {order_number} — {shop_name}",
        html_body=html,
        text_body=(
            f"New order received!\n\n"
            f"Order: {order_number}\n"
            f"Shop: {shop_name}\n"
            f"Channel: {source_label}\n"
            f"Customer: {customer_line}\n"
            f"Total: {currency} {float(total):,.2f}\n\n"
            f"View at: https://store.exiuscart.com/dashboard/orders"
        ),
        from_email=_FROM_NOREPLY,
    )


# ── Invoice HTML template ─────────────────────────────────────────────────────

def build_invoice_html(
    order_number: str,
    order_date: str,
    customer_name: str,
    customer_email: str,
    shop_name: str,
    items: list,
    subtotal: float,
    tax_amount: float,
    discount_amount: float,
    total: float,
    currency: str = "LKR",
    notes: Optional[str] = None,
    delivery_charge: float = 0,
    free_delivery_label: Optional[str] = None,
    order_already_paid: bool = False,
    gift_wrap_fee: float = 0,
) -> str:
    def fmt(v: float) -> str:
        return f"{currency} {v:,.2f}"

    # When order_already_paid=True: order amount was settled (e.g. bank transfer before dispatch).
    # Customer only owes the delivery charge on arrival.
    if order_already_paid and delivery_charge and delivery_charge > 0:
        grand_total = delivery_charge
        paid_row = f"""
        <tr>
          <td colspan="3" style="padding:6px 16px;text-align:right;color:#10b981;font-weight:600;">✅ Order Amount Paid (Bank Transfer)</td>
          <td style="padding:6px 16px;text-align:right;color:#10b981;font-weight:600;">-{fmt(total)}</td>
        </tr>"""
        delivery_row = f"""
        <tr>
          <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Delivery (Pay on Arrival)</td>
          <td style="padding:6px 16px;text-align:right;font-weight:600;">{fmt(delivery_charge)}</td>
        </tr>"""
        total_due_label = "Pay on Arrival"
    else:
        paid_row = ""
        # Delivery line + grand total. Free-delivery shows a gift note and adds nothing;
        # otherwise a positive charge is added to the amount the customer pays.
        grand_total = total
        if free_delivery_label:
            delivery_row = f"""
        <tr>
          <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Delivery</td>
          <td style="padding:6px 16px;text-align:right;color:#10b981;font-weight:600;">{free_delivery_label}</td>
        </tr>"""
        elif delivery_charge and delivery_charge > 0:
            grand_total = total + delivery_charge
            delivery_row = f"""
        <tr>
          <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Delivery</td>
          <td style="padding:6px 16px;text-align:right;">{fmt(delivery_charge)}</td>
        </tr>"""
        else:
            delivery_row = ""
        total_due_label = "Total Due"

    rows = ""
    for item in items:
        sub_html = "".join(
            f'<span style="display:block;font-size:11px;color:#9ca3af;margin-top:3px;">↳ {s}</span>'
            for s in (item.get("sub_items") or [])
        )
        rows += f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">{item['name']}{sub_html}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;">{item['qty']}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;">{fmt(item['unit_price'])}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">{fmt(item['total'])}</td>
        </tr>"""

    discount_row = f"""
        <tr>
          <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Discount</td>
          <td style="padding:6px 16px;text-align:right;color:#ef4444;">-{fmt(discount_amount)}</td>
        </tr>""" if discount_amount > 0 else ""

    gift_wrap_row = f"""
        <tr>
          <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">🎁 Gift Wrap</td>
          <td style="padding:6px 16px;text-align:right;">{fmt(gift_wrap_fee)}</td>
        </tr>""" if gift_wrap_fee and gift_wrap_fee > 0 else ""

    tax_row = f"""
        <tr>
          <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Tax</td>
          <td style="padding:6px 16px;text-align:right;">{fmt(tax_amount)}</td>
        </tr>""" if tax_amount > 0 else ""

    notes_block = f'<p style="margin:16px 0 0;padding:12px 16px;background:#f9f9f9;border-left:3px solid #6B3FD9;border-radius:4px;font-size:13px;color:#666;">Note: {notes}</p>' if notes else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice {order_number}</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#6B3FD9,#8b5cf6);padding:32px 32px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">{shop_name}</h1>
            <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:14px;">Tax Invoice / Receipt</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Billed to</p>
                  <p style="margin:0;font-weight:600;color:#1a1a1a;font-size:15px;">{customer_name}</p>
                  <p style="margin:2px 0 0;color:#666;font-size:13px;">{customer_email}</p>
                </td>
                <td style="vertical-align:top;text-align:right;">
                  <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Invoice</p>
                  <p style="margin:0;font-weight:700;color:#6B3FD9;font-size:16px;">{order_number}</p>
                  <p style="margin:2px 0 0;color:#666;font-size:13px;">{order_date}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;">
              <thead>
                <tr style="background:#fafafa;">
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
                  <th style="padding:10px 16px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                  <th style="padding:10px 16px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Price</th>
                  <th style="padding:10px 16px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Total</th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Subtotal</td>
                <td style="padding:6px 16px;text-align:right;">{fmt(subtotal)}</td>
              </tr>
              {discount_row}
              {gift_wrap_row}
              {tax_row}
              {paid_row}
              {delivery_row}
              <tr>
                <td colspan="4" style="padding:4px 16px;"><hr style="border:none;border-top:2px solid #f0f0f0;margin:4px 0;"></td>
              </tr>
              <tr>
                <td colspan="3" style="padding:8px 16px;text-align:right;font-weight:700;font-size:16px;color:#1a1a1a;">{total_due_label}</td>
                <td style="padding:8px 16px;text-align:right;font-weight:800;font-size:18px;color:#6B3FD9;">{fmt(grand_total)}</td>
              </tr>
            </table>
            {notes_block}
          </td>
        </tr>

        <tr>
          <td style="background:#fafafa;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#aaa;">Thank you for your purchase! This is a computer-generated invoice.</p>
            <p style="margin:6px 0 0;font-size:11px;color:#ccc;">Powered by <strong style="color:#6B3FD9;">ExiusCart</strong></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_quotation_email(
    to_email: str,
    customer_name: str,
    shop_name: str,
    shop_logo_url: Optional[str],
    quote_number: str,
    items: list,
    subtotal: float,
    discount: float,
    tax: float,
    total: float,
    valid_until: str,
    notes: Optional[str],
    currency: str = "USD",
    client_link: Optional[str] = None,
) -> None:
    def fmt(v: float) -> str:
        return f"{currency} {v:,.2f}"

    logo_block = (
        f'<img src="{shop_logo_url}" alt="{shop_name}" '
        f'style="max-height:56px;max-width:180px;object-fit:contain;margin-bottom:8px;" /><br/>'
        if shop_logo_url else ""
    )

    rows = ""
    for item in items:
        stock = item.get("quantity_available")
        stock_label = f"<br/><span style='font-size:11px;color:#888;'>Stock: {stock}</span>" if stock is not None else ""
        rows += f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
            {item['name']}{stock_label}
            {"<br/><span style='font-size:11px;color:#aaa;'>SKU: " + item['sku'] + "</span>" if item.get('sku') else ""}
          </td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;">{item['qty']}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;">{fmt(item['unit_price'])}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">{fmt(item['total'])}</td>
        </tr>"""

    discount_row = f"""
        <tr>
          <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Discount</td>
          <td style="padding:6px 16px;text-align:right;color:#ef4444;">-{fmt(discount)}</td>
        </tr>""" if discount > 0 else ""

    tax_row = f"""
        <tr>
          <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Tax</td>
          <td style="padding:6px 16px;text-align:right;">{fmt(tax)}</td>
        </tr>""" if tax > 0 else ""

    notes_block = f'<p style="margin:16px 0 0;padding:12px 16px;background:#f9f9f9;border-left:3px solid #6B3FD9;border-radius:4px;font-size:13px;color:#666;">Note: {notes}</p>' if notes else ""

    client_link_block = f"""
        <tr>
          <td style="padding:8px 32px 24px;text-align:center;">
            <a href="{client_link}" style="display:inline-block;background:linear-gradient(135deg,#6B3FD9,#8b5cf6);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
              View &amp; Accept Quotation
            </a>
            <p style="margin:10px 0 0;font-size:11px;color:#aaa;">Or copy this link: <a href="{client_link}" style="color:#6B3FD9;word-break:break-all;">{client_link}</a></p>
          </td>
        </tr>""" if client_link else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Quotation {quote_number}</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#6B3FD9,#8b5cf6);padding:32px 32px 24px;text-align:center;">
            {logo_block}
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">{shop_name}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">Price Quotation</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Prepared for</p>
                  <p style="margin:0;font-weight:600;color:#1a1a1a;font-size:15px;">{customer_name}</p>
                </td>
                <td style="vertical-align:top;text-align:right;">
                  <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Quotation</p>
                  <p style="margin:0;font-weight:700;color:#6B3FD9;font-size:16px;">{quote_number}</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#888;">Valid until: <strong style="color:#1a1a1a;">{valid_until}</strong></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;">
              <thead>
                <tr style="background:#fafafa;">
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Item</th>
                  <th style="padding:10px 16px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Qty</th>
                  <th style="padding:10px 16px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Unit Price</th>
                  <th style="padding:10px 16px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Subtotal</td>
                <td style="padding:6px 16px;text-align:right;">{fmt(subtotal)}</td>
              </tr>
              {discount_row}
              {tax_row}
              <tr>
                <td colspan="4" style="padding:4px 16px;"><hr style="border:none;border-top:2px solid #f0f0f0;margin:4px 0;"></td>
              </tr>
              <tr>
                <td colspan="3" style="padding:8px 16px;text-align:right;font-weight:700;font-size:16px;color:#1a1a1a;">Total</td>
                <td style="padding:8px 16px;text-align:right;font-weight:800;font-size:18px;color:#6B3FD9;">{fmt(total)}</td>
              </tr>
            </table>
            {notes_block}
          </td>
        </tr>

        {client_link_block}

        <tr>
          <td style="background:#fafafa;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:13px;color:#666;">Questions? Reply to this email or contact {shop_name} directly.</p>
            <p style="margin:6px 0 0;font-size:11px;color:#ccc;">Powered by <strong style="color:#6B3FD9;">ExiusCart</strong></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    send_email(to_email, f"Quotation {quote_number} from {shop_name}", html)


# ── Payment Reminder email ─────────────────────────────────────────────────────

def send_payment_reminder_email(
    to_email: str,
    customer_name: str,
    shop_name: str,
    shop_logo_url: Optional[str],
    quote_number: str,
    total: float,
    valid_until: str,
    reminder_count: int,
    currency: str = "USD",
    client_link: Optional[str] = None,
) -> None:
    def fmt(v: float) -> str:
        return f"{currency} {v:,.2f}"

    first = (customer_name or "there").split()[0]
    logo_block = (
        f'<img src="{shop_logo_url}" alt="{shop_name}" '
        f'style="max-height:48px;max-width:160px;object-fit:contain;margin-bottom:8px;" /><br/>'
        if shop_logo_url else ""
    )
    ordinal = {1: "1st", 2: "2nd", 3: "3rd"}.get(reminder_count, f"{reminder_count}th")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Payment Reminder – {quote_number}</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:28px 32px;text-align:center;">
            {logo_block}
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">{shop_name}</h1>
            <p style="color:rgba(255,255,255,0.9);margin:4px 0 0;font-size:14px;font-weight:600;">⏰ Payment Reminder – {ordinal} Notice</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">Hi <strong>{first}</strong>,</p>
            <p style="margin:0 0 20px;color:#555;line-height:1.7;">
              This is a friendly reminder that the quotation <strong style="color:#6B3FD9;">{quote_number}</strong>
              from <strong>{shop_name}</strong> is still awaiting your payment.
            </p>

            <div style="background:#fff8f0;border:2px solid #f59e0b;border-radius:10px;padding:20px 24px;text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Amount Due</p>
              <p style="margin:0;font-size:32px;font-weight:800;color:#ef4444;">{fmt(total)}</p>
              {f'<p style="margin:8px 0 0;font-size:13px;color:#888;">Valid until: <strong style="color:#1a1a1a;">{valid_until}</strong></p>' if valid_until else ""}
            </div>

            <p style="margin:0;color:#555;line-height:1.7;font-size:14px;">
              Please contact us if you have any questions or need to make alternative payment arrangements.
              We appreciate your business and look forward to hearing from you.
            </p>
            {f"""<div style="text-align:center;margin-top:24px;">
              <a href="{client_link}" style="display:inline-block;background:linear-gradient(135deg,#6B3FD9,#8b5cf6);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;">
                View Quotation
              </a>
              <p style="margin:10px 0 0;font-size:11px;color:#aaa;"><a href="{client_link}" style="color:#6B3FD9;word-break:break-all;">{client_link}</a></p>
            </div>""" if client_link else ""}
          </td>
        </tr>

        <tr>
          <td style="background:#fafafa;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:13px;color:#666;">Questions? Contact {shop_name} directly.</p>
            <p style="margin:6px 0 0;font-size:11px;color:#ccc;">Powered by <strong style="color:#6B3FD9;">ExiusCart</strong></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    send_email(
        to_email,
        f"[Reminder {ordinal}] Payment Due – {quote_number} from {shop_name}",
        html,
    )


# ── Low Stock Alert email ──────────────────────────────────────────────────────

def send_low_stock_alert_email(
    to_email: str,
    shop_name: str,
    low_stock_items: list,  # [{"name": str, "sku": str, "quantity": int, "threshold": int}]
) -> None:
    rows = ""
    for item in low_stock_items:
        qty = item.get("quantity", 0)
        threshold = item.get("threshold", 5)
        is_out = qty == 0
        color = "#ef4444" if is_out else "#f59e0b"
        label = "OUT OF STOCK" if is_out else f"{qty} left"
        rows += f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:500;color:#1a1a1a;">
            {item.get('name', '')}
            {"<br/><span style='font-size:11px;color:#aaa;'>SKU: " + item['sku'] + "</span>" if item.get('sku') else ""}
          </td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;color:{color};font-weight:700;">{label}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;color:#888;">Min: {threshold}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Low Stock Alert</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:28px 32px;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">⚠️ Low Stock Alert</h1>
            <p style="color:rgba(255,255,255,0.9);margin:4px 0 0;font-size:14px;">{shop_name} — Action required</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px;">
            <p style="margin:0 0 20px;color:#555;line-height:1.7;">
              The following products in your <strong>{shop_name}</strong> store have fallen below their minimum stock threshold.
              Please restock soon to avoid losing sales.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;">
              <thead>
                <tr style="background:#fafafa;">
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Product</th>
                  <th style="padding:10px 16px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Stock</th>
                  <th style="padding:10px 16px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Threshold</th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#fafafa;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:13px;color:#666;">
              Log in to <strong>ExiusCart</strong> to create a purchase order or adjust stock.
            </p>
            <p style="margin:6px 0 0;font-size:11px;color:#ccc;">Powered by <strong style="color:#6B3FD9;">ExiusCart</strong></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    send_email(
        to_email,
        f"⚠️ Low Stock Alert – {len(low_stock_items)} product{'s' if len(low_stock_items) > 1 else ''} need restocking — {shop_name}",
        html,
    )


# ── Recurring Invoice email ────────────────────────────────────────────────────

def send_recurring_invoice_email(
    to_email: str,
    customer_name: str,
    shop_name: str,
    shop_logo_url: Optional[str],
    invoice_number: str,
    items: list,
    subtotal: float,
    discount: float,
    tax: float,
    total: float,
    notes: Optional[str],
    currency: str = "USD",
) -> None:
    """Reuses quotation email layout but branded as a recurring invoice."""
    def fmt(v: float) -> str:
        return f"{currency} {v:,.2f}"

    logo_block = (
        f'<img src="{shop_logo_url}" alt="{shop_name}" '
        f'style="max-height:48px;max-width:160px;object-fit:contain;margin-bottom:8px;" /><br/>'
        if shop_logo_url else ""
    )

    rows = ""
    for item in items:
        rows += f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">{item.get('name','')}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;">{item.get('qty', item.get('quantity',1))}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;">{fmt(item.get('unit_price',0))}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">{fmt(item.get('total',0))}</td>
        </tr>"""

    discount_row = f"""<tr><td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Discount</td>
        <td style="padding:6px 16px;text-align:right;color:#ef4444;">-{fmt(discount)}</td></tr>""" if discount > 0 else ""
    tax_row = f"""<tr><td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Tax</td>
        <td style="padding:6px 16px;text-align:right;">{fmt(tax)}</td></tr>""" if tax > 0 else ""
    notes_block = f'<p style="margin:16px 0 0;padding:12px 16px;background:#f9f9f9;border-left:3px solid #10b981;border-radius:4px;font-size:13px;color:#666;">Note: {notes}</p>' if notes else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Invoice {invoice_number}</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#10b981,#059669);padding:32px;text-align:center;">
            {logo_block}
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">{shop_name}</h1>
            <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px;">🔁 Recurring Invoice</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%"><tr>
              <td style="vertical-align:top;">
                <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;">Billed to</p>
                <p style="margin:0;font-weight:600;color:#1a1a1a;font-size:15px;">{customer_name}</p>
              </td>
              <td style="vertical-align:top;text-align:right;">
                <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;">Invoice</p>
                <p style="margin:0;font-weight:700;color:#10b981;font-size:16px;">{invoice_number}</p>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;">
            <table width="100%" style="border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;">
              <thead><tr style="background:#fafafa;">
                <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Item</th>
                <th style="padding:10px 16px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Qty</th>
                <th style="padding:10px 16px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Unit Price</th>
                <th style="padding:10px 16px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Total</th>
              </tr></thead>
              <tbody>{rows}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;">
            <table width="100%">
              <tr><td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Subtotal</td><td style="padding:6px 16px;text-align:right;">{fmt(subtotal)}</td></tr>
              {discount_row}{tax_row}
              <tr><td colspan="4" style="padding:4px 16px;"><hr style="border:none;border-top:2px solid #f0f0f0;margin:4px 0;"></td></tr>
              <tr>
                <td colspan="3" style="padding:8px 16px;text-align:right;font-weight:700;font-size:16px;color:#1a1a1a;">Total Due</td>
                <td style="padding:8px 16px;text-align:right;font-weight:800;font-size:18px;color:#10b981;">{fmt(total)}</td>
              </tr>
            </table>
            {notes_block}
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:13px;color:#666;">This is a recurring invoice. Questions? Contact {shop_name} directly.</p>
            <p style="margin:6px 0 0;font-size:11px;color:#ccc;">Powered by <strong style="color:#6B3FD9;">ExiusCart</strong></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    send_email(to_email, f"Invoice {invoice_number} from {shop_name}", html)


# ── TheDersi Order Cancellation — seller notification ─────────────────────────

def send_thedersi_cancellation_email(
    to_email: str,
    shop_name: str,
    order_number: str,
    channel_order_id: str,
    reason: str,
    restored_items: list,
    was_refunded: bool,
) -> bool:
    stock_rows = "".join(
        f"<tr><td style='padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;'>{item}</td></tr>"
        for item in restored_items
    ) if restored_items else "<tr><td style='padding:6px 12px;font-size:13px;color:#6b7280;'>No stock to restore (order was unpaid)</td></tr>"

    refund_notice = """
      <div style='background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;'>
        <p style='margin:0;font-size:13px;color:#92400e;'>
          <strong>Refund:</strong> TheDersi will process the customer refund on their side.
          No action needed from you.
        </p>
      </div>""" if was_refunded else ""

    html = f"""<!DOCTYPE html><html><head><meta charset='UTF-8'></head>
<body style='margin:0;padding:0;background:#f9fafb;font-family:Segoe UI,Arial,sans-serif;'>
  <table width='100%' cellpadding='0' cellspacing='0' style='max-width:580px;margin:32px auto;'>
    <tr><td style='background:#dc2626;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;'>
      <h1 style='margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;'>Order Cancelled by TheDersi</h1>
      <p style='margin:6px 0 0;color:#fecaca;font-size:13px;'>Action taken by TheDersi admin team</p>
    </td></tr>
    <tr><td style='background:#fff;padding:28px 32px;border:1px solid #e5e7eb;'>
      <p style='color:#374151;font-size:14px;margin:0 0 16px;'>Hi <strong>{shop_name}</strong>,</p>
      <p style='color:#374151;font-size:14px;margin:0 0 20px;'>
        TheDersi has cancelled one of your orders. Here are the details:
      </p>

      <div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:20px;'>
        <table width='100%' style='font-size:13px;'>
          <tr>
            <td style='color:#6b7280;padding:4px 0;'>Your Order Number</td>
            <td style='font-weight:700;color:#111;text-align:right;font-family:monospace;'>{order_number}</td>
          </tr>
          <tr>
            <td style='color:#6b7280;padding:4px 0;'>TheDersi Order ID</td>
            <td style='font-weight:700;color:#111;text-align:right;font-family:monospace;'>{channel_order_id}</td>
          </tr>
          <tr>
            <td style='color:#6b7280;padding:4px 0;'>Reason</td>
            <td style='font-weight:600;color:#dc2626;text-align:right;'>{reason}</td>
          </tr>
          <tr>
            <td style='color:#6b7280;padding:4px 0;'>New Status</td>
            <td style='font-weight:700;color:#dc2626;text-align:right;'>Cancelled</td>
          </tr>
        </table>
      </div>

      {refund_notice}

      <p style='font-size:13px;font-weight:700;color:#374151;margin:20px 0 8px;'>Stock Restored in Your Dashboard</p>
      <table width='100%' style='border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse;overflow:hidden;'>
        {stock_rows}
      </table>

      <div style='background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:20px 0 0;'>
        <p style='margin:0;font-size:13px;color:#166534;'>
          ✅ Your ExiusCart inventory has been automatically updated. No manual action required.
        </p>
      </div>
    </td></tr>
    <tr><td style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;'>
      <p style='margin:0;font-size:11px;color:#9ca3af;'>ExiusCart · Powered by ExiusCart</p>
    </td></tr>
  </table>
</body></html>"""

    return send_email(
        to_email,
        f"⚠️ Order {order_number} Cancelled by TheDersi — Stock Restored",
        html,
    )
