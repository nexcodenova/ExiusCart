'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, X, Trash2, ToggleLeft, ToggleRight, Copy, Check, Sparkles, Eye, MousePointerClick } from 'lucide-react';
import { popupsApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface Popup {
  id: number;
  name: string;
  popup_type: string;
  title: string;
  message: string | null;
  button_text: string | null;
  button_link: string | null;
  discount_code: string | null;
  image_url: string | null;
  delay_seconds: number;
  is_active: boolean;
  impressions: number;
  clicks: number;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  exit_intent: 'Exit-Intent Popup',
  announcement: 'Announcement Banner',
  email_capture: 'Email Capture',
  countdown: 'Countdown / Urgency',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  exit_intent: 'Shows when a visitor moves to leave the page — great for last-chance discounts.',
  announcement: 'Shows after a delay — good for sales, new arrivals, or shipping offers.',
  email_capture: 'Collects visitor emails in exchange for a discount code.',
  countdown: 'Creates urgency with a limited-time offer message.',
};

function PopupFormModal({ shopId, existing, onClose, onSaved }: {
  shopId: string; existing: Popup | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [popupType, setPopupType] = useState(existing?.popup_type ?? 'exit_intent');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [message, setMessage] = useState(existing?.message ?? '');
  const [buttonText, setButtonText] = useState(existing?.button_text ?? 'Shop Now');
  const [buttonLink, setButtonLink] = useState(existing?.button_link ?? '');
  const [discountCode, setDiscountCode] = useState(existing?.discount_code ?? '');
  const [delaySeconds, setDelaySeconds] = useState(existing?.delay_seconds ?? 3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim() || !title.trim()) { setError('Name and title are required.'); return; }
    setSaving(true); setError('');
    const payload = {
      name: name.trim(),
      popup_type: popupType,
      title: title.trim(),
      message: message.trim() || undefined,
      button_text: buttonText.trim() || undefined,
      button_link: buttonLink.trim() || undefined,
      discount_code: discountCode.trim() || undefined,
      delay_seconds: delaySeconds,
      is_active: existing?.is_active ?? true,
    };
    try {
      if (existing) await popupsApi.update(shopId, existing.id, payload);
      else await popupsApi.create(shopId, payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to save popup.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card">
          <p className="font-semibold text-foreground">{existing ? 'Edit Popup' : 'New Popup'}</p>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Internal Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Sale Exit Popup"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Popup Type</label>
            <select value={popupType} onChange={(e) => setPopupType(e.target.value)}
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-1">{TYPE_DESCRIPTIONS[popupType]}</p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Popup Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wait! Don't leave yet"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
              placeholder="Get 10% off your first order"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Button Text</label>
              <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="Shop Now"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Discount Code</label>
              <input value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} placeholder="SAVE10"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none" />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Button Link</label>
            <input value={buttonLink} onChange={(e) => setButtonLink(e.target.value)} placeholder="https://yourstore.com/collections/sale"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none" />
          </div>

          {popupType !== 'exit_intent' && (
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Show after (seconds)</label>
              <input type="number" min={0} value={delaySeconds} onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none" />
            </div>
          )}

          {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

          <button onClick={save} disabled={saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : existing ? 'Save Changes' : 'Create Popup'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmbedCodeBox({ shopId }: { shopId: string }) {
  const [copied, setCopied] = useState(false);
  const code = `<script src="https://api.exiuscart.com/api/v1/widget/popup.js" data-shop-id="${shopId}" async></script>`;

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-muted/40 border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium text-foreground">Add this to your website</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste this one line into your Custom Website's HTML (before <code className="text-foreground">&lt;/body&gt;</code>) to activate your popups. If you use Shopify, add it in Theme → Edit code → theme.liquid.
      </p>
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2.5">
        <code className="text-xs text-foreground flex-1 overflow-x-auto whitespace-nowrap">{code}</code>
        <button onClick={copy} className="shrink-0 p-1.5 hover:bg-muted rounded-lg transition">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

export default function PopupsPage() {
  const [shopId, setShopId] = useState('');
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Popup | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    setLoading(true);
    popupsApi.list(shopId)
      .then((r) => setPopups(r.data?.popups ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const toggle = async (id: number) => {
    setActingId(id);
    try { await popupsApi.toggle(shopId, id); load(); } finally { setActingId(null); }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this popup?')) return;
    setActingId(id);
    try { await popupsApi.remove(shopId, id); load(); } finally { setActingId(null); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Smart Upsells</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Storefront popups that recover abandoning visitors, capture emails, and increase order value.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition shrink-0">
          <Plus className="w-4 h-4" /> New Popup
        </button>
      </div>

      {shopId && <EmbedCodeBox shopId={shopId} />}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : popups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
          <Sparkles className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">No popups yet.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Create your first popup to start capturing more sales.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {popups.map((p) => (
            <div key={p.id} className="border border-border rounded-xl bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{TYPE_LABELS[p.popup_type] ?? p.popup_type}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{p.title}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {p.impressions} views</span>
                  <span className="flex items-center gap-1"><MousePointerClick className="w-3.5 h-3.5" /> {p.clicks} clicks</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggle(p.id)} disabled={actingId === p.id} className="text-primary transition">
                  {p.is_active ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                </button>
                <button onClick={() => { setEditing(p); setShowForm(true); }}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition">
                  Edit
                </button>
                <button onClick={() => remove(p.id)} disabled={actingId === p.id}
                  className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PopupFormModal shopId={shopId} existing={editing} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}
