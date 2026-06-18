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
) -> str:
    def fmt(v: float) -> str:
        return f"{currency} {v:,.2f}"

    rows = ""
    for item in items:
        rows += f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">{item['name']}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;">{item['qty']}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;">{fmt(item['unit_price'])}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">{fmt(item['total'])}</td>
        </tr>"""

    discount_row = f"""
        <tr>
          <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Discount</td>
          <td style="padding:6px 16px;text-align:right;color:#ef4444;">-{fmt(discount_amount)}</td>
        </tr>""" if discount_amount > 0 else ""

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
              {tax_row}
              <tr>
                <td colspan="4" style="padding:4px 16px;"><hr style="border:none;border-top:2px solid #f0f0f0;margin:4px 0;"></td>
              </tr>
              <tr>
                <td colspan="3" style="padding:8px 16px;text-align:right;font-weight:700;font-size:16px;color:#1a1a1a;">Total Due</td>
                <td style="padding:8px 16px;text-align:right;font-weight:800;font-size:18px;color:#6B3FD9;">{fmt(total)}</td>
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
