'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookmarkCheck, Plus, Clock, Lock, CheckCircle2, XCircle, AlertTriangle,
  X, Edit, Trash2, ArrowRight, Search, Package,
} from 'lucide-react';
import { reservationsApi, productsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface Reservation {
  id: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  product_id?: number;
  product_name: string;
  quantity: number;
  reservation_type: 'soft_hold' | 'confirmed';
  status: 'active' | 'expired' | 'fulfilled' | 'cancelled';
  notes?: string;
  expires_at?: string;
  lpo_number?: string;
  advance_amount?: number;
  created_at?: string;
}

interface Summary {
  total_active: number;
  soft_holds: number;
  confirmed: number;
  expiring_today: number;
  soft_hold_qty: number;
  confirmed_qty: number;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  expired: { label: 'Expired', cls: 'bg-red-500/10 text-red-500' },
  fulfilled: { label: 'Fulfilled', cls: 'bg-blue-500/10 text-blue-500' },
  cancelled: { label: 'Cancelled', cls: 'bg-muted text-muted-foreground' },
};

const TYPE_META: Record<string, { label: string; icon: React.ElementType; cls: string; border: string }> = {
  soft_hold: {
    label: 'Soft Hold',
    icon: Clock,
    cls: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    border: 'border-l-yellow-400',
  },
  confirmed: {
    label: 'Confirmed',
    icon: Lock,
    cls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    border: 'border-l-indigo-500',
  },
};

function hoursLeft(expires_at?: string): string {
  if (!expires_at) return '';
  const diff = new Date(expires_at).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.ceil(diff / 3600000);
  if (h < 24) return `${h}h left`;
  return `${Math.ceil(h / 24)}d left`;
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'fulfilled' | 'cancelled'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { sym } = useCurrency();

  const fetchAll = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [rRes, sRes] = await Promise.all([
        reservationsApi.getAll(shopId),
        reservationsApi.getSummary(shopId),
      ]);
      setReservations(rRes.data ?? []);
      setSummary(sRes.data ?? null);
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id: number) => {
    try { await reservationsApi.delete(shopId, id); } catch {}
    setConfirmDelete(null);
    fetchAll();
  };

  const handleConfirmUpgrade = async (r: Reservation) => {
    try {
      await reservationsApi.update(shopId, r.id, { reservation_type: 'confirmed' });
      fetchAll();
    } catch {}
  };

  const handleFulfill = async (r: Reservation) => {
    try {
      await reservationsApi.update(shopId, r.id, { status: 'fulfilled' });
      fetchAll();
    } catch {}
  };

  const handleCancel = async (r: Reservation) => {
    try {
      await reservationsApi.update(shopId, r.id, { status: 'cancelled' });
      fetchAll();
    } catch {}
  };

  const filtered = reservations.filter((r) => {
    const matchSearch =
      r.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.lpo_number ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reservations</h1>
          <p className="text-sm text-muted-foreground">Track soft holds and confirmed stock reservations in real time</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingReservation(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> New Reservation
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active reservations', icon: BookmarkCheck, value: loading ? '—' : String(summary?.total_active ?? 0), color: '' },
          { label: 'Soft holds (2-day)', icon: Clock, value: loading ? '—' : String(summary?.soft_holds ?? 0), sub: loading ? '' : `${summary?.soft_hold_qty ?? 0} units`, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Confirmed', icon: Lock, value: loading ? '—' : String(summary?.confirmed ?? 0), sub: loading ? '' : `${summary?.confirmed_qty ?? 0} units`, color: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Expiring today', icon: AlertTriangle, value: loading ? '—' : String(summary?.expiring_today ?? 0), color: (summary?.expiring_today ?? 0) > 0 ? 'text-red-500' : '' },
        ].map(({ label, icon: Icon, value, sub, color }) => (
          <div key={label} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Icon className="h-5 w-5 text-foreground/70" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums ${color || 'text-foreground'}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-medium">
          <Clock className="w-3.5 h-3.5" /> Soft Hold — auto-releases after 2 days if not confirmed
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium">
          <Lock className="w-3.5 h-3.5" /> Confirmed — locked via advance payment or LPO
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer, product, or LPO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-card border border-border rounded-xl focus:ring-2 focus:ring-foreground/10 outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1.5 rounded-lg border border-border bg-muted/40 p-0.5">
          {(['all', 'active', 'expired', 'fulfilled', 'cancelled'] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${statusFilter === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <BookmarkCheck className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="font-semibold text-foreground mb-1">
              {searchQuery || statusFilter !== 'all' ? 'No reservations found' : 'No reservations yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Create a soft hold or confirmed reservation to track stock in real time'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button type="button" onClick={() => { setEditingReservation(null); setShowModal(true); }}
                className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
                <Plus className="w-4 h-4" /> New Reservation
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => {
              const typeMeta = TYPE_META[r.reservation_type];
              const statusMeta = STATUS_META[r.status] ?? STATUS_META.active;
              const TypeIcon = typeMeta.icon;
              const timeLeft = r.reservation_type === 'soft_hold' && r.status === 'active' ? hoursLeft(r.expires_at) : '';
              return (
                <div key={r.id} className={`p-4 hover:bg-muted/30 transition border-l-4 ${typeMeta.border}`}>
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${typeMeta.cls}`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{r.customer_name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeMeta.cls}`}>{typeMeta.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.cls}`}>{statusMeta.label}</span>
                        {timeLeft && (
                          <span className={`text-xs font-medium ${timeLeft === 'Expired' || timeLeft.startsWith('0h') ? 'text-red-500' : 'text-muted-foreground'}`}>
                            · {timeLeft}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{r.quantity}x</span> {r.product_name}
                        {r.customer_phone && <span className="ml-3">{r.customer_phone}</span>}
                      </p>
                      <div className="flex flex-wrap gap-x-4 mt-1">
                        {r.lpo_number && (
                          <span className="text-xs text-muted-foreground">LPO: <span className="font-medium text-foreground">{r.lpo_number}</span></span>
                        )}
                        {r.advance_amount != null && (
                          <span className="text-xs text-muted-foreground">Advance: <span className="font-medium text-foreground">{r.advance_amount.toLocaleString()} {sym}</span></span>
                        )}
                        {r.notes && <span className="text-xs text-muted-foreground italic">{r.notes}</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.status === 'active' && r.reservation_type === 'soft_hold' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmUpgrade(r)}
                          title="Upgrade to confirmed reservation"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition text-xs font-medium"
                        >
                          <ArrowRight className="w-3.5 h-3.5" /> Confirm
                        </button>
                      )}
                      {r.status === 'active' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleFulfill(r)}
                            title="Mark as fulfilled"
                            className="p-2 hover:bg-green-500/10 rounded-lg text-muted-foreground hover:text-green-600 transition"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingReservation(r); setShowModal(true); }}
                            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(r)}
                            title="Cancel reservation"
                            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(r.id)}
                        className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <ReservationModal
          shopId={shopId}
          reservation={editingReservation}
          onClose={() => { setShowModal(false); setEditingReservation(null); }}
          onSaved={() => { setShowModal(false); setEditingReservation(null); fetchAll(); }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete != null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete reservation?</h3>
            <p className="text-sm text-muted-foreground mb-6">This will permanently remove the reservation record.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

function ReservationModal({ shopId, reservation, onClose, onSaved }: {
  shopId: string;
  reservation: Reservation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [products, setProducts] = useState<{ id: number; name: string; stock: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: reservation?.customer_name ?? '',
    customer_phone: reservation?.customer_phone ?? '',
    customer_email: reservation?.customer_email ?? '',
    product_id: reservation?.product_id ? String(reservation.product_id) : '',
    product_name: reservation?.product_name ?? '',
    quantity: reservation?.quantity ?? 1,
    reservation_type: reservation?.reservation_type ?? 'soft_hold',
    notes: reservation?.notes ?? '',
    lpo_number: reservation?.lpo_number ?? '',
    advance_amount: reservation?.advance_amount ? String(reservation.advance_amount) : '',
  });

  useEffect(() => {
    if (!shopId) return;
    productsApi.getAll(shopId).then((r) => {
      setProducts((r.data ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        stock: p.quantity ?? p.stock ?? 0,
      })));
    }).catch(() => {});
  }, [shopId]);

  const handleProductSelect = (productId: string) => {
    const p = products.find(p => String(p.id) === productId);
    setForm(f => ({ ...f, product_id: productId, product_name: p?.name ?? '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        customer_email: form.customer_email || null,
        product_id: form.product_id ? Number(form.product_id) : null,
        product_name: form.product_name || 'N/A',
        quantity: Number(form.quantity),
        reservation_type: form.reservation_type,
        notes: form.notes || null,
        lpo_number: form.reservation_type === 'confirmed' ? (form.lpo_number || null) : null,
        advance_amount: form.reservation_type === 'confirmed' && form.advance_amount ? Number(form.advance_amount) : null,
      };
      if (reservation) {
        await reservationsApi.update(shopId, reservation.id, payload);
      } else {
        await reservationsApi.create(shopId, payload);
      }
      onSaved();
    } catch {
      setSaving(false);
    }
  };

  const isConfirmed = form.reservation_type === 'confirmed';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {reservation ? 'Edit Reservation' : 'New Reservation'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Reservation type *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, reservation_type: 'soft_hold' }))}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition ${form.reservation_type === 'soft_hold' ? 'border-yellow-400 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400' : 'border-border text-muted-foreground hover:border-foreground/20'}`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">Soft Hold</p>
                  <p className="text-xs opacity-70 font-normal">Auto-expires in 2 days</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, reservation_type: 'confirmed' }))}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition ${form.reservation_type === 'confirmed' ? 'border-indigo-500 bg-indigo-500/5 text-indigo-700 dark:text-indigo-400' : 'border-border text-muted-foreground hover:border-foreground/20'}`}
              >
                <Lock className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">Confirmed</p>
                  <p className="text-xs opacity-70 font-normal">Locked via LPO / advance</p>
                </div>
              </button>
            </div>
          </div>

          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Customer name *</label>
              <input type="text" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} required placeholder="e.g. Al Noor Trading"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Phone</label>
              <input type="tel" value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="+971 50 000 0000"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
            </div>
          </div>

          {/* Product */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Product</label>
              <select value={form.product_id} onChange={e => handleProductSelect(e.target.value)}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground">
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={String(p.id)}>{p.name} (stock: {p.stock})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Product name *</label>
              <input type="text" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} required placeholder="or type manually"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Quantity *</label>
            <input type="number" value={form.quantity} min={1} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} required
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>

          {/* Confirmed fields */}
          {isConfirmed && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">LPO number</label>
                <input type="text" value={form.lpo_number} onChange={e => setForm(f => ({ ...f, lpo_number: e.target.value }))} placeholder="LPO-2026-001"
                  className="w-full px-3 py-2.5 bg-card border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Advance received</label>
                <input type="number" value={form.advance_amount} min={0} onChange={e => setForm(f => ({ ...f, advance_amount: e.target.value }))} placeholder="0.00"
                  className="w-full px-3 py-2.5 bg-card border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="e.g. Customer will confirm by Thursday..."
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : reservation ? 'Update' : 'Create reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
