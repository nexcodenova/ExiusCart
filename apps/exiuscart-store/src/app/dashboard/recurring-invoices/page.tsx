'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, RefreshCw, Loader2, Trash2, Send, Pause, Play,
  Calendar, ChevronDown, Search, RotateCcw,
} from 'lucide-react';
import { recurringInvoicesApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface RItem { name: string; qty: number; unit_price: number; total: number; }
interface RecurringInvoice {
  id: number;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  items: RItem[];
  subtotal: number; discount: number; tax: number; total: number;
  notes: string | null;
  frequency: string;
  next_send_date: string;
  last_sent_at: string | null;
  send_count: number;
  is_active: boolean;
}

const FREQ_LABEL: Record<string, string> = {
  weekly: 'Every week', monthly: 'Every month',
  quarterly: 'Every 3 months', yearly: 'Every year',
};
const FREQ_COLOR: Record<string, string> = {
  weekly: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  monthly: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  quarterly: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  yearly: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

export default function RecurringInvoicesPage() {
  const [items, setItems] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { fmt, sym } = useCurrency();

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try { setItems((await recurringInvoicesApi.getAll(shopId)).data ?? []); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((r) =>
    r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.customer_email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = items.filter((r) => r.is_active).length;
  const monthlyTotal = items.filter((r) => r.is_active && r.frequency === 'monthly').reduce((s, r) => s + r.total, 0);

  const handleSendNow = async (id: number) => {
    setSendingId(id);
    try {
      await recurringInvoicesApi.sendNow(shopId, id);
      load();
    } catch { /* no-op */ }
    finally { setSendingId(null); }
  };

  const handleToggle = async (r: RecurringInvoice) => {
    setTogglingId(r.id);
    try {
      await recurringInvoicesApi.update(shopId, r.id, { is_active: !r.is_active });
      setItems((prev) => prev.map((i) => i.id === r.id ? { ...i, is_active: !r.is_active } : i));
    } catch { /* no-op */ }
    finally { setTogglingId(null); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this recurring invoice? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await recurringInvoicesApi.delete(shopId, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch { /* no-op */ }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recurring Invoices</h1>
          <p className="text-muted-foreground text-sm">Auto-send invoices weekly, monthly, or quarterly</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition text-sm">
          <Plus className="w-4 h-4" /> New Recurring Invoice
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Active</p>
          <p className="text-2xl font-bold text-green-500">{loading ? '—' : activeCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Schedules</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : items.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Monthly Revenue</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : fmt(monthlyTotal)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder="Search by customer name or email..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>

      {/* List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <RotateCcw className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{search ? 'No matches' : 'No recurring invoices yet'}</h3>
            <p className="text-sm text-muted-foreground mb-5">{search ? 'Try a different search' : 'Set up auto-billing for retainers, subscriptions, or rent'}</p>
            {!search && (
              <button type="button" onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <Plus className="w-4 h-4" /> New Recurring Invoice
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => (
              <div key={r.id} className={`p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/20 transition ${!r.is_active ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-foreground truncate">{r.customer_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FREQ_COLOR[r.frequency] ?? 'bg-muted text-muted-foreground'}`}>
                      {FREQ_LABEL[r.frequency] ?? r.frequency}
                    </span>
                    {!r.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Paused</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {r.customer_email && <span>{r.customer_email}</span>}
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Next: {r.next_send_date}</span>
                    {r.send_count > 0 && <span>Sent {r.send_count}×</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <span className="font-bold text-foreground text-sm">{fmt(r.total)} {sym}</span>
                  <button type="button" onClick={() => handleSendNow(r.id)} disabled={sendingId === r.id || !r.customer_email}
                    title={!r.customer_email ? 'No email address' : 'Send now'}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition disabled:opacity-40">
                    {sendingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send now
                  </button>
                  <button type="button" onClick={() => handleToggle(r)} disabled={togglingId === r.id}
                    title={r.is_active ? 'Pause' : 'Resume'}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition">
                    {togglingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : r.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition">
                    {deletingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <CreateRecurringModal shopId={shopId} onClose={() => setShowModal(false)} onCreated={load} />
      )}
    </div>
  );
}


function CreateRecurringModal({ shopId, onClose, onCreated }: { shopId: string; onClose: () => void; onCreated: () => void }) {
  const { sym } = useCurrency();
  const [form, setForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '',
    frequency: 'monthly', start_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [lines, setLines] = useState<{ name: string; qty: number; unit_price: number }[]>([
    { name: '', qty: 1, unit_price: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);

  const addLine = () => setLines((p) => [...p, { name: '', qty: 1, unit_price: 0 }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const updateLine = (i: number, f: string, v: any) =>
    setLines((p) => p.map((l, idx) => idx === i ? { ...l, [f]: v } : l));

  const handleSave = async () => {
    setError('');
    if (!form.customer_name.trim()) { setError('Customer name is required'); return; }
    if (lines.every((l) => !l.name.trim())) { setError('Add at least one item'); return; }
    setSaving(true);
    try {
      const validLines = lines.filter((l) => l.name.trim());
      const items = validLines.map((l) => ({
        name: l.name, qty: l.qty, unit_price: l.unit_price, total: l.qty * l.unit_price,
      }));
      await recurringInvoicesApi.create(shopId, {
        ...form,
        customer_email: form.customer_email || null,
        customer_phone: form.customer_phone || null,
        items,
        subtotal,
        discount: 0,
        tax: 0,
        total: subtotal,
        notes: form.notes || null,
      });
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" /> New Recurring Invoice
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Customer Name *</label>
              <input type="text" value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                placeholder="Customer or company name"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={form.customer_email} onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
                placeholder="customer@email.com"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
              <input type="tel" value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                placeholder="+971 50 000 0000"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none text-sm" />
            </div>
          </div>

          {/* Frequency + Start */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Send Frequency *</label>
              <div className="relative">
                <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none appearance-none text-sm">
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                  <option value="quarterly">Every 3 months</option>
                  <option value="yearly">Every year</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">First Send Date *</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none text-sm" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-foreground">Items *</label>
              <button type="button" onClick={addLine} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add row
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {i === 0 && <p className="text-xs text-muted-foreground mb-1">Description</p>}
                    <input type="text" value={line.name} onChange={(e) => updateLine(i, 'name', e.target.value)}
                      placeholder="Service / product name"
                      className="w-full px-2 py-2 bg-muted border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none" />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <p className="text-xs text-muted-foreground mb-1">Qty</p>}
                    <input type="number" min={1} value={line.qty} onChange={(e) => updateLine(i, 'qty', parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-2 bg-muted border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none" />
                  </div>
                  <div className="col-span-4">
                    {i === 0 && <p className="text-xs text-muted-foreground mb-1">Unit Price ({sym})</p>}
                    <input type="number" min={0} step="0.01" value={line.unit_price} onChange={(e) => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 bg-muted border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(i)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Payment terms, service details..."
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none resize-none text-sm" />
          </div>

          {/* Total */}
          <div className="bg-muted/50 rounded-lg p-3 flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Invoice Total</span>
            <span className="text-xl font-bold text-foreground">{subtotal.toLocaleString()} {sym}</span>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2.5 rounded-lg">{error}</p>}
        </div>
        <div className="p-4 border-t border-border flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
