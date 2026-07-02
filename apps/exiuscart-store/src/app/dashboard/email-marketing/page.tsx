'use client';
import { useState, useEffect } from 'react';
import { Plus, Mail, Send, Trash2, Edit2, Eye, X, Loader2, LayoutTemplate, CheckCircle, AlertCircle } from 'lucide-react';
import { marketingApi, usageApi } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-green-500/10 text-green-600 dark:text-green-400',
  scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  cancelled: 'bg-red-500/10 text-red-500',
};

const EMPTY = { name: '', subject: '', body_html: '' };

interface Template { id: string; label: string; desc: string; subject: string; body: string; }

const EMAIL_TEMPLATES: Template[] = [
  {
    id: 'promo',
    label: 'Promotional Offer',
    desc: 'Discount coupon for customers',
    subject: '🎉 Special Offer Just for You!',
    body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;background:#ffffff;">
  <h1 style="color:#111827;font-size:24px;margin-bottom:8px;">Exclusive Offer Just for You! 🎉</h1>
  <p style="color:#6b7280;font-size:15px;">Hi there,</p>
  <p style="color:#6b7280;font-size:15px;">We have a special discount waiting for you. Use the code below at checkout:</p>
  <div style="background:#f9fafb;border:2px dashed #e5e7eb;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
    <p style="color:#9ca3af;font-size:13px;margin:0 0 6px;">Your discount code</p>
    <h2 style="color:#111827;font-size:32px;font-weight:bold;letter-spacing:4px;margin:0;">SAVE20</h2>
    <p style="color:#9ca3af;font-size:13px;margin:6px 0 0;">20% off your next purchase</p>
  </div>
  <p style="color:#6b7280;font-size:15px;">This offer is valid for a limited time only. Don't miss out!</p>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #f3f4f6;padding-top:16px;">To unsubscribe, reply to this email.</p>
</div>`,
  },
  {
    id: 'sale',
    label: 'Flash Sale',
    desc: 'Urgency-driven sale campaign',
    subject: '⚡ Flash Sale — Ends Tonight!',
    body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;background:#ffffff;">
  <div style="background:#ef4444;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
    <h1 style="color:#ffffff;font-size:28px;margin:0;">⚡ FLASH SALE</h1>
    <p style="color:#fecaca;font-size:14px;margin:6px 0 0;">Limited time — ends tonight at midnight</p>
  </div>
  <p style="color:#6b7280;font-size:15px;">Hi there,</p>
  <p style="color:#6b7280;font-size:15px;">Our biggest flash sale is live right now. Selected products are up to <strong style="color:#111827;">50% OFF</strong> for the next few hours only.</p>
  <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:4px;padding:16px;margin:24px 0;">
    <p style="color:#c2410c;font-size:14px;font-weight:bold;margin:0;">⏰ Hurry — stock is limited!</p>
  </div>
  <p style="color:#6b7280;font-size:15px;">Visit our store now before prices go back up.</p>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #f3f4f6;padding-top:16px;">To unsubscribe, reply to this email.</p>
</div>`,
  },
  {
    id: 'arrival',
    label: 'New Arrival',
    desc: 'Announce new products',
    subject: '✨ New Products Just Arrived!',
    body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;background:#ffffff;">
  <h1 style="color:#111827;font-size:24px;margin-bottom:8px;">Something New Just Arrived ✨</h1>
  <p style="color:#6b7280;font-size:15px;">Hi there,</p>
  <p style="color:#6b7280;font-size:15px;">We're excited to share that new products are now available in our store. Fresh styles, great quality — check them out before they sell out!</p>
  <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin:24px 0;">
    <p style="color:#166534;font-size:14px;font-weight:600;margin:0 0 6px;">🆕 New arrivals include:</p>
    <ul style="color:#15803d;font-size:14px;margin:0;padding-left:20px;">
      <li>Latest collection items</li>
      <li>Exclusive limited stock</li>
      <li>Special introductory prices</li>
    </ul>
  </div>
  <p style="color:#6b7280;font-size:15px;">Visit us in-store or online to be the first to grab these!</p>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #f3f4f6;padding-top:16px;">To unsubscribe, reply to this email.</p>
</div>`,
  },
  {
    id: 'loyalty',
    label: 'Thank You / Loyalty',
    desc: 'Appreciate your customers',
    subject: '💛 Thank You for Your Support!',
    body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;background:#ffffff;">
  <h1 style="color:#111827;font-size:24px;margin-bottom:8px;">Thank You! 💛</h1>
  <p style="color:#6b7280;font-size:15px;">Hi there,</p>
  <p style="color:#6b7280;font-size:15px;">We just wanted to take a moment to say <strong style="color:#111827;">thank you</strong> for your support. Customers like you are the reason we do what we do.</p>
  <div style="background:#fefce8;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
    <p style="color:#a16207;font-size:15px;margin:0 0 8px;">As a valued customer, here's a little gift:</p>
    <h2 style="color:#854d0e;font-size:28px;font-weight:bold;letter-spacing:3px;margin:0;">THANKS10</h2>
    <p style="color:#a16207;font-size:13px;margin:6px 0 0;">10% off your next order</p>
  </div>
  <p style="color:#6b7280;font-size:15px;">We look forward to serving you again soon.</p>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #f3f4f6;padding-top:16px;">To unsubscribe, reply to this email.</p>
</div>`,
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
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c.name, subject: c.subject, body_html: c.body_html || '' }); setShowTemplates(false); setShowModal(true); };

  const applyTemplate = (t: Template) => {
    setForm(f => ({ ...f, subject: t.subject, body_html: t.body }));
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
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">Email marketing not available on your plan</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upgrade to <strong>Starter</strong> (200 emails/month), <strong>TheDersi Pro</strong>, or <strong>Premium</strong> to send marketing emails to customers.
            </p>
          </div>
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
                        className="text-left p-3 bg-muted/50 hover:bg-muted border border-border rounded-lg transition group"
                      >
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition">{t.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
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
