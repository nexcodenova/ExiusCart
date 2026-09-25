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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Prodora imports</h1>
          <p className="text-sm text-muted-foreground">Every product you brought into this store from Prodora</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {usage && usage.limit !== 0 && (
            <Badge variant="muted" className="py-1.5" title={`Resets ${fmtDate(usage.resets_at)}`}>
              {usage.used} of {usage.limit === null ? 'unlimited' : usage.limit} imports this month
            </Badge>
          )}
          <Button onClick={openProdora}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/prodora-logo.png" alt="" className="h-4 w-4 rounded-[3px]" /> Browse Prodora <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Imported in total', value: rows.length },
          { label: 'Still in your store', value: live },
          { label: 'Removed since', value: rows.length - live },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{loading ? '-' : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, Prodora ID or SKU"
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary" />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" /> Imports keep your own price and stock; edit them from Products
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                  <th className="px-2.5 py-2.5 text-left">Imported</th>
                  <th className="py-2.5 pl-2.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={11} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>)
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center">
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
                          <span className="max-w-[260px] truncate font-medium text-foreground" title={name}>{name}</span>
                          {r.removed && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Removed</Badge>}
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-xs font-bold text-foreground">{r.source?.code ?? '-'}</td>
                      <td className="px-2.5 py-1.5 text-xs text-muted-foreground">{r.source?.supplier_name ?? '-'}</td>
                      <td className="px-2.5 py-1.5"><span className="block max-w-[150px] truncate font-mono text-xs text-muted-foreground" title={p?.sku ?? undefined}>{p?.sku ?? '-'}</span></td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{p?.cost_price != null ? fmt(p.cost_price) : '-'}</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-primary">{p?.price != null ? fmt(p.price) : '-'}</td>
                      <td className="px-2.5 py-1.5 text-center">
                        {margin !== null ? (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${margin < 20 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>{margin}%</span>
                        ) : <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                      <td className="px-2.5 py-1.5 text-center font-medium tabular-nums text-foreground">{p ? (p.stock >= 999999 ? 'Supplier' : p.stock) : '-'}</td>
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
