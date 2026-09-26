'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Link2, Loader2, Lock, Scale, Search, Sparkles, TrendingUp } from 'lucide-react';
import { priceCoachApi, type CoachHome, type CoachItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import SupplierBadge from '@/components/dropshipping/SupplierBadge';
import { VERDICT, usd, ago } from '@/components/price-coach/AnalysisView';
import { errText } from '@/components/price-coach/util';

const STATUS: Record<CoachItem['status'], { label: string; variant: 'default' | 'success' | 'muted' | 'outline' }> = {
  importing: { label: 'Importing', variant: 'muted' },
  imported: { label: 'Not checked yet', variant: 'muted' },
  checked: { label: 'Checked', variant: 'default' },
  launched: { label: 'Draft ready', variant: 'success' },
  failed: { label: 'Import failed', variant: 'outline' },
};

const STEPS = [
  { icon: Link2, title: 'Paste a supplier link', text: 'AliExpress or CJ. We bring in the photos, cost and shipping as a private draft.' },
  { icon: Scale, title: 'See the real market price', text: 'We compare what the same product sells for on eBay and work out what you would really earn.' },
  { icon: Sparkles, title: 'Launch with ExiusCart', text: 'Claude writes the title and description, the price is set, and you review it before it goes live.' },
];

export default function PriceCoachPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const [home, setHome] = useState<CoachHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);

  const load = useCallback(() => {
    if (!shopId) return;
    priceCoachApi.home(shopId)
      .then((r) => setHome(r.data))
      .catch((e) => setError(errText(e, 'Could not load Price Coach.')))
      .finally(() => setLoading(false));
  }, [shopId]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || adding) return;
    setAdding(true); setError('');
    try {
      const r = await priceCoachApi.add(shopId, url.trim());
      const it = r.data.item;
      if (it.status === 'failed') { setError(it.error || 'We could not import that product.'); load(); return; }
      setUrl('');
      router.push(`/dashboard/price-coach/${it.id}${it.analysis ? '' : '?run=1'}`);
    } catch (err) {
      setError(errText(err, 'Something went wrong. Try again.'));
    } finally { setAdding(false); }
  };

  const items = home && !home.locked ? home.items : [];
  const shown = q.trim() ? items.filter((i) => (i.product?.name ?? '').toLowerCase().includes(q.trim().toLowerCase())) : items;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Price Coach</h1>
          <p className="text-sm text-muted-foreground">Paste a supplier link. See what the market charges and what you would really earn</p>
        </div>
        {home && !home.locked && (
          <Badge variant="muted" className="py-1.5" title={`Resets ${home.usage.resets_on}`}>
            {home.usage.used} of {home.usage.limit} price checks this month
          </Badge>
        )}
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-48 w-full" /></div>
      ) : home?.locked ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"><Lock className="h-6 w-6 text-primary" /></span>
            <p className="text-lg font-semibold text-foreground">Price Coach is included in Growth and Scale</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Paste any AliExpress or CJ link and see real competitor prices, your true profit per sale and a clear test verdict, then launch it with a title and description written for you.
            </p>
            <div className="mt-2 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.title} className="rounded-xl border border-border bg-muted/30 p-4 text-left">
                  <s.icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
            <Button asChild className="mt-3"><Link href="/dashboard/billing">See plans <ArrowRight className="h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-5">
              <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} disabled={adding} aria-label="Supplier product link"
                    placeholder="Paste an AliExpress or CJ product link" className="pl-9" />
                </div>
                <Button type="submit" disabled={adding || !url.trim()}>
                  {adding ? <><Loader2 className="h-4 w-4 animate-spin" /> Getting product details…</> : <>Check this product <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">One link at a time. Nothing goes live in your store: it stays a private draft until you publish it.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-foreground">Your checked products</p>
                {items.length > 0 && (
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search checked products" className="h-9 pl-9" />
                  </div>
                )}
              </div>
              {items.length === 0 ? (
                <div className="px-4 py-14 text-center">
                  <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"><TrendingUp className="h-6 w-6 text-primary" /></span>
                  <p className="text-base font-semibold text-foreground">Nothing checked yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Paste a supplier link above to see if a product is worth selling.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-sm">
                    <thead className="bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-2.5 pl-4 pr-2.5 text-left">Product</th>
                        <th className="px-2.5 py-2.5 text-left">Supplier</th>
                        <th className="px-2.5 py-2.5 text-left">Verdict</th>
                        <th className="px-2.5 py-2.5 text-right">Margin</th>
                        <th className="px-2.5 py-2.5 text-right">Competitors</th>
                        <th className="px-2.5 py-2.5 text-left">Status</th>
                        <th className="py-2.5 pl-2.5 pr-4 text-right"><span className="sr-only">Open</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shown.map((it) => (
                        <tr key={it.id} className="hover:bg-muted/30">
                          <td className="py-3 pl-4 pr-2.5">
                            <Link href={`/dashboard/price-coach/${it.id}`} className="flex items-center gap-3">
                              {it.product?.image_url
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={it.product.image_url} alt="" className="h-10 w-10 rounded-lg border border-border object-cover" />
                                : <span className="h-10 w-10 rounded-lg bg-muted" />}
                              <span className="min-w-0">
                                <span className="block max-w-[320px] truncate font-medium text-foreground">{it.product?.name ?? it.source_url}</span>
                                <span className="text-xs text-muted-foreground">{ago(it.checked_at ?? it.created_at)}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-2.5 py-3"><SupplierBadge supplier={it.supplier} /></td>
                          <td className="px-2.5 py-3">
                            {it.verdict
                              ? <span className={`rounded px-2 py-0.5 text-xs font-bold ${VERDICT[it.verdict].chip}`}>{VERDICT[it.verdict].label}</span>
                              : <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="px-2.5 py-3 text-right tabular-nums text-foreground">{it.margin_pct != null ? `${it.margin_pct}%` : '-'}</td>
                          <td className="px-2.5 py-3 text-right tabular-nums text-foreground">{it.competitor_count ?? '-'}</td>
                          <td className="px-2.5 py-3"><Badge variant={STATUS[it.status].variant}>{STATUS[it.status].label}{it.status === 'launched' && it.launched_price != null ? ` at ${usd(it.launched_price)}` : ''}</Badge></td>
                          <td className="py-3 pl-2.5 pr-4 text-right">
                            <Button asChild variant="outline" size="sm"><Link href={`/dashboard/price-coach/${it.id}`}>Open</Link></Button>
                          </td>
                        </tr>
                      ))}
                      {shown.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No matches.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
