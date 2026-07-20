// Builds one well-tested, table-based responsive email (inline styles only —
// email clients don't support stylesheets) from a seller's own content,
// instead of picking from a small set of fixed hardcoded designs. Kept
// deliberately simple: fancy fonts/layouts don't render reliably across
// Gmail/Outlook/Apple Mail, so customization is limited to what's actually
// safe in an email.

export const EMAIL_FONTS: { key: string; label: string; stack: string }[] = [
  { key: 'modern', label: 'Modern Sans', stack: "'Segoe UI', Arial, Helvetica, sans-serif" },
  { key: 'classic', label: 'Classic Serif', stack: "Georgia, 'Times New Roman', serif" },
  { key: 'clean', label: 'Clean Sans', stack: 'Verdana, Geneva, sans-serif' },
  { key: 'elegant', label: 'Elegant', stack: "'Trebuchet MS', sans-serif" },
];

export function fontStackFor(key: string): string {
  return EMAIL_FONTS.find((f) => f.key === key)?.stack ?? EMAIL_FONTS[0].stack;
}

export const BUTTON_SHAPES: { key: string; label: string; radius: string }[] = [
  { key: 'rounded', label: 'Rounded', radius: '10px' },
  { key: 'pill', label: 'Pill', radius: '999px' },
  { key: 'square', label: 'Square', radius: '0px' },
];

export function radiusFor(key: string): string {
  return BUTTON_SHAPES.find((s) => s.key === key)?.radius ?? BUTTON_SHAPES[0].radius;
}

export interface EmailBuilderFields {
  heading: string;
  subtitle: string;
  bodyMessage: string;
  heroImageUrl: string;
  buttonText: string;
  buttonLink: string;
  buttonColor: string;
  buttonShape: string;
  fontKey: string;
}

export const EMPTY_EMAIL_FIELDS: EmailBuilderFields = {
  heading: '',
  subtitle: '',
  bodyMessage: '',
  heroImageUrl: '',
  buttonText: 'Shop Now',
  buttonLink: '',
  buttonColor: '#6B3FD9',
  buttonShape: 'rounded',
  fontKey: 'modern',
};

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildEmailHtml(f: EmailBuilderFields): string {
  const font = fontStackFor(f.fontKey);
  const radius = radiusFor(f.buttonShape);
  const color = f.buttonColor || '#6B3FD9';
  const hero = f.heroImageUrl
    ? `<tr><td style="padding:0;"><img src="${f.heroImageUrl}" alt="" style="width:100%;max-height:340px;object-fit:cover;display:block;" /></td></tr>`
    : '';
  const messageEmpty = !f.bodyMessage || f.bodyMessage === '<br>' || f.bodyMessage === '<div><br></div>';
  // bodyMessage comes from the rich text editor — already real HTML
  // (bold/italic/lists), not plain text, so it's inserted as-is rather
  // than escaped like the other, plain-input fields below.
  const body = !messageEmpty
    ? `<div style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 28px;">${f.bodyMessage}</div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:${font};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<tr><td style="background:${color};border-radius:16px 16px 0 0;padding:48px 48px 40px;text-align:center;">
  <h1 style="color:#ffffff;font-size:36px;font-weight:800;margin:0 0 12px;line-height:1.2;">${esc(f.heading) || 'Your Headline Here'}</h1>
  ${f.subtitle ? `<p style="color:rgba(255,255,255,0.85);font-size:16px;margin:0;">${esc(f.subtitle)}</p>` : ''}
</td></tr>

${hero}

<tr><td style="background:#ffffff;padding:40px 48px;">
  ${body}
  <div style="text-align:center;">
    <a href="${f.buttonLink || '#'}" style="display:inline-block;background:${color};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:${radius};">${esc(f.buttonText) || 'Shop Now'}</a>
  </div>
</td></tr>

<tr><td style="background:#f9fafb;border-radius:0 0 16px 16px;padding:24px 48px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because you're a valued customer.</p>
  <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">To unsubscribe, reply to this email.</p>
</td></tr>

</table></td></tr></table></body></html>`;
}
