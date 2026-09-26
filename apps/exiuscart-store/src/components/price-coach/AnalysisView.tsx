'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Info } from 'lucide-react';
import type { CoachAnalysis } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// Prices come from the US market (eBay), so they are always shown in dollars,
// never converted into the store's own currency.
export const usd = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `${n < 0 ? '-' : ''}$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))}`;

const utc = (iso: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + 'Z');
export function ago(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - utc(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

// "Test candidate", not "winning": a verdict is guidance from real prices, not a promise of sales.
export const VERDICT = {
  TEST: { label: 'Test candidate', box: 'border-green-500/30 bg-green-500/10', chip: 'bg-green-600 text-white' },
  WATCH: { label: 'Watch', box: 'border-amber-500/30 bg-amber-500/10', chip: 'bg-amber-500 text-white' },
  AVOID: { label: 'Low margin', box: 'border-border bg-muted/50', chip: 'bg-muted-foreground text-background' },
} as const;

const CONFIDENCE = { high: 'success', medium: 'default', low: 'muted' } as const;
const MARKET_LABEL: Record<string, string> = { ebay: 'eBay', amazon: 'Amazon', walmart: 'Walmart' };
const DIRECTION: Record<string, { label: string; cls: string }> = {
  rising: { label: 'Rising', cls: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  falling: { label: 'Falling', cls: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  steady: { label: 'Steady', cls: 'bg-muted text-muted-foreground' },
  low_interest: { label: 'Very low interest', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  unknown: { label: 'Not enough data', cls: 'bg-muted text-muted-foreground' },
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(100, ...values), w = 240, h = 56;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full text-primary" preserveAspectRatio="none" role="img" aria-label="Search interest over the last 52 weeks">
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="currentColor" fillOpacity="0.12" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function VerdictBox({ a }: { a: CoachAnalysis }) {
  const v = VERDICT[a.verdict];
  return (
    <div className={`rounded-xl border p-4 ${v.box}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2.5 py-1 text-sm font-bold ${v.chip}`}>{v.label}</span>
          <span className="text-sm font-semibold text-foreground">{a.headline}</span>
        </div>
        <Badge variant={CONFIDENCE[a.confidence]}>Confidence: {a.confidence}</Badge>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {a.reasons_for.length > 0 && (
          <ul className="space-y-1.5 text-sm text-foreground">{a.reasons_for.map((r) => <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />{r}</li>)}</ul>
        )}
        {a.concerns.length > 0 && (
          <ul className="space-y-1.5 text-sm text-foreground">{a.concerns.map((r) => <li key={r} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{r}</li>)}</ul>
        )}
      </div>
    </div>
  );
}

export function AnalysisView({ a }: { a: CoachAnalysis }) {
  const [all, setAll] = useState(false);
  const rows = all ? a.competitors : a.competitors.slice(0, 6);
  return (
    <div className="space-y-6">
      {a.stale && (
        <p className="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> These prices were checked {ago(a.captured_at)} and may have changed. Check again to refresh them.
        </p>
      )}

      {a.demand && (
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Demand <span className="font-normal text-muted-foreground">people searching on Google, not units sold</span></h3>
            <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2.5 py-1 text-sm font-bold ${(DIRECTION[a.demand.direction] ?? DIRECTION.unknown).cls}`}>{(DIRECTION[a.demand.direction] ?? DIRECTION.unknown).label}</span>
                  <span className="text-sm text-foreground">{a.demand.summary}</span>
                </div>
                <Sparkline values={a.demand.sparkline.map((p) => p.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Last 52 weeks. 100 is this search term&apos;s own peak.</p>
              </div>
              {a.demand.countries.length > 0 && (
                <div className="min-w-0">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Searched most in</p>
                  <ul className="space-y-1.5">
                    {a.demand.countries.slice(0, 5).map((c) => (
                      <li key={c.country} className="text-sm">
                        <div className="flex justify-between gap-2"><span className="truncate text-foreground">{c.country}</span><span className="tabular-nums text-muted-foreground">{c.index}</span></div>
                        <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, c.index)}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Source: {a.demand.source}{a.demand.fetched_at ? `, ${ago(a.demand.fetched_at)}` : ''}.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Market prices <span className="font-normal text-muted-foreground">({a.competitor_count} listings)</span></h3>
            {a.price.market ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/60 p-2.5"><p className="text-[11px] text-muted-foreground">Lowest</p><p className="text-sm font-bold text-foreground">{usd(a.price.market.lowest)}</p></div>
                  <div className="rounded-lg bg-primary/10 p-2.5"><p className="text-[11px] text-muted-foreground">Median</p><p className="text-sm font-bold text-primary">{usd(a.price.market.median)}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2.5"><p className="text-[11px] text-muted-foreground">Highest</p><p className="text-sm font-bold text-foreground">{usd(a.price.market.highest)}</p></div>
                </div>
                <p className="mt-3 text-sm text-foreground">Suggested selling range: <strong>{usd(a.price.low)} to {usd(a.price.high)}</strong></p>
              </>
            ) : <p className="text-sm text-muted-foreground">No competitor prices were found for this product.</p>}
            {a.price.floor != null && (
              <p className="mt-1 text-xs text-muted-foreground">Lowest price that still earns a {a.target_margin_pct ?? 30}% margin: {usd(a.price.floor)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">What one sale earns <span className="font-normal text-muted-foreground">at {usd(a.basis_price)}</span></h3>
            <table className="w-full text-sm">
              <tbody>
                {a.economics.lines.map((l) => (
                  <tr key={l.key} className="border-b border-border last:border-0">
                    <td className="py-1 text-foreground">{l.label}</td>
                    <td className={`py-1 text-right tabular-nums ${l.amount < 0 ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>{usd(l.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border">
                  <td className="pt-1.5 font-semibold text-foreground">{a.economics.advertising_included ? 'Profit per order' : 'Profit before ads'}</td>
                  <td className="pt-1.5 text-right font-bold tabular-nums text-foreground">{usd(a.economics.profit)} <span className="text-xs font-medium text-muted-foreground">({a.economics.margin_pct}%)</span></td>
                </tr>
              </tbody>
            </table>
            {a.economics.break_even_roas ? (
              <p className="mt-2 text-xs text-muted-foreground">Ads must return at least <strong>{a.economics.break_even_roas}x</strong> their cost to break even (up to {usd(a.economics.break_even_cac)} per order).</p>
            ) : null}
            {a.economics.assumptions.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground/80">Estimated with standard assumptions: {a.economics.assumptions.map((x) => `${x.label} ${x.value}${x.unit === '%' ? '%' : ' ' + x.unit}`).join(', ')}.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {a.competitors.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-muted/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-2.5">Marketplace</th><th className="px-4 py-2.5">Listing</th><th className="px-4 py-2.5 text-right">Price</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((c, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{MARKET_LABEL[c.marketplace] ?? c.marketplace}</td>
                      <td className="max-w-[420px] px-4 py-2">
                        {c.url
                          ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-foreground hover:text-primary"><span className="truncate">{c.title}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>
                          : <span className="truncate text-foreground">{c.title}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums text-foreground">{usd(c.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {a.competitors.length > 6 && (
              <button type="button" onClick={() => setAll((x) => !x)} className="w-full border-t border-border py-2 text-xs font-semibold text-primary hover:bg-primary/5">
                {all ? 'Show fewer' : `Show all ${a.competitors.length}`}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Checked {a.checked.length ? a.checked.map((c) => `${MARKET_LABEL[c.source] ?? c.source} (${c.count})`).join(', ') : 'no marketplaces'} in the {a.market} market
        {a.captured_at ? `, ${ago(a.captured_at)}` : ''}. {a.not_measured.length ? `Not measured yet: ${a.not_measured.map((n) => n.label.toLowerCase()).join(', ')}.` : ''}
        {' '}This is guidance from real listing prices, not a promise of sales.
      </p>
    </div>
  );
}
