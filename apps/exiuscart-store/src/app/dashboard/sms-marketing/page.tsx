'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare, Loader2, Eye, EyeOff, X, Lock,
  Plus, Send, Trash2, Edit2, CheckCircle2,
} from 'lucide-react';
import { smsApi, marketingApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface Campaign {
  id: number;
  name: string;
  message: string;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  recipients_count: number;
  delivered_count: number;
  created_at: string | null;
  sent_at: string | null;
}

const STATUS_META: Record<Campaign['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  sending: { label: 'Sending…', className: 'bg-amber-500/10 text-amber-600' },
  sent: { label: 'Sent', className: 'bg-green-500/10 text-green-600' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
};

const EMPTY_FORM = { name: '', message: '' };

function ConnectModal({ shopId, onClose, onConnected }: { shopId: string; onClose: () => void; onConnected: () => void }) {
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await smsApi.connect(shopId, {
        account_sid: accountSid.trim(), auth_token: authToken.trim(), from_number: fromNumber.trim(),
      });
      onConnected();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not verify these credentials. Please check them and try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <p className="font-semibold text-foreground">Connect Twilio</p>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Account SID *</label>
            <input type="text" value={accountSid} onChange={(e) => setAccountSid(e.target.value)} required
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Auth Token *</label>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} value={authToken} onChange={(e) => setAuthToken(e.target.value)} required
                className="w-full px-3 py-2.5 pr-10 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              <button type="button" onClick={() => setShowToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">From Number *</label>
            <input type="text" value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} required
              placeholder="+14155552671"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">
            Find all three under <span className="font-medium text-foreground">console.twilio.com → Account → API keys &amp; tokens</span>, on your own Twilio account. Messages send through your own account — ExiusCart never sees or pays for them.
          </p>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}

function CampaignModal({ editing, onClose, onSaved }: { editing: Campaign | null; onClose: () => void; onSaved: (form: { name: string; message: string }) => Promise<void> }) {
  const [form, setForm] = useState(editing ? { name: editing.name, message: editing.message } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const charCount = form.message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  const save = async () => {
    if (!form.name.trim() || !form.message.trim()) return;
    setSaving(true);
    try { await onSaved(form); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <p className="font-semibold text-foreground">{editing ? 'Edit Campaign' : 'New SMS Campaign'}</p>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Campaign Name *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Flash Sale Alert"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm text-muted-foreground">Message *</label>
              <span className="text-xs text-muted-foreground">{charCount}/160 chars · {smsCount} SMS</span>
            </div>
            <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={4}
              placeholder="Hi! Get 20% off today only. Use code SALE20. Reply STOP to unsubscribe."
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-foreground border border-border rounded-lg hover:bg-muted transition">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SmsMarketingPage() {
  const [shopId, setShopId] = useState('');
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [connected, setConnected] = useState<{ from_number: string } | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [banner, setBanner] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const loadStatus = (sid: string) => {
    setChecking(true);
    smsApi.status(sid)
      .then((r) => setConnected(r.data?.connected ? r.data : null))
      .catch(() => setConnected(null))
      .finally(() => setChecking(false));
  };

  const loadCampaigns = (sid: string) => {
    setLoadingCampaigns(true);
    marketingApi.getSmsCampaigns(sid).then((r) => setCampaigns(r.data ?? [])).catch(() => {}).finally(() => setLoadingCampaigns(false));
  };

  useEffect(() => {
    if (!shopId) return;
    loadStatus(shopId);
    loadCampaigns(shopId);
  }, [shopId]);

  const openNew = () => { setEditing(null); setShowCampaignModal(true); };
  const openEdit = (c: Campaign) => { setEditing(c); setShowCampaignModal(true); };

  const handleSaveCampaign = async (form: { name: string; message: string }) => {
    try {
      if (editing) await marketingApi.updateSmsCampaign(shopId, editing.id, form);
      else await marketingApi.createSmsCampaign(shopId, form);
      setShowCampaignModal(false);
      loadCampaigns(shopId);
    } catch { /* form stays open on failure */ }
  };

  const handleSend = async (id: number) => {
    if (!confirm('Send this campaign to every customer with a phone number on file? This uses your own Twilio account and will be billed by Twilio directly.')) return;
    setSendingId(id);
    try {
      const r = await marketingApi.sendSmsCampaign(shopId, id);
      setBanner(`Sent ${r.data.sent} of ${r.data.total} — ${r.data.failed} failed.`);
      loadCampaigns(shopId);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail?.error === 'upgrade_required') setLocked(true);
      else if (detail?.error === 'sms_not_connected') setConnected(null);
      else setBanner(detail?.message ?? detail ?? 'Could not send this campaign.');
    } finally { setSendingId(null); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this campaign?')) return;
    await marketingApi.deleteSmsCampaign(shopId, id);
    loadCampaigns(shopId);
  };

  if (checking) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">SMS Marketing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Broadcast text campaigns to every customer with a phone number on file.</p>
          </div>
        </div>

        {locked && (
          <div className="flex items-start gap-2 text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>SMS marketing is available on Growth and Scale. Upgrade to unlock it.</span>
          </div>
        )}

        <div className="border border-border rounded-2xl bg-card p-8 sm:p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <MessageSquare className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Connect your own Twilio account</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-md">
            Twilio charges per text sent, billed directly to your own Twilio account — not ExiusCart's. Set one up (or use an existing one), then connect it below.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">
              Open Twilio Console
            </a>
            <button onClick={() => setShowConnectModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
              Connect Twilio
            </button>
          </div>
        </div>
        {showConnectModal && (
          <ConnectModal shopId={shopId} onClose={() => setShowConnectModal(false)}
            onConnected={() => { setShowConnectModal(false); loadStatus(shopId); }} />
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">SMS Marketing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sending from <span className="font-medium text-foreground">{connected.from_number}</span>
            </p>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {banner && (
        <div className="flex items-center justify-between gap-2 text-sm bg-muted text-muted-foreground rounded-lg px-3 py-2.5">
          <span>{banner}</span>
          <button onClick={() => setBanner('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {locked && (
        <div className="flex items-start gap-2 text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2.5">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>SMS marketing is available on Growth and Scale. Upgrade to unlock it.</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Campaigns', value: campaigns.length },
          { label: 'Draft', value: campaigns.filter((c) => c.status === 'draft').length },
          { label: 'Sent', value: campaigns.filter((c) => c.status === 'sent').length },
        ].map((s) => (
          <div key={s.label} className="border border-border rounded-2xl bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Campaigns</h2>
        {loadingCampaigns ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="border border-border rounded-2xl bg-card py-10 text-center text-sm text-muted-foreground">No SMS campaigns yet.</div>
        ) : (
          <div className="space-y-2.5">
            {campaigns.map((c) => {
              const meta = STATUS_META[c.status] ?? STATUS_META.draft;
              return (
                <div key={c.id} className="border border-border rounded-xl bg-card p-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.className}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {c.message}
                      {c.status !== 'draft' && (
                        <span className="inline-flex items-center gap-1 ml-2">
                          <CheckCircle2 className="w-3 h-3 text-green-600" /> {c.delivered_count} delivered
                          {c.recipients_count > c.delivered_count && (
                            <span className="text-destructive ml-1">· {c.recipients_count - c.delivered_count} failed</span>
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                  {c.status === 'draft' && (
                    <>
                      <button onClick={() => openEdit(c)} className="p-2 text-muted-foreground hover:text-foreground">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleSend(c.id)} disabled={sendingId === c.id}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center gap-1.5">
                        {sendingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Send
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCampaignModal && (
        <CampaignModal editing={editing} onClose={() => setShowCampaignModal(false)} onSaved={handleSaveCampaign} />
      )}
    </div>
  );
}
