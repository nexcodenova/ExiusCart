'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, FileX, Loader2, Ban, ChevronDown, Search } from 'lucide-react';
import { creditNotesApi, ordersApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface CreditNote {
  id: number;
  cn_number: string;
  order_id: number | null;
  order_number: string | null;
  reason: string;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Order { id: number; order_number: string; total: number; }

const STATUS_STYLES: Record<string, string> = {
  issued: 'bg-green-500/10 text-green-600 dark:text-green-400',
  applied: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  voided: 'bg-red-500/10 text-red-500 line-through',
};

export default function CreditNotesPage() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [saving, setSaving] = useState(false);
  const [voidingId, setVoidingId] = useState<number | null>(null);
  const [form, setForm] = useState({ order_id: '', reason: '', amount: '', notes: '' });
  const [error, setError] = useState('');
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { sym, fmt } = useCurrency();

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [cnRes, ordRes] = await Promise.all([
        creditNotesApi.getAll(shopId),
        ordersApi.getAll(shopId),
      ]);
      setNotes(cnRes.data ?? []);
      setOrders(
        (ordRes.data ?? []).map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          total: Number(o.total),
        }))
      );
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  const filtered = notes.filter(
    (n) =>
      n.cn_number.toLowerCase().includes(search.toLowerCase()) ||
      (n.order_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      n.reason.toLowerCase().includes(search.toLowerCase())
  );

  const totalIssued = notes.filter((n) => n.status === 'issued').reduce((s, n) => s + n.amount, 0);

  const handleCreate = async () => {
    setError('');
    if (!form.reason.trim()) { setError('Reason is required'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError('Amount must be greater than 0'); return; }
    setSaving(true);
    try {
      await creditNotesApi.create(shopId, {
        order_id: form.order_id ? parseInt(form.order_id) : undefined,
        reason: form.reason.trim(),
        amount: parseFloat(form.amount),
        notes: form.notes.trim() || undefined,
      });
      setShowModal(false);
      setForm({ order_id: '', reason: '', amount: '', notes: '' });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to create credit note');
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async (id: number) => {
    setVoidingId(id);
    try {
      await creditNotesApi.void(shopId, id);
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'voided' } : n)));
    } catch { /* no-op */ }
    finally { setVoidingId(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credit Notes</h1>
          <p className="text-muted-foreground text-sm">Issue refund credits for orders or adjustments</p>
        </div>
        <button type="button" onClick={() => { setError(''); setShowModal(true); }}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition text-sm">
          <Plus className="w-4 h-4" /> New Credit Note
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Issued</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : notes.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Outstanding Value</p>
          <p className="text-2xl font-bold text-amber-500">{loading ? '—' : `${fmt(totalIssued)}`}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Voided</p>
          <p className="text-2xl font-bold text-muted-foreground">{loading ? '—' : notes.filter((n) => n.status === 'voided').length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder="Search by CN number, order, or reason..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <FileX className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{search ? 'No matches found' : 'No credit notes yet'}</h3>
            <p className="text-sm text-muted-foreground mb-5">{search ? 'Try a different search term' : 'Issue your first credit note to get started'}</p>
            {!search && (
              <button type="button" onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <Plus className="w-4 h-4" /> New Credit Note
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">CN #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((cn) => (
                  <tr key={cn.id} className="hover:bg-muted/20 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">{cn.cn_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{cn.order_number ?? '—'}</td>
                    <td className="px-4 py-3 text-foreground max-w-[200px] truncate">{cn.reason}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt(cn.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[cn.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {cn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(cn.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      {cn.status === 'issued' && (
                        <button type="button" onClick={() => handleVoid(cn.id)} disabled={voidingId === cn.id}
                          title="Void this credit note"
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 px-2 py-1 rounded-lg transition disabled:opacity-50">
                          {voidingId === cn.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-lg">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">New Credit Note</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Linked Order */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Linked Order (optional)</label>
                <div className="relative">
                  <select value={form.order_id} onChange={(e) => {
                    const oid = e.target.value;
                    setForm((f) => {
                      const ord = orders.find((o) => String(o.id) === oid);
                      return { ...f, order_id: oid, amount: ord ? String(ord.total) : f.amount };
                    });
                  }}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none appearance-none text-sm">
                    <option value="">No linked order</option>
                    {orders.slice(0, 100).map((o) => (
                      <option key={o.id} value={o.id}>#{o.order_number} — {fmt(o.total)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Reason *</label>
                <input type="text" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Damaged item, wrong product shipped..."
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none text-sm" />
              </div>

              {/* Amount */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Credit Amount ({sym}) *</label>
                <input type="number" min={0.01} step="0.01" value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none text-sm" />
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Internal Notes (optional)</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional context..."
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none resize-none text-sm" />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2.5 rounded-lg">{error}</p>
              )}
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition text-sm">
                Cancel
              </button>
              <button type="button" onClick={handleCreate} disabled={saving}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Issue Credit Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
