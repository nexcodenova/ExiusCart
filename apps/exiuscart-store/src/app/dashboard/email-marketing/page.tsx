'use client';
import { useState, useEffect } from 'react';
import { Plus, Mail, Send, Trash2, Edit2, Eye, X, Loader2, LayoutTemplate, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { marketingApi, usageApi } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-green-500/10 text-green-600 dark:text-green-400',
  scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  cancelled: 'bg-red-500/10 text-red-500',
};

const EMPTY = { name: '', subject: '', body_html: '', ctaLink: 'https://thedersi.lk/new-arrivals', heroImage: '' };

interface Template { id: string; label: string; desc: string; subject: string; body: string; headerBg: string; }

const EMAIL_TEMPLATES: Template[] = [
  {
    id: 'dark-promo',
    label: 'Dark Promo',
    desc: 'Bold dark hero with discount code',
    headerBg: 'linear-gradient(135deg,#111827,#1f2937)',
    subject: '🎉 Exclusive Offer Just for You!',
    body: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<tr><td style="background:#111827;border-radius:16px 16px 0 0;padding:52px 48px 44px;text-align:center;">
  <p style="color:#9ca3af;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 16px;">Exclusive Offer</p>
  <h1 style="color:#ffffff;font-size:40px;font-weight:900;margin:0 0 12px;line-height:1.15;">Big Savings<br/>Are Here 🎁</h1>
  <p style="color:#6b7280;font-size:16px;margin:0;line-height:1.6;">A limited-time deal for our valued customers.</p>
</td></tr>

__HERO__

<tr><td style="background:#1f2937;padding:32px 48px;">
  <div style="border:2px dashed #374151;border-radius:12px;padding:28px;text-align:center;">
    <p style="color:#9ca3af;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 10px;">Your Promo Code</p>
    <h2 style="color:#f9fafb;font-size:38px;font-weight:900;letter-spacing:8px;margin:0 0 10px;font-family:monospace;">SAVE20</h2>
    <p style="color:#6b7280;font-size:14px;margin:0;">20% off your entire order · Limited time</p>
  </div>
</td></tr>

<tr><td style="background:#ffffff;padding:40px 48px;">
  <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 20px;">Hi there,</p>
  <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 28px;">We appreciate your loyalty and want to reward you with an exclusive deal. Use the code above at checkout to enjoy <strong>20% off</strong> your next purchase. This offer won't last long!</p>
  <div style="text-align:center;margin:0 0 28px;">
    <a href="__CTA__" style="display:inline-block;background:#111827;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:10px;">Shop the Sale →</a>
  </div>
  <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">Offer valid for a limited time. Cannot be combined with other offers.</p>
</td></tr>

<tr><td style="background:#f9fafb;border-radius:0 0 16px 16px;padding:24px 48px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because you're a valued customer.</p>
  <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">To unsubscribe, reply to this email.</p>
</td></tr>

</table></td></tr></table></body></html>`,
  },
  {
    id: 'flash-sale',
    label: 'Flash Sale',
    desc: 'Red urgent sale, ends tonight',
    headerBg: 'linear-gradient(135deg,#dc2626,#b91c1c)',
    subject: '⚡ Flash Sale — Ends Tonight!',
    body: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff1f1;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff1f1;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<tr><td style="background:linear-gradient(135deg,#dc2626,#b91c1c);border-radius:16px 16px 0 0;padding:44px 48px;text-align:center;">
  <p style="color:#fca5a5;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;">⚡ Limited Time Only</p>
  <h1 style="color:#ffffff;font-size:52px;font-weight:900;margin:0 0 8px;line-height:1.1;">FLASH SALE</h1>
  <h2 style="color:#fef2f2;font-size:28px;font-weight:700;margin:0 0 20px;">Up to 50% OFF</h2>
  <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:8px;padding:10px 24px;">
    <p style="color:#fff;font-size:14px;font-weight:600;margin:0;">⏰ Ends Tonight at Midnight</p>
  </div>
</td></tr>

__HERO__

<tr><td style="background:#ffffff;padding:40px 48px;">
  <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 20px;">Hi there,</p>
  <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 24px;">Our <strong style="color:#dc2626;">biggest flash sale</strong> is live right now! For a few hours only, we're slashing prices on selected products. This is your chance to grab what you've been eyeing at an unbeatable price.</p>
  <div style="background:#fff7f7;border:1px solid #fee2e2;border-left:4px solid #dc2626;border-radius:4px 8px 8px 4px;padding:16px 20px;margin:0 0 28px;">
    <p style="color:#b91c1c;font-size:15px;font-weight:700;margin:0 0 4px;">⚡ Stock is limited — once it's gone, it's gone!</p>
    <p style="color:#ef4444;font-size:14px;margin:0;">Don't wait — these prices won't last past midnight.</p>
  </div>
  <div style="text-align:center;margin:0 0 28px;">
    <a href="__CTA__" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#ffffff;font-size:17px;font-weight:800;text-decoration:none;padding:18px 52px;border-radius:10px;">Grab the Deal Now →</a>
  </div>
  <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">Sale applies to selected items only. While stocks last.</p>
</td></tr>

<tr><td style="background:#f9fafb;border-radius:0 0 16px 16px;padding:24px 48px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because you're a valued customer.</p>
  <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">To unsubscribe, reply to this email.</p>
</td></tr>

</table></td></tr></table></body></html>`,
  },
  {
    id: 'new-arrivals',
    label: 'New Arrivals',
    desc: 'Purple gradient, new collection',
    headerBg: 'linear-gradient(135deg,#6B3FD9,#8b5cf6)',
    subject: '✨ New Products Just Arrived!',
    body: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f7ff;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7ff;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<tr><td style="background:linear-gradient(135deg,#6B3FD9,#8b5cf6);border-radius:16px 16px 0 0;padding:48px 48px 40px;text-align:center;">
  <p style="color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 14px;">Just Landed</p>
  <h1 style="color:#ffffff;font-size:40px;font-weight:900;margin:0 0 12px;line-height:1.2;">New Arrivals ✨</h1>
  <p style="color:rgba(255,255,255,0.8);font-size:17px;margin:0;">Fresh styles, just in. Be the first to shop.</p>
</td></tr>

__HERO__

<tr><td style="background:#ffffff;padding:40px 48px;">
  <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 20px;">Hi there,</p>
  <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 24px;">We're excited to announce that our latest collection has just arrived! Fresh designs, premium quality, and styles you'll love. Be the first to get your hands on these before they sell out.</p>
  <div style="background:#faf8ff;border-radius:12px;padding:24px;margin:0 0 28px;border:1px solid #ede9fe;">
    <p style="color:#6B3FD9;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">🆕 New this season</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="width:50%;padding:0 12px 0 0;vertical-align:top;">
        <p style="color:#374151;font-size:14px;line-height:1.7;margin:0;">✓ &nbsp;Fresh seasonal styles</p>
        <p style="color:#374151;font-size:14px;line-height:1.7;margin:4px 0 0;">✓ &nbsp;Limited edition pieces</p>
      </td>
      <td style="width:50%;padding:0 0 0 12px;vertical-align:top;">
        <p style="color:#374151;font-size:14px;line-height:1.7;margin:0;">✓ &nbsp;Premium quality</p>
        <p style="color:#374151;font-size:14px;line-height:1.7;margin:4px 0 0;">✓ &nbsp;Introductory prices</p>
      </td>
    </tr></table>
  </div>
  <div style="text-align:center;margin:0 0 28px;">
    <a href="__CTA__" style="display:inline-block;background:linear-gradient(135deg,#6B3FD9,#8b5cf6);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:10px;">Shop New Arrivals →</a>
  </div>
  <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">New stock is limited. Shop early to avoid missing out!</p>
</td></tr>

<tr><td style="background:#f9fafb;border-radius:0 0 16px 16px;padding:24px 48px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because you're a valued customer.</p>
  <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">To unsubscribe, reply to this email.</p>
</td></tr>

</table></td></tr></table></body></html>`,
  },
  {
    id: 'thank-you',
    label: 'Thank You',
    desc: 'Warm loyalty reward with gift code',
    headerBg: 'linear-gradient(135deg,#d97706,#f59e0b)',
    subject: '💛 Thank You for Your Support!',
    body: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fffbeb;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<tr><td style="background:linear-gradient(135deg,#d97706,#f59e0b);border-radius:16px 16px 0 0;padding:48px 48px 40px;text-align:center;">
  <h1 style="color:#ffffff;font-size:44px;font-weight:900;margin:0 0 10px;">Thank You! 💛</h1>
  <p style="color:rgba(255,255,255,0.9);font-size:17px;margin:0;">We appreciate your continued support.</p>
</td></tr>

__HERO__

<tr><td style="background:#ffffff;padding:40px 48px;">
  <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 20px;">Hi there,</p>
  <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 24px;">Your support means the world to us. Customers like you are exactly why we do what we do — and we want to show our appreciation with a little something special.</p>
  <div style="background:#fffbeb;border:2px solid #fbbf24;border-radius:12px;padding:28px;text-align:center;margin:0 0 28px;">
    <p style="color:#92400e;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600;margin:0 0 10px;">A gift just for you</p>
    <h2 style="color:#78350f;font-size:36px;font-weight:900;letter-spacing:6px;margin:0 0 10px;font-family:monospace;">THANKS10</h2>
    <p style="color:#a16207;font-size:14px;margin:0;">10% off your next order — no minimum spend</p>
  </div>
  <div style="text-align:center;margin:0 0 28px;">
    <a href="__CTA__" style="display:inline-block;background:linear-gradient(135deg,#d97706,#f59e0b);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:10px;">Redeem My Gift →</a>
  </div>
  <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">Code valid for 30 days. One use per customer.</p>
</td></tr>

<tr><td style="background:#f9fafb;border-radius:0 0 16px 16px;padding:24px 48px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because you're a valued customer.</p>
  <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">To unsubscribe, reply to this email.</p>
</td></tr>

</table></td></tr></table></body></html>`,
  },
  {
    id: 'dark-newsletter',
    label: 'Dark Newsletter',
    desc: 'Full dark theme — like a brand email',
    headerBg: 'linear-gradient(135deg,#0f0f0f,#1a1a1a)',
    subject: '📣 What\'s New This Month',
    body: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<tr><td style="background:#0f0f0f;padding:24px 48px;text-align:center;border-radius:16px 16px 0 0;">
  <p style="color:#f9fafb;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.5px;">Your Shop Name</p>
</td></tr>

<tr><td style="background:#1a1a1a;padding:56px 48px;text-align:center;">
  <p style="color:#6b7280;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 16px;">Monthly Update</p>
  <h1 style="color:#f9fafb;font-size:44px;font-weight:900;margin:0 0 16px;line-height:1.15;">More Time<br/>to Save More</h1>
  <p style="color:#9ca3af;font-size:16px;margin:0 0 32px;line-height:1.7;">Discover our latest offers and exclusive deals,<br/>crafted just for you.</p>
  <a href="__CTA__" style="display:inline-block;background:#f9fafb;color:#111827;font-size:15px;font-weight:800;text-decoration:none;padding:16px 40px;border-radius:10px;">Explore Now →</a>
</td></tr>

__HERO__

<tr><td style="height:1px;background:#1f2937;"></td></tr>

<tr><td style="background:#111827;padding:40px 48px;">
  <h2 style="color:#f9fafb;font-size:22px;font-weight:700;margin:0 0 16px;">What's New This Season</h2>
  <p style="color:#9ca3af;font-size:15px;line-height:1.8;margin:0 0 24px;">We've been working hard to bring you the best products and offers. Here's a quick look at what to explore this month:</p>
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="width:50%;padding:0 10px 0 0;vertical-align:top;">
      <div style="background:#1f2937;border-radius:10px;padding:20px;">
        <p style="font-size:22px;margin:0 0 8px;">🛍️</p>
        <p style="color:#f9fafb;font-size:14px;font-weight:600;margin:0 0 6px;">New Collection</p>
        <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.6;">Fresh products just added to the store.</p>
      </div>
    </td>
    <td style="width:50%;padding:0 0 0 10px;vertical-align:top;">
      <div style="background:#1f2937;border-radius:10px;padding:20px;">
        <p style="font-size:22px;margin:0 0 8px;">⭐</p>
        <p style="color:#f9fafb;font-size:14px;font-weight:600;margin:0 0 6px;">Exclusive Deals</p>
        <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.6;">Limited-time prices you won't find anywhere.</p>
      </div>
    </td>
  </tr></table>
</td></tr>

<tr><td style="background:#111827;padding:0 48px 40px;text-align:center;">
  <a href="__CTA__" style="display:inline-block;background:#6B3FD9;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:10px;">Visit Our Store →</a>
</td></tr>

<tr><td style="background:#0f0f0f;border-radius:0 0 16px 16px;padding:24px 48px;text-align:center;">
  <p style="color:#374151;font-size:12px;margin:0;">You're receiving this as a valued customer. To unsubscribe, reply to this email.</p>
</td></tr>

</table></td></tr></table></body></html>`,
  },
];

export default function EmailMarketingPage() {
  const [shopId, setShopId] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [sendResult, setSendResult] = useState<{ sent: number; total_customers: number } | null>(null);
  const [sendError, setSendError] = useState('');

  // Usage / plan info
  const [usageMarketing, setUsageMarketing] = useState<{ used: number; limit: number | null } | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('shop_id') || '';
    setShopId(id);
  }, []);

  const load = async () => {
    if (!shopId) return;
    try {
      const [camRes, usageRes] = await Promise.all([
        marketingApi.getEmailCampaigns(shopId),
        usageApi.get(shopId),
      ]);
      setCampaigns(camRes.data ?? []);
      setUsageMarketing(usageRes.data?.emails?.marketing ?? null);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowTemplates(false); setShowModal(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c.name, subject: c.subject, body_html: c.body_html || '', ctaLink: 'https://thedersi.lk/new-arrivals', heroImage: '' }); setShowTemplates(false); setShowModal(true); };

  const applyTemplate = (t: Template) => {
    const heroHtml = form.heroImage
      ? `<tr><td style="padding:0;"><img src="${form.heroImage}" alt="" style="width:100%;max-height:340px;object-fit:cover;display:block;" /></td></tr>`
      : '';
    const applied = t.body
      .replace(/__CTA__/g, form.ctaLink || 'https://thedersi.lk/new-arrivals')
      .replace('__HERO__', heroHtml);
    setForm(f => ({ ...f, subject: t.subject, body_html: applied }));
    setShowTemplates(false);
  };

  const save = async () => {
    if (!form.name.trim() || !form.subject.trim()) return;
    setSaving(true);
    try {
      if (editing) { await marketingApi.updateEmailCampaign(shopId, editing.id, form); }
      else { await marketingApi.createEmailCampaign(shopId, form); }
      setShowModal(false);
      load();
    } catch {}
    finally { setSaving(false); }
  };

  const sendCampaign = async (c: any) => {
    setSending(c.id);
    setSendResult(null);
    setSendError('');
    try {
      const r = await marketingApi.sendEmailCampaign(shopId, c.id);
      setSendResult(r.data);
      load();
    } catch (err: any) {
      setSendError(err?.response?.data?.detail ?? 'Failed to send campaign.');
    } finally {
      setSending(null);
    }
  };

  const del = async (c: any) => {
    if (!confirm('Delete this campaign?')) return;
    try { await marketingApi.deleteEmailCampaign(shopId, c.id); load(); } catch {}
  };

  const preview = campaigns.find(c => c.id === previewId);
  const marketingLocked = usageMarketing?.limit === 0;
  const marketingFull = usageMarketing !== null && usageMarketing.limit !== null && usageMarketing.used >= usageMarketing.limit;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Marketing</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and send promotional emails to your customers</p>
        </div>
        <button
          onClick={openNew}
          disabled={marketingLocked}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Plan gate */}
      {marketingLocked && (
        <div className="bg-muted border border-border rounded-xl px-5 py-3.5 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Email marketing is not available on your current plan.</p>
          <Link href="/dashboard/billing" className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            Upgrade Plan
          </Link>
        </div>
      )}

      {/* Usage bar */}
      {usageMarketing && usageMarketing.limit !== null && usageMarketing.limit > 0 && (
        <div className="bg-card border border-border rounded-xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">Marketing emails</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${marketingFull ? 'bg-red-500' : usageMarketing.used / usageMarketing.limit >= 0.8 ? 'bg-yellow-500' : 'bg-primary'}`}
              style={{ width: `${Math.min((usageMarketing.used / usageMarketing.limit) * 100, 100)}%` }}
            />
          </div>
          <span className={`text-sm font-semibold tabular-nums shrink-0 ${marketingFull ? 'text-red-500' : 'text-foreground'}`}>
            {usageMarketing.used} / {usageMarketing.limit}
          </span>
        </div>
      )}

      {/* Send result banner */}
      {sendResult && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400 flex-1">
            Campaign sent to <strong>{sendResult.sent}</strong> customer{sendResult.sent !== 1 ? 's' : ''} (out of {sendResult.total_customers} with emails).
          </p>
          <button onClick={() => setSendResult(null)} className="p-1 hover:bg-muted rounded text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}
      {sendError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400 flex-1">{sendError}</p>
          <button onClick={() => setSendError('')} className="p-1 hover:bg-muted rounded text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: campaigns.length, color: '' },
          { label: 'Draft', value: campaigns.filter(c => c.status === 'draft').length, color: 'text-muted-foreground' },
          { label: 'Scheduled', value: campaigns.filter(c => c.status === 'scheduled').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Sent', value: campaigns.filter(c => c.status === 'sent').length, color: 'text-green-600 dark:text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color || 'text-foreground'}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : campaigns.length === 0 ? (
          <div className="p-16 text-center">
            <Mail className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-5">Create your first email campaign to reach your customers</p>
            {!marketingLocked && (
              <button onClick={openNew} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <Plus className="w-4 h-4" /> New Campaign
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {['Campaign', 'Subject', 'Status', 'Recipients', 'Created', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20 transition">
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{c.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[c.status] || STATUS_COLORS.draft}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.recipients_count > 0 ? c.recipients_count : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPreviewId(c.id)} className="p-1.5 text-muted-foreground hover:text-primary rounded transition" title="Preview"><Eye className="w-4 h-4" /></button>
                        {c.status !== 'sent' && (
                          <>
                            <button onClick={() => openEdit(c)} className="p-1.5 text-muted-foreground hover:text-primary rounded transition" title="Edit"><Edit2 className="w-4 h-4" /></button>
                            <button
                              onClick={() => sendCampaign(c)}
                              disabled={!!sending || marketingLocked || marketingFull}
                              className="p-1.5 text-muted-foreground hover:text-green-600 dark:hover:text-green-400 rounded transition disabled:opacity-40"
                              title={marketingLocked ? 'Upgrade to send' : marketingFull ? 'Monthly limit reached' : 'Send to all customers'}
                            >
                              {sending === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                        <button onClick={() => del(c)} className="p-1.5 text-muted-foreground hover:text-destructive rounded transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">{editing ? 'Edit Campaign' : 'New Email Campaign'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">

              {/* Store link + hero image — used when applying templates */}
              <div className="grid grid-cols-1 gap-4 p-4 bg-muted/40 border border-border rounded-xl">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider -mb-1">Template Settings — fill before applying a template</p>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Button Link (Shop / Product URL)</label>
                  <input
                    value={form.ctaLink}
                    onChange={e => setForm(f => ({ ...f, ctaLink: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="https://thedersi.lk/new-arrivals"
                  />
                  <p className="text-xs text-muted-foreground mt-1">This URL goes into all "Shop Now" / CTA buttons in the template.</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Hero Image URL <span className="text-muted-foreground/60">(optional)</span></label>
                  <input
                    value={form.heroImage}
                    onChange={e => setForm(f => ({ ...f, heroImage: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="https://thedersi.lk/images/product.jpg"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Paste any image URL (product photo, banner). It will appear below the email header.</p>
                </div>
              </div>

              {/* Template picker toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTemplates(v => !v)}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition"
                >
                  <LayoutTemplate className="w-4 h-4" />
                  {showTemplates ? 'Hide templates' : 'Start from a template'}
                </button>
                {showTemplates && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {EMAIL_TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="text-left border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-sm transition group"
                      >
                        <div className="h-10 w-full" style={{ background: t.headerBg }} />
                        <div className="p-3 bg-muted/30 group-hover:bg-muted/60 transition">
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition">{t.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Campaign Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Summer Sale Campaign"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Subject Line *</label>
                <input
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Don't miss our biggest sale of the year!"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Email Body (HTML)</label>
                <textarea
                  value={form.body_html}
                  onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))}
                  rows={10}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm font-mono focus:ring-2 focus:ring-primary outline-none resize-y"
                  placeholder="<h1>Hello!</h1><p>Your message here...</p>"
                />
                <p className="text-xs text-muted-foreground mt-1">HTML is rendered as-is. Use templates above for a quick start.</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition text-sm">Cancel</button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim() || !form.subject.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{preview.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Subject: {preview.subject}</p>
              </div>
              <button onClick={() => setPreviewId(null)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition shrink-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {preview.body_html ? (
                <div
                  className="border border-border rounded-lg p-4 bg-white text-black"
                  dangerouslySetInnerHTML={{ __html: preview.body_html }}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">No email body yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
