'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Loader2, RefreshCw, Rocket, Sparkles, Trash2 } from 'lucide-react';
import { priceCoachApi, type CoachDetail } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import SupplierBadge from '@/components/dropshipping/SupplierBadge';
import { AnalysisView, VerdictBox, usd, ago } from '@/components/price-coach/AnalysisView';
import { errText, errCode } from '@/components/price-coach/util';

export default function PriceCoachItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const confirm = useConfirm();
  const [shopId, setShopId] = useState('');
  const [d, setD] = useState<CoachDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'check' | 'launch' | 'discard' | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [margin, setMargin] = useState('30');
  const [price, setPrice] = useState('');
  const started = useRef(false);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);

  const apply = useCallback((next: CoachDetail) => {
    setD(next);
    if (next.analysis?.target_margin_pct) setMargin(String(next.analysis.target_margin_pct));
    setPrice((cur) => cur || (next.launched_price ?? next.analysis?.price.low ?? next.analysis?.basis_price ?? '').toString());
  }, []);

  const check = useCallback(async (targetMargin: number) => {
    setBusy('check'); setError(''); setNote('');
    try {
      const r = await priceCoachApi.check(shopId, id, targetMargin);
      apply(r.data);
      setPrice(r.data.launched_price?.toString() ?? r.data.analysis?.price.low?.toString() ?? '');
      if (r.data.charged) setNote('New prices were fetched. This used 1 of your checks for the month.');
    } catch (e) {
      setError(errText(e, 'The price check did not work. Try again in a moment.'));
      if (errCode(e) === 'limit_reached') priceCoachApi.get(shopId, id).then((r) => apply(r.data)).catch(() => {});
    } finally { setBusy(null); }
  }, [shopId, id, apply]);

  useEffect(() => {
    if (!shopId) return;
    priceCoachApi.get(shopId, id)
      .then((r) => {
        apply(r.data);
        // A link just pasted gets its check straight away.
        if (!started.current && search.get('run') === '1' && !r.data.analysis && r.data.status !== 'failed') { started.current = true; check(30); }
      })
      .catch((e) => setError(errText(e, 'Could not open that product.')))
      .finally(() => setLoading(false));
  }, [shopId, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const launch = async () => {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) { setError('Enter the price you want to sell it at.'); return; }
    setBusy('launch'); setError('');
    try { apply((await priceCoachApi.launch(shopId, id, p)).data); }
    catch (e) { setError(errText(e, 'Could not launch that product.')); }
    finally { setBusy(null); }
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Remove this product?',
      description: d?.status === 'launched' ? 'It leaves this list. The product stays in your store so you can keep editing it.' : 'This deletes the private draft. Your price check history for it is removed too.',
      confirmText: 'Remove', variant: 'destructive',
    });
    if (!ok) return;
    setBusy('discard');
    try { await priceCoachApi.discard(shopId, id); router.push('/dashboard/price-coach'); }
    catch (e) { setError(errText(e, 'Could not remove it.')); setBusy(null); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const p = d?.product;
  const a = d?.analysis;
  const landed = p && p.cost != null ? p.cost + (p.shipping ?? 0) : null;
  const launched = d?.status === 'launched';
  const priceNum = Number(price);
  const belowFloor = !!(a?.price.floor && Number.isFinite(priceNum) && priceNum > 0 && priceNum < a.price.floor);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/price-coach" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Price Coach</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{p?.name ?? 'Product'}</h1>
          {launched && <Badge variant="success">Draft ready</Badge>}
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {note && <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{note}</div>}

      {d && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              {p?.image_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p.image_url} alt="" className="h-24 w-24 shrink-0 rounded-xl border border-border object-cover" />
                : <span className="h-24 w-24 shrink-0 rounded-xl bg-muted" />}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <SupplierBadge supplier={d.supplier} />
                  <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">View supplier page <ExternalLink className="h-3 w-3" /></a>
                </div>
                {p?.original_name && p.original_name !== p.name && <p className="text-xs text-muted-foreground">Supplier title: {p.original_name}</p>}
                <dl className="grid grid-cols-3 gap-3 text-sm sm:max-w-md">
                  <div><dt className="text-xs text-muted-foreground">Supplier cost</dt><dd className="font-semibold tabular-nums text-foreground">{usd(p?.cost)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Shipping</dt><dd className="font-semibold tabular-nums text-foreground">{p?.shipping != null ? usd(p.shipping) : 'Not known'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">You pay per order</dt><dd className="font-semibold tabular-nums text-foreground">{usd(landed)}</dd></div>
                </dl>
              </div>
            </CardContent>
          </Card>

          {d.status === 'failed' && (
            <Card><CardContent className="space-y-2 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-amber-600" /> We could not import this product</p>
              <p className="text-sm text-muted-foreground">{d.error}</p>
              <Button asChild variant="outline" size="sm"><Link href="/dashboard/price-coach">Paste the link again</Link></Button>
            </CardContent></Card>
          )}

          {busy === 'check' && !a && (
            <Card><CardContent className="flex items-center gap-3 p-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Checking real prices and working out your profit…</p>
                <p className="text-xs text-muted-foreground">This takes about 10 to 20 seconds.</p>
              </div>
            </CardContent></Card>
          )}

          {!a && !busy && d.status !== 'failed' && (
            <Card><CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Not checked yet</p>
                <p className="text-xs text-muted-foreground">You have {d.usage.remaining} of {d.usage.limit} price checks left this month.</p>
              </div>
              <Button onClick={() => check(30)}>Check the price <Sparkles className="h-4 w-4" /></Button>
            </CardContent></Card>
          )}

          {a && (
            <>
              <VerdictBox a={a} />

              <Card>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-end gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="margin">Margin you want to earn</Label>
                      <div className="relative w-32">
                        <Input id="margin" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} className="pr-7" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => check(Number(margin) || 30)} disabled={busy !== null}>
                      {busy === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Update
                    </Button>
                  </div>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Prices checked {ago(a.captured_at)}. Updating within 24 hours is free. A check uses 1 of your monthly checks only when new prices are fetched ({d.usage.remaining} of {d.usage.limit} left).
                  </p>
                </CardContent>
              </Card>

              <AnalysisView a={a} />

              <Card className="border-primary/30">
                <CardContent className="space-y-4 p-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Rocket className="h-5 w-5 text-primary" /> Launch with ExiusCart</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Claude writes a store-ready title and description, your price is set, and the product is saved as a draft. Nothing goes live until you publish it.
                    </p>
                  </div>

                  {launched && !d.launch && p ? (
                    <div className="space-y-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-green-600" /> Draft ready{d.launched_price != null ? ` at ${usd(d.launched_price)}` : ''}</p>
                      <p className="text-sm text-muted-foreground">{p.is_active ? 'This product is live in your store.' : 'It is still a hidden draft. Read the listing, then publish it from Products.'}</p>
                      <Button asChild><Link href={`/dashboard/products?edit=${p.id}`}>Open in Products <ExternalLink className="h-4 w-4" /></Link></Button>
                    </div>
                  ) : launched && d.launch ? (
                    <div className="space-y-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-green-600" /> Draft ready at {usd(d.launch.price)}</p>
                      <p className="text-sm text-muted-foreground">
                        {d.launch.ai_written ? 'Claude wrote the title and description. Read them before you publish.' : 'Claude could not write the listing just now, so the supplier text was kept. You can edit it in the product.'}
                      </p>
                      {d.launch.below_target && <p className="flex gap-2 text-sm text-amber-700 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> This price is under your target margin.</p>}
                      {!d.launch.supplier_connected && (
                        <p className="text-sm text-muted-foreground">To send orders to the supplier automatically, connect your {d.supplier === 'cj' ? 'CJ Dropshipping' : 'AliExpress'} account. <Link href="/dashboard/dropshipping" className="font-medium text-primary hover:underline">Connect it</Link></p>
                      )}
                      <Button asChild><Link href={`/dashboard/products?edit=${d.launch.product_id}`}>Review and publish <ExternalLink className="h-4 w-4" /></Link></Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                      <div className="space-y-1.5">
                        <Label htmlFor="price">Your selling price (USD)</Label>
                        <div className="relative w-40">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                          <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="pl-7" />
                        </div>
                      </div>
                      <Button onClick={launch} disabled={busy !== null || !price}>
                        {busy === 'launch' ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing your listing…</> : <>Launch with ExiusCart <Rocket className="h-4 w-4" /></>}
                      </Button>
                    </div>
                  )}
                  {!launched && belowFloor && a?.price.floor != null && (
                    <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {usd(priceNum)} is under {usd(a.price.floor)}, the lowest price that still earns your {a.target_margin_pct ?? 30}% margin.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          <div>
            <Button variant="destructive" size="sm" onClick={discard} disabled={busy !== null}><Trash2 className="h-4 w-4" /> Remove from Price Coach</Button>
          </div>
        </>
      )}
    </div>
  );
}
