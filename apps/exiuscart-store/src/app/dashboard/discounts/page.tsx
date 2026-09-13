'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Percent, Plus, Search, Copy, Check, Edit, Trash2, X, Tag, DollarSign, Loader2, RefreshCcw,
} from 'lucide-react';
import { discountsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

type DiscountStatus = 'active' | 'inactive' | 'scheduled' | 'expired' | 'limit_reached';

interface Discount {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  value: number;
  min_order_amount: number | null;
  usage_limit: number | null;
  times_used: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  status: DiscountStatus;
  created_at: string;
}

const STATUS_META: Record<DiscountStatus, { label: string; className: string }> = {
  active:        { label: 'Active',        className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  scheduled:     { label: 'Scheduled',      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  expired:       { label: 'Expired',        className: 'bg-muted text-muted-foreground' },
  limit_reached: { label: 'Limit reached',  className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  inactive:      { label: 'Inactive',       className: 'bg-muted text-muted-foreground' },
};

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DiscountsPage() {
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { fmt, baseSym } = useCurrency();

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchDiscounts = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await discountsApi.getAll(shopId, search || undefined);
      setDiscounts(res.data ?? []);
    } catch {
      setDiscounts([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, search]);

  useEffect(() => { fetchDiscounts(); }, [fetchDiscounts]);

  const handleToggleActive = async (d: Discount) => {
    try {
      await discountsApi.update(shopId, d.id, { is_active: !d.is_active });
      fetchDiscounts();
    } catch {}
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await discountsApi.delete(shopId, deleteTarget.id);
      setDeleteTarget(null);
      fetchDiscounts();
    } catch {}
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {}
  };

  const activeCount = discounts.filter((d) => d.status === 'active').length;
  const totalRedemptions = discounts.reduce((sum, d) => sum + d.times_used, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Discounts</h1>
          <p className="text-sm text-muted-foreground">Create and manage discount codes for your storefront and POS</p>
        </div>
        <button type="button" onClick={() => { setEditing(null); setShowModal(true); }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90">
          <Plus className="h-4 w-4" /> Create discount
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pink-500/10"><Tag className="h-4 w-4 text-pink-600 dark:text-pink-400" /></div>
          <div><p className="text-xs text-muted-foreground">Total codes</p><p className="text-lg font-bold text-foreground tabular-nums">{loading ? '—' : discounts.length}</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10"><Percent className="h-4 w-4 text-green-600 dark:text-green-400" /></div>
          <div><p className="text-xs text-muted-foreground">Currently active</p><p className="text-lg font-bold text-foreground tabular-nums">{loading ? '—' : activeCount}</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10"><RefreshCcw className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
          <div><p className="text-xs text-muted-foreground">Times redeemed</p><p className="text-lg font-bold text-foreground tabular-nums">{loading ? '—' : totalRedemptions}</p></div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" placeholder="Search by code…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 rounded-xl border border-border bg-card py-2.5 pl-11 pr-4 text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/10" />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : discounts.length === 0 ? (
          <div className="p-16 text-center">
            <Tag className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{search ? 'No codes found' : 'No discount codes yet'}</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {search ? 'Try a different search term' : 'Create a code your customers can use at checkout, or your cashier can redeem at POS.'}
            </p>
            {!search && (
              <button type="button" onClick={() => { setEditing(null); setShowModal(true); }}
                className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
                <Plus className="w-4 h-4" /> Create your first discount
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Code</th>
                  <th className="p-3 font-medium">Value</th>
                  <th className="p-3 font-medium hidden md:table-cell">Min. order</th>
                  <th className="p-3 font-medium">Usage</th>
                  <th className="p-3 font-medium hidden lg:table-cell">Active window</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {discounts.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-foreground">{d.code}</span>
                        <button type="button" onClick={() => copyCode(d.code)} className="p-1 rounded hover:bg-muted text-muted-foreground transition">
                          {copiedCode === d.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-foreground font-medium">
                      {d.discount_type === 'percentage' ? `${d.value}% off` : `${fmt(d.value, 0)} off`}
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">{d.min_order_amount != null ? fmt(d.min_order_amount, 0) : '—'}</td>
                    <td className="p-3 tabular-nums text-foreground">{d.times_used}{d.usage_limit != null ? ` / ${d.usage_limit}` : ''}</td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell text-xs">
                      {d.starts_at || d.ends_at ? `${formatDate(d.starts_at)} – ${formatDate(d.ends_at)}` : 'No limit'}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${STATUS_META[d.status].className}`}>
                        {STATUS_META[d.status].label}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => handleToggleActive(d)} title={d.is_active ? 'Deactivate' : 'Activate'}
                          className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                          {d.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button type="button" onClick={() => { setEditing(d); setShowModal(true); }}
                          className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(d)}
                          className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <DiscountModal
          discount={editing}
          baseSym={baseSym}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={async (data) => {
            try {
              if (editing) await discountsApi.update(shopId, editing.id, data);
              else await discountsApi.create(shopId, data);
              fetchDiscounts();
            } catch (e: any) {
              throw e;
            }
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete &ldquo;{deleteTarget.code}&rdquo;?</h3>
            <p className="text-sm text-muted-foreground mb-6">Customers won&apos;t be able to use this code anymore. Orders that already used it are unaffected.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={handleDelete} className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiscountModal({ discount, baseSym, onClose, onSave }: {
  discount: Discount | null;
  baseSym: string;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [code, setCode] = useState(discount?.code ?? randomCode());
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(discount?.discount_type ?? 'percentage');
  const [value, setValue] = useState(discount ? String(discount.value) : '10');
  const [minOrder, setMinOrder] = useState(discount?.min_order_amount != null ? String(discount.min_order_amount) : '');
  const [usageLimit, setUsageLimit] = useState(discount?.usage_limit != null ? String(discount.usage_limit) : '');
  const [endsAt, setEndsAt] = useState(discount?.ends_at ? discount.ends_at.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        code,
        discount_type: discountType,
        value: parseFloat(value) || 0,
        min_order_amount: minOrder ? parseFloat(minOrder) : null,
        usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
        ends_at: endsAt ? new Date(endsAt + 'T23:59:59Z').toISOString() : null,
      });
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not save this discount. Check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{discount ? 'Edit Discount' : 'Create Discount'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Code</label>
            <div className="flex gap-2">
              <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required
                className="flex-1 px-3 py-2.5 bg-muted border border-border rounded-lg font-mono uppercase focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
              <button type="button" onClick={() => setCode(randomCode())}
                className="px-3 py-2.5 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition">
                Generate
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Discount type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDiscountType('percentage')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium border transition ${discountType === 'percentage' ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                <Percent className="w-3.5 h-3.5" /> Percentage
              </button>
              <button type="button" onClick={() => setDiscountType('fixed')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium border transition ${discountType === 'fixed' ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                <DollarSign className="w-3.5 h-3.5" /> Fixed amount
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">
              {discountType === 'percentage' ? 'Percentage off' : `Amount off (${baseSym})`}
            </label>
            <input type="number" step="0.01" min="0" max={discountType === 'percentage' ? 100 : undefined} value={value} onChange={(e) => setValue(e.target.value)} required
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Min. order <span className="opacity-60">(optional)</span></label>
              <input type="number" step="0.01" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="No minimum"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Usage limit <span className="opacity-60">(optional)</span></label>
              <input type="number" min="1" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Expires <span className="opacity-60">(optional)</span></label>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>

          {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg hover:opacity-90 transition font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {discount ? 'Save changes' : 'Create discount'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
