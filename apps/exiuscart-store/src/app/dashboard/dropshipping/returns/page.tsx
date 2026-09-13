'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Loader2, Undo2, Plus, X, Search, Trash2, ChevronDown, Package,
} from 'lucide-react';
import { dropshipApi, ordersApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

type ReturnStatus = 'requested' | 'approved' | 'shipped_back' | 'refunded' | 'rejected';

interface SupplierReturn {
  id: number;
  order_id: number;
  order_number: string | null;
  dropship_order_id: number | null;
  supplier_type: string;
  reason: string;
  status: ReturnStatus;
  refund_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

const STATUS_META: Record<ReturnStatus, { label: string; className: string }> = {
  requested:    { label: 'Requested',     className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  approved:     { label: 'Approved',      className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  shipped_back: { label: 'Shipped back',  className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  refunded:     { label: 'Refunded',      className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  rejected:     { label: 'Rejected',      className: 'bg-red-500/10 text-red-500' },
};

const STATUS_FLOW: ReturnStatus[] = ['requested', 'approved', 'shipped_back', 'refunded'];

export default function SupplierReturnsPage() {
  const [shopId, setShopId] = useState('');
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupplierReturn | null>(null);
  const { fmt } = useCurrency();

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const fetchReturns = useCallback(() => {
    if (!shopId) return;
    setLoading(true);
    dropshipApi.getReturns(shopId, statusFilter || undefined)
      .then((r) => setReturns(r.data?.returns ?? []))
      .catch(() => setReturns([]))
      .finally(() => setLoading(false));
  }, [shopId, statusFilter]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const handleAdvance = async (r: SupplierReturn) => {
    const idx = STATUS_FLOW.indexOf(r.status);
    if (idx === -1 || idx === STATUS_FLOW.length - 1) return;
    try {
      await dropshipApi.updateReturn(shopId, r.id, { status: STATUS_FLOW[idx + 1] });
      fetchReturns();
    } catch {}
  };

  const handleReject = async (r: SupplierReturn) => {
    try {
      await dropshipApi.updateReturn(shopId, r.id, { status: 'rejected' });
      fetchReturns();
    } catch {}
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dropshipApi.deleteReturn(shopId, deleteTarget.id);
      setDeleteTarget(null);
      fetchReturns();
    } catch {}
  };

  const counts: Record<string, number> = {};
  returns.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/dropshipping" className="text-sm text-muted-foreground hover:text-foreground">← Suppliers</Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Supplier Returns</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track a customer return through to a supplier refund.</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
          <Plus className="w-4 h-4" /> Log a return
        </button>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        None of your connected suppliers (CJ, HyperSKU, Printful, AliExpress) expose an automated returns API yet — this is a manual log to track a return through to refund, not a submission sent to the supplier automatically.
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['requested', 'approved', 'shipped_back', 'refunded', 'rejected'] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`border rounded-xl p-3 text-left transition ${statusFilter === s ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'}`}>
            <p className="text-xl font-bold text-foreground">{counts[s] ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{STATUS_META[s].label}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading returns…</span>
        </div>
      ) : returns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Undo2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">No returns logged{statusFilter ? ' with this status' : ''}.</p>
          {!statusFilter && (
            <button onClick={() => setShowModal(true)} className="text-sm text-primary hover:underline mt-2">Log your first return</button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Order</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reason</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Refund</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Logged</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {returns.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/orders/${r.order_id}`} className="text-primary hover:underline font-medium text-xs">
                      {r.order_number ?? `#${r.order_id}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground capitalize">{r.supplier_type}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate" title={r.reason}>{r.reason}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{r.refund_amount != null ? fmt(r.refund_amount, 0) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_META[r.status].className}`}>
                      {STATUS_META[r.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {r.status !== 'refunded' && r.status !== 'rejected' && (
                        <>
                          <button onClick={() => handleAdvance(r)}
                            className="text-xs px-2 py-1 rounded-lg border border-border text-foreground hover:bg-muted transition whitespace-nowrap">
                            Mark {STATUS_META[STATUS_FLOW[STATUS_FLOW.indexOf(r.status) + 1]].label}
                          </button>
                          <button onClick={() => handleReject(r)} className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-500/10 transition">
                            Reject
                          </button>
                        </>
                      )}
                      <button onClick={() => setDeleteTarget(r)} className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <LogReturnModal
          shopId={shopId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchReturns(); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete this return log?</h3>
            <p className="text-sm text-muted-foreground mb-6">This just removes the tracking entry — it doesn&apos;t affect the order itself.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface OrderHit { id: number; order_number: string; customer_name: string | null }

function LogReturnModal({ shopId, onClose, onSaved }: { shopId: string; onClose: () => void; onSaved: () => void }) {
  const [orderQuery, setOrderQuery] = useState('');
  const [orderResults, setOrderResults] = useState<OrderHit[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderHit | null>(null);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [supplierType, setSupplierType] = useState('cj');
  const [reason, setReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!orderQuery.trim() || selectedOrder) { setOrderResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await ordersApi.getAll(shopId, { search: orderQuery.trim(), limit: 8 });
        setOrderResults((res.data ?? []).map((o: any) => ({ id: o.id, order_number: o.order_number, customer_name: o.customer_name })));
        setShowResults(true);
      } catch {} finally { setSearching(false); }
    }, 350);
  }, [orderQuery, shopId, selectedOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) { setError('Search for and select the order this return is for.'); return; }
    if (!reason.trim()) { setError('A reason is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await dropshipApi.createReturn(shopId, {
        order_id: selectedOrder.id,
        supplier_type: supplierType,
        reason: reason.trim(),
        refund_amount: refundAmount ? parseFloat(refundAmount) : undefined,
        notes: notes.trim() || undefined,
      });
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not log this return. Check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-lg font-semibold text-foreground">Log a Return</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="relative">
            <label className="text-sm text-muted-foreground mb-1.5 block">Order</label>
            {selectedOrder ? (
              <div className="flex items-center justify-between px-3 py-2.5 bg-muted border border-border rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedOrder.order_number}</p>
                  {selectedOrder.customer_name && <p className="text-xs text-muted-foreground">{selectedOrder.customer_name}</p>}
                </div>
                <button type="button" onClick={() => { setSelectedOrder(null); setOrderQuery(''); }} className="text-xs text-primary hover:underline">Change</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)}
                    onFocus={() => setShowResults(true)}
                    placeholder="Search by order number…"
                    className="w-full pl-9 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none" />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                {showResults && orderResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                    {orderResults.map((o) => (
                      <button key={o.id} type="button"
                        onClick={() => { setSelectedOrder(o); setShowResults(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-muted transition flex items-center justify-between">
                        <span className="text-sm text-foreground">{o.order_number}</span>
                        {o.customer_name && <span className="text-xs text-muted-foreground">{o.customer_name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Supplier</label>
            <div className="relative">
              <select value={supplierType} onChange={(e) => setSupplierType(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary">
                <option value="cj">CJ Dropshipping</option>
                <option value="hypersku">HyperSKU</option>
                <option value="printful">Printful</option>
                <option value="aliexpress">AliExpress</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={2}
              placeholder="e.g. Wrong size sent, customer wants a refund"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none resize-none" />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Expected refund <span className="opacity-60">(optional)</span></label>
            <input type="number" step="0.01" min="0" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Notes <span className="opacity-60">(optional)</span></label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Any internal notes on how this is being handled"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none resize-none" />
          </div>

          {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg hover:opacity-90 transition font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Log return
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
