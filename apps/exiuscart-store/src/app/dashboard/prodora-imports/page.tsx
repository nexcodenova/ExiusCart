'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Package, ExternalLink, Pencil, Info } from 'lucide-react';
import { prodoraImportsApi, type ProdoraImportRow } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import SupplierBadge, { supplierKey } from '@/components/dropshipping/SupplierBadge';
import SectionBanner from '@/components/directory/SectionBanner';

// The API sends UTC timestamps without a zone suffix.
const utc = (iso: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + 'Z');
const fmtDate = (iso: string) => utc(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - utc(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function openProdora() {
  // The header owns the plan / TheDersi checks; this just asks it to open Prodora.
  window.dispatchEvent(new CustomEvent('open-prodora'));
}

export default function ProdoraImportsPage() {
  const { fmt } = useCurrency();
  const [shopId, setShopId] = useState('');
  const [rows, setRows] = useState<ProdoraImportRow[]>([]);
  const [usage, setUsage] = useState<{ used: number; limit: number | null; resets_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    prodoraImportsApi.list(shopId)
      .then((r) => { setRows(r.data.imports); setUsage(r.data.usage); })
      .catch(() => setError('Could not load your Prodora imports.'))
      .finally(() => setLoading(false));
  }, [shopId]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.product?.name, r.source?.name, r.source?.code, r.product?.sku].some((v) => v?.toLowerCase().includes(needle)));
  }, [rows, q]);

  const live = rows.filter((r) => !r.removed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/prodora-logo.png" alt="" className="h-6 w-6 rounded-md" /> Prodora imports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Every product you brought into this store from Prodora, with its cost, your price and your margin.</p>
        </div>
        <button type="button" onClick={openProdora}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition hover:opacity-90">
          Browse Prodora <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      {rows.length === 0 && !loading && (
        <SectionBanner
          title="Winning products, ready to sell"
          description="Prodora picks products with real demand, shows trends and competition, and imports them into your store with photos and a price in one click."
          actionLabel="Browse Prodora" onAction={openProdora} variant={0}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Imported in total', value: loading ? '—' : String(rows.length), dot: 'bg-indigo-500' },
          { label: 'Still in your store', value: loading ? '—' : String(live), dot: 'bg-emerald-500' },
          { label: 'Removed since', value: loading ? '—' : String(rows.length - live), dot: 'bg-muted-foreground/50' },
          {
            label: 'Imports this month',
            value: !usage ? '—' : usage.limit === null ? `${usage.used} · unlimited` : `${usage.used} of ${usage.limit}`,
            dot: 'bg-amber-500',
            hint: usage ? `Resets ${fmtDate(usage.resets_at)}` : undefined,
          },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card px-3.5 py-3" title={c.hint}>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{c.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Card className="overflow-hidden rounded-xl shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, Prodora ID or SKU"
                className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30" />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" /> Imports keep your own price and stock; edit them from Products
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted/40 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="py-2.5 pl-4 pr-2.5 text-left">#</th>
                  <th className="px-2.5 py-2.5 text-left">Product</th>
                  <th className="px-2.5 py-2.5 text-left">Prodora ID</th>
                  <th className="px-2.5 py-2.5 text-left">Supplier</th>
                  <th className="px-2.5 py-2.5 text-left">SKU</th>
                  <th className="px-2.5 py-2.5 text-right">Cost</th>
                  <th className="px-2.5 py-2.5 text-right">Selling</th>
                  <th className="px-2.5 py-2.5 text-center">Margin</th>
                  <th className="px-2.5 py-2.5 text-center">Stock</th>
                  <th className="px-2.5 py-2.5 text-left">Status</th>
                  <th className="px-2.5 py-2.5 text-left">Imported</th>
                  <th className="py-2.5 pl-2.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={12} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>)
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/prodora-logo.png" alt="" className="h-7 w-7 rounded-md" />
                      </div>
                      <p className="text-base font-semibold text-foreground">{rows.length === 0 ? 'Nothing imported from Prodora yet' : 'No matches'}</p>
                      <p className="mx-auto mt-1 max-w-sm whitespace-normal text-sm text-muted-foreground">
                        {rows.length === 0
                          ? 'Find winning products on Prodora and import them in one click. They will be listed here.'
                          : 'Try a different name, Prodora ID or SKU.'}
                      </p>
                      {rows.length === 0 && <Button className="mt-5" onClick={openProdora}>Browse Prodora</Button>}
                    </td>
                  </tr>
                ) : shown.map((r, idx) => {
                  const p = r.product;
                  const margin = p && p.cost_price && p.price && p.cost_price > 0 && p.price > 0
                    ? Math.round(((p.price - p.cost_price) / p.price) * 1000) / 10 : null;
                  const image = p?.image_url || r.source?.image_url;
                  const name = p?.name ?? r.source?.name ?? 'Deleted product';
                  return (
                    <tr key={r.id} className={`h-[52px] transition hover:bg-muted/30 ${r.removed ? 'opacity-60' : ''}`}>
                      <td className="py-1.5 pl-4 pr-2.5 text-xs tabular-nums text-muted-foreground">#{idx + 1}</td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                            {image
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={image} alt="" className="h-full w-full object-cover" />
                              : <Package className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <span className="max-w-[200px] truncate text-[13px] font-medium text-foreground" title={name}>{name}</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-xs text-foreground">{r.source?.code ?? '-'}</td>
                      <td className="px-2.5 py-1.5 text-xs">
                        {(() => {
                          const k = r.supplier_type ?? supplierKey(r.source?.supplier_name);
                          return k ? <SupplierBadge supplier={k} /> : <span className="text-muted-foreground">{r.source?.supplier_name ?? '-'}</span>;
                        })()}
                      </td>
                      <td className="px-2.5 py-1.5"><span className="block max-w-[150px] truncate font-mono text-xs text-muted-foreground" title={p?.sku ?? undefined}>{p?.sku ?? '-'}</span></td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{p?.cost_price != null ? fmt(p.cost_price) : '-'}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums text-foreground">{p?.price != null ? fmt(p.price) : '-'}</td>
                      <td className="px-2.5 py-1.5 text-center">
                        {margin !== null ? (
                          <span className={`text-sm tabular-nums ${margin < 20 ? 'font-medium text-red-500' : 'text-foreground'}`}>{margin}%</span>
                        ) : <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                      <td className="px-2.5 py-1.5 text-center tabular-nums text-foreground">{p ? (p.stock >= 999999 ? 'Supplier' : p.stock) : '-'}</td>
                      <td className="px-2.5 py-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground">
                          <span className={`h-1.5 w-1.5 rounded-full ${r.removed ? 'bg-muted-foreground/50' : 'bg-emerald-500'}`} />
                          {r.removed ? 'Removed' : 'In your store'}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-xs">
                        {r.imported_at && (
                          <>
                            <span className="font-medium text-foreground">{fmtDate(r.imported_at)}</span>
                            <span className="ml-1.5 text-muted-foreground/70">· {ago(r.imported_at)}</span>
                          </>
                        )}
                      </td>
                      <td className="py-1.5 pl-2.5 pr-4 text-right">
                        {p ? (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/dashboard/products?edit=${p.id}`}><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                          </Button>
                        ) : <span className="text-xs text-muted-foreground">Deleted</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
