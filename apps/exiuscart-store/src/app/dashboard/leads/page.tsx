'use client';
import { useState, useEffect } from 'react';
import { Plus, Target, Trash2, Edit2, X, Loader2, ChevronDown, Search } from 'lucide-react';
import Link from 'next/link';
import { leadsApi } from '@/lib/api';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
const SOURCES = ['manual', 'website', 'meta_ads', 'whatsapp', 'referral', 'other'] as const;

const STATUS_COLORS: Record<string, string> = {
  new:       'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  contacted: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  qualified: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  converted: 'bg-green-500/10 text-green-600 dark:text-green-400',
  lost:      'bg-red-500/10 text-red-500',
};

const EMPTY = { name: '', email: '', phone: '', company: '', source: 'manual', status: 'new', notes: '', value: '', assigned_to: '' };

export default function LeadsPage() {
  const [shopId, setShopId] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
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

  useEffect(() => { load(); }, [shopId, filterStatus, search]);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setError(''); setShowModal(true); };
  const openEdit = (l: any) => {
    setEditing(l);
    setForm({ name: l.name, email: l.email || '', phone: l.phone || '', company: l.company || '', source: l.source || 'manual', status: l.status || 'new', notes: l.notes || '', value: l.value ? String(l.value) : '', assigned_to: l.assigned_to || '' });
    setError('');
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, value: form.value ? parseFloat(form.value) : null };
      if (editing) { await leadsApi.update(shopId, editing.id, payload); }
      else { await leadsApi.create(shopId, payload); }
      setShowModal(false);
      load();
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

  const planLocked = stats?.limit === 0;
  const atLimit = stats?.limit !== null && stats?.limit !== undefined && stats?.total >= stats?.limit;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lead Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Track potential customers and move them through your pipeline</p>
        </div>
        <button
          onClick={openNew}
          disabled={planLocked}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      {/* Plan gate */}
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
              {filterStatus || search ? 'Try clearing your filters.' : 'Add your first lead to start tracking your pipeline.'}
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
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.email && <p>{l.email}</p>}
                      {l.phone && <p>{l.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.company || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{(l.source || 'manual').replace('_', ' ')}</td>
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
                    <td className="px-4 py-3 text-muted-foreground">
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
                    {SOURCES.map(s => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
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
