'use client';

import { useState, useEffect } from 'react';
import {
  MessageCircle, Loader2, Eye, EyeOff, X, ExternalLink, Lock, RefreshCw,
  Send, Trash2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { whatsappApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface Template { id: number; name: string; language: string; category: string | null; status: string | null; body_text: string | null; variable_count: number; }
interface Campaign { id: number; name: string; status: 'draft' | 'sending' | 'sent' | 'failed'; template_id: number; template_name: string | null; total_recipients: number; sent_count: number; failed_count: number; created_at: string | null; sent_at: string | null; }

const STATUS_META: Record<Campaign['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  sending: { label: 'Sending…', className: 'bg-amber-500/10 text-amber-600' },
  sent: { label: 'Sent', className: 'bg-green-500/10 text-green-600' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
};

function ConnectModal({ shopId, onClose, onConnected }: { shopId: string; onClose: () => void; onConnected: () => void }) {
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await whatsappApi.connect(shopId, { waba_id: wabaId.trim(), phone_number_id: phoneNumberId.trim(), access_token: accessToken.trim() });
      onConnected();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not verify these credentials. Please check them and try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <p className="font-semibold text-foreground">Connect WhatsApp Business</p>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">WhatsApp Business Account ID *</label>
            <input type="text" value={wabaId} onChange={(e) => setWabaId(e.target.value)} required
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Phone Number ID *</label>
            <input type="text" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} required
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Access Token *</label>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} value={accessToken} onChange={(e) => setAccessToken(e.target.value)} required
                className="w-full px-3 py-2.5 pr-10 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              <button type="button" onClick={() => setShowToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">
            Find all three under <span className="font-medium text-foreground">business.facebook.com → WhatsApp Manager → API Setup</span>, on your own WhatsApp Business Account. Messages send through your own account — ExiusCart never sees or pays for them.
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

export default function WhatsAppMarketingPage() {
  const [shopId, setShopId] = useState('');
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [connected, setConnected] = useState<{ display_phone_number: string | null; verified_name: string | null } | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  const [newName, setNewName] = useState('');
  const [newTemplateId, setNewTemplateId] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [banner, setBanner] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const loadStatus = (sid: string) => {
    setChecking(true);
    whatsappApi.status(sid)
      .then((r) => setConnected(r.data?.connected ? r.data : null))
      .catch(() => setConnected(null))
      .finally(() => setChecking(false));
  };

  const loadTemplates = (sid: string) => {
    whatsappApi.listTemplates(sid).then((r) => setTemplates(r.data?.templates ?? [])).catch(() => {});
  };

  const loadCampaigns = (sid: string) => {
    setLoadingCampaigns(true);
    whatsappApi.listCampaigns(sid).then((r) => setCampaigns(r.data?.campaigns ?? [])).catch(() => {}).finally(() => setLoadingCampaigns(false));
  };

  useEffect(() => {
    if (!shopId) return;
    loadStatus(shopId);
    loadTemplates(shopId);
    loadCampaigns(shopId);
  }, [shopId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await whatsappApi.syncTemplates(shopId);
      loadTemplates(shopId);
      setBanner('Templates synced from Meta.');
    } catch (e: any) {
      setBanner(e?.response?.data?.detail ?? 'Could not sync templates.');
    } finally { setSyncing(false); }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newTemplateId) { setCreateError('Name and template are both required.'); return; }
    setCreating(true); setCreateError('');
    try {
      await whatsappApi.createCampaign(shopId, { name: newName.trim(), template_id: Number(newTemplateId) });
      setNewName(''); setNewTemplateId('');
      loadCampaigns(shopId);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail?.error === 'upgrade_required') setLocked(true);
      else setCreateError(detail ?? 'Could not create this campaign.');
    } finally { setCreating(false); }
  };

  const handleSend = async (id: number) => {
    if (!confirm('Send this campaign to every customer with a phone number on file? This uses your own WhatsApp Business account and will be billed by Meta directly.')) return;
    setSendingId(id);
    try {
      const r = await whatsappApi.sendCampaign(shopId, id);
      setBanner(`Sent ${r.data.sent} of ${r.data.total} — ${r.data.failed} failed.`);
      loadCampaigns(shopId);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail?.error === 'upgrade_required') setLocked(true);
      else if (detail?.error === 'whatsapp_not_connected') setConnected(null);
      else setBanner(detail?.message ?? detail ?? 'Could not send this campaign.');
    } finally { setSendingId(null); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this draft campaign?')) return;
    await whatsappApi.deleteCampaign(shopId, id);
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
          <MessageCircle className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">WhatsApp Marketing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Broadcast approved message templates to your customers over WhatsApp.</p>
          </div>
        </div>

        {locked && (
          <div className="flex items-start gap-2 text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>WhatsApp marketing is a Premium feature. Upgrade to unlock it.</span>
          </div>
        )}

        <div className="border border-border rounded-2xl bg-card p-8 sm:p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <MessageCircle className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Connect your own WhatsApp Business account</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-md">
            Meta charges per marketing message sent, billed directly to your own WhatsApp Business Account — not ExiusCart's. Set one up (or use an existing one), then connect it below.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <a href="https://business.facebook.com/wa/manage/home/" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">
              Open WhatsApp Manager <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button onClick={() => setShowConnectModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
              Connect WhatsApp
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
      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">WhatsApp Marketing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connected as <span className="font-medium text-foreground">{connected.verified_name || connected.display_phone_number}</span>
          </p>
        </div>
      </div>

      {banner && (
        <div className="flex items-center justify-between gap-2 text-sm bg-muted text-muted-foreground rounded-lg px-3 py-2.5">
          <span>{banner}</span>
          <button onClick={() => setBanner('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Templates */}
      <div className="border border-border rounded-2xl bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Approved templates</h2>
          <button onClick={handleSync} disabled={syncing}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-60">
            {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Sync from Meta
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No templates synced yet — create and get one approved in WhatsApp Manager, then sync.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {templates.map((t) => (
              <div key={t.id} className="border border-border rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{t.name}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${t.status === 'APPROVED' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>{t.status || 'unknown'}</span>
                </div>
                {t.body_text && <p className="text-muted-foreground line-clamp-2">{t.body_text}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New campaign */}
      <div className="border border-border rounded-2xl bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">New campaign</h2>
        {locked && (
          <div className="flex items-start gap-2 text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>WhatsApp marketing is a Premium feature. Upgrade to unlock it.</span>
          </div>
        )}
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Campaign name"
            className="px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary" />
          <select value={newTemplateId} onChange={(e) => setNewTemplateId(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary">
            <option value="">Choose template…</option>
            {templates.filter((t) => t.status === 'APPROVED').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={handleCreate} disabled={creating}
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap">
            {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create
          </button>
        </div>
        {createError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" /> {createError}
          </div>
        )}
      </div>

      {/* Campaigns list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Campaigns</h2>
        {loadingCampaigns ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="border border-border rounded-2xl bg-card py-10 text-center text-sm text-muted-foreground">No campaigns yet.</div>
        ) : (
          <div className="space-y-2.5">
            {campaigns.map((c) => {
              const meta = STATUS_META[c.status];
              return (
                <div key={c.id} className="border border-border rounded-xl bg-card p-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.className}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Template: {c.template_name} {c.status !== 'draft' && (
                        <span className="inline-flex items-center gap-1 ml-2">
                          <CheckCircle2 className="w-3 h-3 text-green-600" /> {c.sent_count} sent
                          {c.failed_count > 0 && <span className="text-destructive ml-1">· {c.failed_count} failed</span>}
                        </span>
                      )}
                    </p>
                  </div>
                  {c.status === 'draft' && (
                    <>
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
    </div>
  );
}
