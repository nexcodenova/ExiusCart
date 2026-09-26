'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Lock, Loader2, Scale } from 'lucide-react';
import { shoppingApi, IntelResponse, IntelAnalysis } from '@/lib/api';

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n < 0 ? '−' : ''}$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))}`;

const MARKET_LABEL: Record<string, string> = { ebay: 'eBay', amazon: 'Amazon', walmart: 'Walmart' };

// The wording a seller sees for each verdict. TEST is deliberately "worth
// testing", not "winning": a verdict is guidance from real prices, not a promise
// of sales.
const VERDICT: Record<IntelAnalysis['verdict'], { label: string; box: string; chip: string }> = {
  TEST: { label: 'Test candidate', box: 'border-green-200 bg-green-50 text-green-900', chip: 'bg-green-600 text-white' },
  WATCH: { label: 'Watch', box: 'border-amber-200 bg-amber-50 text-amber-900', chip: 'bg-amber-500 text-white' },
  AVOID: { label: 'Low margin', box: 'border-gray-200 bg-gray-50 text-gray-800', chip: 'bg-gray-500 text-white' },
};
const CONF: Record<string, string> = { high: 'bg-green-100 text-green-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-200 text-gray-700' };

function ago(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + 'Z').getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    // min-w-0 + contain:inline-size stop this section's content (tables, long
    // listing titles) from widening the whole page column on a phone.
    <div className="min-w-0 max-w-full [contain:inline-size] bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
      <h2 className="text-xl font-semibold text-[#111827] mb-4 flex items-center gap-2"><Scale className="w-5 h-5 text-[#2563EB]" /> Competition &amp; Profit</h2>
      {children}
    </div>
  );
}

export default function CompetitionSection({ productId }: { productId: number }) {
  const [data, setData] = useState<IntelResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null); setFailed(false); setAll(false);
    shoppingApi.getIntelligence(productId).then((d) => { if (!cancelled) setData(d); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [productId]);

  if (failed) return null;                       // never break the product page over an optional section
  if (!data) return <Shell><div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" /></div></Shell>;

  if (data.locked) {
    return (
      <Shell>
        <div className="relative overflow-hidden rounded-xl border border-[#E5E7EB]">
          <div aria-hidden className="pointer-events-none select-none space-y-3 p-4 blur-sm opacity-60">
            <div className="h-16 rounded-lg bg-green-100" />
            <div className="grid grid-cols-3 gap-3"><div className="h-14 rounded-lg bg-gray-100" /><div className="h-14 rounded-lg bg-blue-100" /><div className="h-14 rounded-lg bg-gray-100" /></div>
            <div className="h-24 rounded-lg bg-gray-100" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 p-4 text-center">
            <Lock className="w-6 h-6 text-[#2563EB]" />
            <p className="text-sm font-semibold text-[#111827]">Real competitor prices, true profit and a test verdict</p>
            <p className="max-w-sm text-xs text-[#6B7280]">
              {data.available ? 'This product has been analysed. ' : ''}Competition analysis is included with the Growth and Scale plans.
            </p>
            <a href="https://exiuscart.com/pricing" target="_blank" rel="noopener noreferrer"
              className="mt-1 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1E4FC2]">See plans</a>
          </div>
        </div>
      </Shell>
    );
  }

  if (!data.available) {
    return (
      <Shell>
        <p className="text-sm text-[#6B7280]">No competitor analysis for this product yet. We are adding them every day, so check back soon.</p>
      </Shell>
    );
  }

  const a = data.analysis;
  const v = VERDICT[a.verdict];
  const rows = all ? a.competitors : a.competitors.slice(0, 6);

  return (
    <Shell>
      <div className={`rounded-xl border p-4 ${v.box}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`rounded px-2.5 py-1 text-sm font-bold ${v.chip}`}>{v.label}</span>
            <span className="text-sm font-semibold">{a.headline}</span>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CONF[a.confidence]}`}>Confidence: {a.confidence}</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {a.reasons_for.length > 0 && (
            <ul className="space-y-1.5 text-sm">{a.reasons_for.map((r) => <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{r}</li>)}</ul>
          )}
          {a.concerns.length > 0 && (
            <ul className="space-y-1.5 text-sm">{a.concerns.map((r) => <li key={r} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{r}</li>)}</ul>
          )}
        </div>
      </div>

      {a.stale && (
        <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800"><Info className="mt-0.5 h-4 w-4 shrink-0" />
          These prices were checked {ago(a.captured_at)} and may have changed. Treat them as a guide.</p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[#111827]">Market prices ({a.competitor_count} listings)</h3>
          {a.price.market ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-gray-50 p-2.5"><p className="text-[11px] text-[#6B7280]">Lowest</p><p className="text-sm font-bold">{fmt(a.price.market.lowest)}</p></div>
                <div className="rounded-lg bg-blue-50 p-2.5"><p className="text-[11px] text-[#6B7280]">Median</p><p className="text-sm font-bold text-[#2563EB]">{fmt(a.price.market.median)}</p></div>
                <div className="rounded-lg bg-gray-50 p-2.5"><p className="text-[11px] text-[#6B7280]">Highest</p><p className="text-sm font-bold">{fmt(a.price.market.highest)}</p></div>
              </div>
              <p className="mt-3 text-sm text-[#111827]">Suggested selling range: <strong>{fmt(a.price.low)} to {fmt(a.price.high)}</strong></p>
            </>
          ) : <p className="text-sm text-[#6B7280]">No competitor prices were found.</p>}
          {a.price.floor != null && (
            <p className="mt-1 text-xs text-[#6B7280]">Lowest price that still earns a {a.target_margin_pct ?? 30}% margin: {fmt(a.price.floor)}</p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-[#111827]">What one sale earns <span className="font-normal text-[#6B7280]">at {fmt(a.basis_price)}</span></h3>
          <table className="w-full text-sm">
            <tbody>
              {a.economics.lines.map((l) => (
                <tr key={l.key} className="border-b border-gray-100 last:border-0">
                  <td className="py-1 text-[#374151]">{l.label}</td>
                  <td className={`py-1 text-right tabular-nums ${l.amount < 0 ? 'text-[#6B7280]' : 'font-medium text-[#111827]'}`}>{fmt(l.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200">
                <td className="pt-1.5 font-semibold text-[#111827]">{a.economics.advertising_included ? 'Profit per order' : 'Profit before ads'}</td>
                <td className="pt-1.5 text-right font-bold tabular-nums text-[#111827]">{fmt(a.economics.profit)} <span className="text-xs font-medium text-[#6B7280]">({a.economics.margin_pct}%)</span></td>
              </tr>
            </tbody>
          </table>
          {a.economics.break_even_roas ? (
            <p className="mt-2 text-xs text-[#6B7280]">Ads must return at least <strong>{a.economics.break_even_roas}x</strong> their cost to break even (up to {fmt(a.economics.break_even_cac)} per order).</p>
          ) : null}
          {a.economics.assumptions.length > 0 && (
            <p className="mt-2 text-xs text-[#9CA3AF]">Estimated with standard assumptions: {a.economics.assumptions.map((x) => `${x.label} ${x.value}${x.unit === '%' ? '%' : ' ' + x.unit}`).join(', ')}.</p>
          )}
        </div>
      </div>

      {a.competitors.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-[#E5E7EB]">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]"><tr><th className="px-3 py-2">Marketplace</th><th className="px-3 py-2">Listing</th><th className="px-3 py-2 text-right">Price</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-3 py-2 text-[#374151]">{MARKET_LABEL[c.marketplace] ?? c.marketplace}</td>
                  <td className="max-w-[320px] px-3 py-2">
                    {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-[#111827] hover:text-[#2563EB]"><span className="truncate">{c.title}</span><ExternalLink className="h-3 w-3 shrink-0" /></a> : <span className="truncate text-[#111827]">{c.title}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">{fmt(c.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {a.competitors.length > 6 && (
            <button type="button" onClick={() => setAll((x) => !x)} className="w-full border-t border-gray-100 py-2 text-xs font-semibold text-[#2563EB] hover:bg-blue-50">
              {all ? 'Show fewer' : `Show all ${a.competitors.length}`}
            </button>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-[#6B7280]">
        Checked {a.checked.length ? a.checked.map((c) => `${MARKET_LABEL[c.source] ?? c.source} (${c.count})`).join(', ') : 'no marketplaces'} in the {a.market} market
        {a.captured_at ? `, ${ago(a.captured_at)}` : ''}. {a.not_measured.length ? `Not measured yet: ${a.not_measured.map((n) => n.label.toLowerCase()).join(', ')}.` : ''}
        {' '}This is guidance from real listing prices, not a promise of sales.
      </p>
    </Shell>
  );
}
