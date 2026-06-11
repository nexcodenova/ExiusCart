"""
Email utility — wraps AWS SES.
Set AWS_SES_ENABLED=true + AWS_SES_REGION + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
to actually send. Without those env vars, emails are logged only (safe for dev/sandbox).
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_SES_ENABLED = os.getenv("AWS_SES_ENABLED", "false").lower() == "true"
_SES_REGION = os.getenv("AWS_SES_REGION", "us-east-1")
_FROM_EMAIL = os.getenv("AWS_SES_FROM_EMAIL", "noreply@exiuscart.com")
_FROM_NAME = os.getenv("AWS_SES_FROM_NAME", "ExiusCart")


def _get_ses_client():
    try:
        import boto3
        return boto3.client(
            "ses",
            region_name=_SES_REGION,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
    except ImportError:
        return None


def send_email(to: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
    """Send an email via SES. Returns True if sent, False if skipped (SES disabled)."""
    if not _SES_ENABLED:
        logger.info(f"[EMAIL SKIPPED — SES disabled] To: {to} | Subject: {subject}")
        return False

    client = _get_ses_client()
    if not client:
        logger.warning("boto3 not installed — cannot send email")
        return False

    try:
        body: dict = {"Html": {"Charset": "UTF-8", "Data": html_body}}
        if text_body:
            body["Text"] = {"Charset": "UTF-8", "Data": text_body}

        client.send_email(
            Source=f"{_FROM_NAME} <{_FROM_EMAIL}>",
            Destination={"ToAddresses": [to]},
            Message={
                "Subject": {"Charset": "UTF-8", "Data": subject},
                "Body": body,
            },
        )
        logger.info(f"[EMAIL SENT] To: {to} | Subject: {subject}")
        return True
    except Exception as exc:
        logger.error(f"[EMAIL FAILED] To: {to} | {exc}")
        return False


# ── Invoice HTML template ─────────────────────────────────────────────────────

def build_invoice_html(
    order_number: str,
    order_date: str,
    customer_name: str,
    customer_email: str,
    shop_name: str,
    items: list,           # [{"name": str, "qty": int, "unit_price": float, "total": float}]
    subtotal: float,
    tax_amount: float,
    discount_amount: float,
    total: float,
    currency: str = "AED",
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

    notes_block = f'<p style="margin:16px 0 0;padding:12px 16px;background:#f9f9f9;border-left:3px solid #6B3FD9;border-radius:4px;font-size:13px;color:#666;">Note: {notes}</p>' if notes else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice {order_number}</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6B3FD9,#8b5cf6);padding:32px 32px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">{shop_name}</h1>
            <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:14px;">Tax Invoice / Receipt</p>
          </td>
        </tr>

        <!-- Invoice meta -->
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

        <!-- Items table -->
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

        <!-- Totals -->
        <tr>
          <td style="padding:16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">Subtotal</td>
                <td style="padding:6px 16px;text-align:right;">{fmt(subtotal)}</td>
              </tr>
              {discount_row}
              <tr>
                <td colspan="3" style="padding:6px 16px;text-align:right;color:#888;">VAT (5%)</td>
                <td style="padding:6px 16px;text-align:right;">{fmt(tax_amount)}</td>
              </tr>
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

        <!-- Footer -->
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
