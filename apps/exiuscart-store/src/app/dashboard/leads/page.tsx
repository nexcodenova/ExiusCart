'use client';
import { useState, useEffect } from 'react';
import { Plus, Target, Trash2, Edit2, X, Loader2, ChevronDown, Search, Copy, Check as CheckIcon, Zap, Instagram, Facebook } from 'lucide-react';
import Link from 'next/link';
import { leadsApi } from '@/lib/api';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
const SOURCES  = ['manual', 'website', 'google_ads', 'meta_ads', 'whatsapp', 'referral', 'other'] as const;

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', website: 'Website', google_ads: 'Google Ads',
  meta_ads: 'Meta Ads', whatsapp: 'WhatsApp', referral: 'Referral', other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  new:       'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  contacted: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  qualified: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  converted: 'bg-green-500/10 text-green-600 dark:text-green-400',
  lost:      'bg-red-500/10 text-red-500',
};

const EMPTY = { name: '', email: '', phone: '', company: '', source: 'manual', status: 'new', notes: '', value: '', assigned_to: '' };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition">
      {copied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function LeadsPage() {
  const [shopId, setShopId] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [integration, setIntegration] = useState<any>(null);
  const [integrationLocked, setIntegrationLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('shop_id') || '';
    setShopId(id);
  }, []);

  const load = async () => {
    if (!shopId) return;
    try {
      const [leadsRes, statsRes] = await Promise.all([
        leadsApi.getAll(shopId, { status: filterStatus || undefined, search: search || undefined }),
        leadsApi.getStats(shopId),
      ]);
      setLeads(leadsRes.data ?? []);
      setStats(statsRes.data ?? null);
    } catch {}
    finally { setLoading(false); }
  };

  const loadIntegration = async () => {
    if (!shopId) return;
    try {
      const r = await leadsApi.getIntegration(shopId);
      setIntegration(r.data);
      setIntegrationLocked(false);
    } catch (err: any) {
      if (err?.response?.status === 403) setIntegrationLocked(true);
    }
  };

  useEffect(() => { load(); loadIntegration(); }, [shopId]);
  useEffect(() => { if (shopId) load(); }, [filterStatus, search]);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setError(''); setShowModal(true); };
  const openEdit = (l: any) => {
    setEditing(l);
    setForm({ name: l.name, email: l.email || '', phone: l.phone || '', company: l.company || '', source: l.source || 'manual', status: l.status || 'new', notes: l.notes || '', value: l.value ? String(l.value) : '', assigned_to: l.assigned_to || '' });
    setError(''); setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setError('');
    try {
      const payload = { ...form, value: form.value ? parseFloat(form.value) : null };
      if (editing) { await leadsApi.update(shopId, editing.id, payload); }
      else { await leadsApi.create(shopId, payload); }
      setShowModal(false); load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'object') setError(detail?.message || 'Failed to save lead.');
      else setError(detail || 'Failed to save lead.');
    } finally { setSaving(false); }
  };

  const quickStatus = async (lead: any, status: string) => {
    try { await leadsApi.update(shopId, lead.id, { status }); load(); } catch {}
  };

  const del = async (l: any) => {
    if (!confirm('Delete this lead?')) return;
    try { await leadsApi.delete(shopId, l.id); load(); } catch {}
  };

  const planLocked     = stats?.limit === 0;
  const atLimit        = stats?.limit !== null && stats?.limit !== undefined && stats?.total >= stats?.limit;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lead Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Track potential customers and convert them through your pipeline</p>
        </div>
        <button
          onClick={openNew}
          disabled={planLocked}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      {/* Plan gate — lead management */}
      {planLocked && (
        <div className="bg-muted border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Lead management is not available on your current plan.</p>
            <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Starter to track up to 500 leads, or Premium for unlimited.</p>
          </div>
          <Link href="/dashboard/billing" className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            Upgrade Plan
          </Link>
        </div>
      )}

      {/* ── Social Media Lead Capture ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Social Media Auto-Capture</h2>
        </div>

        {integrationLocked ? (
          <div className="px-5 py-5 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Automatically capture leads from Google Ads and Meta (Facebook / Instagram) directly into ExiusCart — no manual copying.</p>
            <Link href="/dashboard/billing" className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition whitespace-nowrap">
              Upgrade to unlock
            </Link>
          </div>
        ) : integration ? (
          <div className="divide-y divide-border">

            {/* Google Ads */}
            <div className="px-5 py-5 grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#4285F4]/10 flex items-center justify-center">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  </div>
                  <span className="font-semibold text-foreground text-sm">Google Ads</span>
                  <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 font-bold px-2 py-0.5 rounded-full">Live</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  When someone fills your Google Lead Form Ad, the lead is automatically added to ExiusCart. Paste the webhook URL into your Google Ads campaign.
                </p>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Open your Google Ads campaign</li>
                  <li>Go to <strong className="text-foreground">Assets → Lead form</strong></li>
                  <li>Click <strong className="text-foreground">Delivery → Webhook</strong></li>
                  <li>Paste the URL below and save</li>
                </ol>
              </div>
              <div className="flex flex-col justify-center gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Your Google Ads Webhook URL</label>
                  <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2">
                    <code className="text-xs text-foreground flex-1 break-all">{integration.google_webhook_url}</code>
                    <CopyButton text={integration.google_webhook_url} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Leads captured will appear with source <strong>Google Ads</strong>.</p>
                </div>
              </div>
            </div>

            {/* Meta — Coming Soon */}
            <div className="px-5 py-5 grid md:grid-cols-2 gap-6 opacity-60">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
                    <Facebook className="w-4 h-4 text-[#1877F2]" />
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] flex items-center justify-center -ml-3">
                    <Instagram className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-semibold text-foreground text-sm">Meta — Facebook &amp; Instagram</span>
                  <span className="text-[10px] bg-muted text-muted-foreground font-bold px-2 py-0.5 rounded-full border border-border">Coming Soon</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automatically capture leads from Facebook Lead Ads and Instagram Lead Ads into ExiusCart. Connect your Meta Business page once, and all ad leads flow in automatically.
                </p>
              </div>
              <div className="flex items-center">
                <div className="bg-muted/50 border border-dashed border-border rounded-xl px-4 py-4 text-center w-full">
                  <p className="text-xs font-medium text-muted-foreground">Meta integration is coming soon.</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">We'll notify you when it's ready.</p>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="px-5 py-6 text-center">
            <div className="inline-block w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Usage bar */}
      {stats && stats.limit !== null && stats.limit > 0 && (
        <div className="bg-card border border-border rounded-xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">Leads used</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${atLimit ? 'bg-red-500' : (stats.total / stats.limit) >= 0.8 ? 'bg-yellow-500' : 'bg-primary'}`}
              style={{ width: `${Math.min((stats.total / stats.limit) * 100, 100)}%` }}
            />
          </div>
          <span className={`text-sm font-semibold tabular-nums shrink-0 ${atLimit ? 'text-red-500' : 'text-foreground'}`}>
            {stats.total} / {stats.limit}
          </span>
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            className={`rounded-xl border p-3 text-left transition ${filterStatus === s ? 'border-primary/50 ring-1 ring-primary/30' : 'border-border hover:border-primary/30'} bg-card`}
          >
            <p className="text-xs text-muted-foreground capitalize">{s}</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{stats?.by_status?.[s] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search leads by name, email, phone, or company..."
          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : leads.length === 0 ? (
          <div className="p-16 text-center">
            <Target className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{filterStatus || search ? 'No leads match your filter' : 'No leads yet'}</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {filterStatus || search ? 'Try clearing your filters.' : 'Add your first lead manually, or connect Google Ads above for automatic capture.'}
            </p>
            {!planLocked && !filterStatus && !search && (
              <button onClick={openNew} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <Plus className="w-4 h-4" /> Add Lead
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {['Name', 'Contact', 'Company', 'Source', 'Status', 'Value', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map(l => (
                  <tr key={l.id} className="hover:bg-muted/20 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{l.name}</p>
                      {l.assigned_to && <p className="text-xs text-muted-foreground mt-0.5">Assigned: {l.assigned_to}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {l.email && <p>{l.email}</p>}
                      {l.phone && <p>{l.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{l.company || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{SOURCE_LABELS[l.source] || l.source}</td>
                    <td className="px-4 py-3">
                      <div className="relative group inline-block">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium capitalize cursor-pointer ${STATUS_COLORS[l.status] || STATUS_COLORS.new}`}>
                          {l.status} <ChevronDown className="w-3 h-3" />
                        </span>
                        <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover:block bg-card border border-border rounded-lg shadow-lg min-w-[130px] py-1">
                          {STATUSES.map(s => (
                            <button
                              key={s}
                              onClick={() => quickStatus(l, s)}
                              className={`w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-muted transition ${s === l.status ? 'font-semibold text-primary' : 'text-foreground'}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {l.value ? <span className="font-medium text-foreground">{Number(l.value).toLocaleString()}</span> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(l)} className="p-1.5 text-muted-foreground hover:text-primary rounded transition"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => del(l)} className="p-1.5 text-muted-foreground hover:text-destructive rounded transition"><Trash2 className="w-4 h-4" /></button>
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
          <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">{editing ? 'Edit Lead' : 'Add Lead'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground mb-1.5 block">Full Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="John Doe" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="+971 50 123 4567" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Company</label>
                  <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="Acme LLC" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Deal Value</label>
                  <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="5000" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Source</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none">
                    {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none">
                    {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Assigned To</label>
                  <input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="Staff name" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground mb-1.5 block">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none resize-none" placeholder="Any notes about this lead..." />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition text-sm">Cancel</button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
