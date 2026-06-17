import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, phone, subject, message } = await req.json();

    if (!firstName || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const to = process.env.CONTACT_TO || 'support@exiuscart.com';
    const from = process.env.SMTP_FROM || 'noreply@exiuscart.com';

    await transporter.sendMail({
      from: `ExiusCart Contact <${from}>`,
      to,
      replyTo: email,
      subject: `[Contact] ${subject} — ${fullName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f5f7fa;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background:#0B1121;padding:24px 36px;">
                    <span style="font-size:20px;font-weight:800;color:#fff;"><span style="color:#6B3FD9;">Exius</span>Cart</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 36px;">
                    <h2 style="margin:0 0 4px;color:#0B1121;font-size:18px;">New Contact Form Submission</h2>
                    <p style="margin:0 0 24px;color:#888;font-size:13px;">${new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })} (Dubai time)</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${row('Name', fullName)}
                      ${row('Email', `<a href="mailto:${email}" style="color:#6B3FD9;">${email}</a>`)}
                      ${phone ? row('Phone', phone) : ''}
                      ${row('Subject', subject)}
                    </table>
                    <div style="margin-top:20px;padding:16px;background:#f9f9f9;border-left:3px solid #6B3FD9;border-radius:4px;">
                      <p style="margin:0 0 6px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
                      <p style="margin:0;color:#333;line-height:1.7;white-space:pre-wrap;">${message}</p>
                    </div>
                    <div style="margin-top:24px;">
                      <a href="mailto:${email}" style="display:inline-block;background:#6B3FD9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">
                        Reply to ${firstName} →
                      </a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 36px;border-top:1px solid #f0f0f0;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#aaa;">ExiusCart · <a href="https://exiuscart.com" style="color:#6B3FD9;text-decoration:none;">exiuscart.com</a></p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[CONTACT FORM]', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

function row(label: string, value: string) {
  return `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#888;width:80px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;font-size:14px;color:#0B1121;font-weight:500;">${value}</td>
    </tr>`;
}
