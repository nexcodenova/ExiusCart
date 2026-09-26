'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Loader2, Search, CheckCircle2, AlertTriangle, ExternalLink, Info, RefreshCw, PlugZap, CircleDashed,
} from 'lucide-react';
import { adminApi, intelApi } from '@/lib/api';
import { useAdminAccess } from '@/components/access-provider';

interface CatalogProduct { id: number; code?: string | null; name: string; price?: number; cost_price?: number | null; kind?: string; supplier_label?: string }
interface Source { source: string; paid: boolean; configured: boolean; hint: string | null }
interface Status { ai_configured: boolean; sources: Source[]; paid_usage: { today: number; month: number; daily_limit: number; monthly_limit: number } }
interface Listing { marketplace: string; title: string; price: number; url?: string | null; match_score?: number | null; match_reason?: string | null; rating?: number | null; review_count?: number | null }
interface EconLine { key: string; label: string; amount: number; kind: string }
interface Result {
  product_id: number; cached: boolean; analysed_at?: string;
  snapshot: {
    captured_at: string; used_paid: boolean; fingerprint: { product_type: string; search_queries: string[]; method: string; attributes: Record<string, string> };
    sources: { source: string; status: string; count: number; note: string | null; paid: boolean }[];
    candidates: number; match_method: string; rejected: number; outliers_dropped: number; listings: Listing[];
  };
  evaluation: {
    verdict: 'TEST' | 'WATCH' | 'AVOID'; headline: string; confidence: 'high' | 'medium' | 'low'; reasons_for: string[]; concerns: string[];
    economics: { lines: EconLine[]; contribution_profit: number; contribution_margin_pct: number; profit_before_ads: number; margin_before_ads_pct: number; break_even_cac: number; break_even_roas: number | null; assumptions: { key: string; label: string; value: number; unit: string }[]; advertising_included: boolean };
    price_range: { floor: number | null; low: number | null; high: number | null; note: string; market: { lowest: number; median: number; highest: number } | null; competitors_used: number };
    basis_price: number; target_margin_pct: number; competitor_count: number; not_measured: { key: string; label: string; why: string }[];
  };
}

const utc = (iso: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + 'Z');
const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`);
const ago = (iso?: string) => {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - utc(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
const errText = (e: any, fb: string) => (typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : fb);

const VERDICT_STYLE = {
  TEST: 'border-green-200 bg-green-50 text-green-800',
  WATCH: 'border-amber-200 bg-amber-50 text-amber-800',
  AVOID: 'border-red-200 bg-red-50 text-red-800',
};
const CONF_STYLE = { high: 'bg-green-100 text-green-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-200 text-gray-700' };
const SOURCE_LABEL: Record<string, string> = { ebay: 'eBay', amazon: 'Amazon', walmart: 'Walmart' };
const STATUS_TEXT: Record<string, string> = {
  ok: 'Answered', not_configured: 'Not connected', error: 'Error', skipped_budget: 'Paid limit reached', skipped_unpaid: 'Not requested', unsupported_market: 'Market not supported',
};

export default function IntelligencePage() {
  const { can, isOwner } = useAdminAccess();
  const canAnalyze = can('prodora.analyze');
  const [status, setStatus] = useState<Status | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [margin, setMargin] = useState('30');
  const [ad, setAd] = useState('');
  const [usePaid, setUsePaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});

  const loadStatus = useCallback(() => intelApi.status().then((r) => setStatus(r.data)).catch(() => {}), []);

  // /dashboard/intelligence?product=ID opens that product straight away (used by the Intake queue).
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('product'));
    if (!id) return;
    intelApi.latest(id).then((r) => {
      if (r.data.product) setSelected({ id: r.data.product.id, code: r.data.product.code, name: r.data.product.name, cost_price: r.data.product.cost_price });
      if (r.data.result) setResult(r.data.result);
    }).catch(() => {});
  }, []);
  useEffect(() => { loadStatus(); adminApi.getProdoraCatalog().then((r) => setProducts((r.data as CatalogProduct[]).filter((p) => p.kind !== 'digital'))).catch(() => {}); }, [loadStatus]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q)).slice(0, 8);
  }, [products, query]);

  const pick = async (p: CatalogProduct) => {
    setSelected(p); setQuery(''); setError(''); setResult(null);
    try { const r = await intelApi.latest(p.id); if (r.data.result) setResult(r.data.result); } catch { /* none yet */ }
  };

  const run = async (force: boolean) => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const r = await intelApi.analyze({ product_id: selected.id, target_margin_pct: Number(margin) || 30, ad_cost_per_order: ad.trim() === '' ? null : Number(ad), use_paid: usePaid, force });
      setResult(r.data);
      if (r.data.paid_usage) setStatus((s) => (s ? { ...s, paid_usage: r.data.paid_usage } : s));
    } catch (e: any) { setError(errText(e, 'The analysis could not run.')); } finally { setBusy(false); }
  };

  const testSource = async (source: string) => {
    setTesting(source);
    try {
      const r = await intelApi.testSource(source);
      setTestMsg((m) => ({ ...m, [source]: `${r.data.ok ? 'Working' : 'Not working'}: ${r.data.detail}` }));
      loadStatus();
    } catch (e: any) { setTestMsg((m) => ({ ...m, [source]: errText(e, 'Could not test.') })); } finally { setTesting(null); }
  };

  const ev = result?.evaluation;
  const snap = result?.snapshot;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Sparkles className="h-6 w-6 text-[#6B3FD9]" /> Product Intelligence</h1>
        <p className="mt-1 text-sm text-gray-500">Pick a product. Prodora finds real competitor prices, works out the true profit, and gives a verdict with the evidence behind it. Anything it could not measure is said plainly.</p>
      </div>

      {status && (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI</p>
            <p className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${status.ai_configured ? 'text-green-700' : 'text-amber-700'}`}>
              {status.ai_configured ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}{status.ai_configured ? 'Connected' : 'Not connected: simpler matching'}
            </p>
          </div>
          {status.sources.map((s) => (
            <div key={s.source} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{SOURCE_LABEL[s.source] ?? s.source}{s.paid ? ' · paid' : ' · free'}</p>
              <p className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${s.configured ? 'text-green-700' : 'text-amber-700'}`}>
                {s.configured ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}{s.configured ? 'Connected' : 'Not connected'}
              </p>
              {!s.configured && s.hint && <p className="mt-1 text-xs text-gray-500">{s.hint}</p>}
              {s.configured && isOwner && (
                <button type="button" onClick={() => testSource(s.source)} disabled={testing === s.source} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#6B3FD9] hover:underline disabled:opacity-60">
                  {testing === s.source ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlugZap className="h-3 w-3" />} Test connection
                </button>
              )}
              {testMsg[s.source] && <p className="mt-1 text-xs text-gray-600">{testMsg[s.source]}</p>}
            </div>
          ))}
        </div>
      )}
      {status && (
        <p className="text-xs text-gray-500">
          Paid lookups used: <strong>{status.paid_usage.today}</strong> of {status.paid_usage.daily_limit} today, <strong>{status.paid_usage.month}</strong> of {status.paid_usage.monthly_limit} this month.
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <label htmlFor="pick" className="mb-1 block text-sm font-medium text-gray-700">Product</label>
        {selected ? (
          <div className="flex items-center justify-between rounded-lg border border-[#6B3FD9]/30 bg-[#6B3FD9]/5 px-3 py-2">
            <span className="text-sm font-medium text-gray-900">{selected.code ? `${selected.code} · ` : ''}{selected.name}</span>
            <button type="button" onClick={() => { setSelected(null); setResult(null); }} className="text-xs font-medium text-[#6B3FD9] hover:underline">Change</button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input id="pick" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the Prodora catalogue by name or ID" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[#6B3FD9] focus:outline-none focus:ring-2 focus:ring-[#6B3FD9]/20" />
            {query && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {shown.length === 0 ? <p className="px-3 py-2 text-sm text-gray-500">No products found.</p> : shown.map((p) => (
                  <button key={p.id} type="button" onClick={() => pick(p)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50">
                    <span className="truncate">{p.code ? `${p.code} · ` : ''}{p.name}</span>
                    <span className="shrink-0 text-xs text-gray-500">{p.cost_price != null ? `cost ${money(p.cost_price)}` : 'no cost yet'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="margin" className="mb-1 block text-sm font-medium text-gray-700">Target margin (%)</label>
            <input id="margin" type="number" min={5} max={80} value={margin} onChange={(e) => setMargin(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#6B3FD9] focus:outline-none" />
          </div>
          <div>
            <label htmlFor="ad" className="mb-1 block text-sm font-medium text-gray-700">Ad cost per order ($) <span className="font-normal text-gray-400">optional</span></label>
            <input id="ad" type="number" min={0} value={ad} onChange={(e) => setAd(e.target.value)} placeholder="not known yet" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#6B3FD9] focus:outline-none" />
          </div>
          <label className="flex cursor-pointer items-start gap-2 pt-6 text-sm text-gray-700">
            <input type="checkbox" checked={usePaid} onChange={(e) => setUsePaid(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#6B3FD9]" />
            <span>Also check Amazon and Walmart<span className="block text-xs text-gray-500">Uses paid lookups from your monthly limit</span></span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => run(false)} disabled={!selected || busy || !canAnalyze}
            title={!canAnalyze ? 'Your role cannot run analyses' : undefined}
            className="inline-flex items-center gap-2 rounded-lg bg-[#6B3FD9] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5A2EC9] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {result ? 'Update analysis' : 'Analyze product'}
          </button>
          {result && canAnalyze && (
            <button type="button" onClick={() => run(true)} disabled={busy} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[#6B3FD9] disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> Fetch fresh market data
            </button>
          )}
          {result && <span className="text-xs text-gray-500">Market data from {ago(snap?.captured_at)}{result.cached ? ' (saved for 24 hours, so changing targets costs nothing)' : ''}</span>}
        </div>
        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      {ev && snap && (
        <div className="space-y-6">
          <div className={`rounded-xl border p-5 ${VERDICT_STYLE[ev.verdict]}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Verdict</p>
                <p className="text-2xl font-bold">{ev.verdict} <span className="text-lg font-semibold">· {ev.headline}</span></p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CONF_STYLE[ev.confidence]}`}>Confidence: {ev.confidence}</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide opacity-70">Why it could work</p>
                {ev.reasons_for.length ? <ul className="space-y-1.5 text-sm">{ev.reasons_for.map((r) => <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{r}</li>)}</ul> : <p className="text-sm opacity-80">Nothing yet.</p>}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide opacity-70">Concerns</p>
                {ev.concerns.length ? <ul className="space-y-1.5 text-sm">{ev.concerns.map((r) => <li key={r} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{r}</li>)}</ul> : <p className="text-sm opacity-80">None found.</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-base font-semibold text-gray-900">What one sale really earns <span className="text-sm font-normal text-gray-500">at {money(ev.basis_price)}</span></h2>
              <table className="w-full text-sm">
                <tbody>
                  {ev.economics.lines.map((l) => (
                    <tr key={l.key} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 text-gray-700">{l.label}</td>
                      <td className={`py-1.5 text-right tabular-nums ${l.amount < 0 ? 'text-gray-600' : 'font-medium text-gray-900'}`}>{money(l.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200"><td className="pt-2 font-semibold text-gray-900">{ev.economics.advertising_included ? 'Profit per order' : 'Profit before ads'}</td>
                    <td className="pt-2 text-right text-base font-bold tabular-nums text-gray-900">{money(ev.economics.contribution_profit)} <span className="text-xs font-medium text-gray-500">({ev.economics.contribution_margin_pct}%)</span></td></tr>
                </tbody>
              </table>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Most you can pay to win an order</p><p className="font-semibold text-gray-900">{money(ev.economics.break_even_cac)}</p></div>
                <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Break-even return on ad spend</p><p className="font-semibold text-gray-900">{ev.economics.break_even_roas ? `${ev.economics.break_even_roas}x` : '—'}</p></div>
              </div>
              {ev.economics.assumptions.length > 0 && (
                <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800"><Info className="mt-0.5 h-4 w-4 shrink-0" />
                  Estimated with our default assumptions: {ev.economics.assumptions.map((a) => `${a.label} ${a.value}${a.unit === '%' ? '%' : ' ' + a.unit}`).join(', ')}. Real figures make this more reliable.</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-base font-semibold text-gray-900">Price</h2>
              {ev.price_range.market ? (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Lowest</p><p className="font-semibold">{money(ev.price_range.market.lowest)}</p></div>
                    <div className="rounded-lg bg-[#6B3FD9]/10 p-3"><p className="text-xs text-gray-500">Median</p><p className="font-semibold text-[#5A2EC9]">{money(ev.price_range.market.median)}</p></div>
                    <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Highest</p><p className="font-semibold">{money(ev.price_range.market.highest)}</p></div>
                  </div>
                  <p className="mt-3 text-sm text-gray-700">Suggested range: <strong>{money(ev.price_range.low)} to {money(ev.price_range.high)}</strong></p>
                </>
              ) : <p className="text-sm text-gray-600">No competitor prices found yet.</p>}
              <p className="mt-1 text-sm text-gray-600">Lowest price that still meets your margin target: <strong>{money(ev.price_range.floor)}</strong></p>
              <p className="mt-2 text-xs text-gray-500">{ev.price_range.note}</p>

              <h3 className="mb-2 mt-5 text-sm font-semibold text-gray-900">Where the data came from</h3>
              <ul className="space-y-1.5 text-sm">
                {snap.sources.map((s) => (
                  <li key={s.source} className="flex items-start justify-between gap-3">
                    <span className="text-gray-700">{SOURCE_LABEL[s.source] ?? s.source}</span>
                    <span className={`text-right text-xs ${s.status === 'ok' ? 'text-green-700' : 'text-gray-500'}`}>{s.status === 'ok' ? `${s.count} listings` : s.note ?? STATUS_TEXT[s.status] ?? s.status}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                Searched for: {snap.fingerprint.search_queries.map((q) => `"${q}"`).join(', ') || '—'} ({snap.fingerprint.method === 'ai' ? 'described by AI' : 'from the title only'}).
                {snap.candidates > 0 && ` ${snap.candidates} listings checked, ${snap.rejected} rejected as a different product${snap.outliers_dropped ? `, ${snap.outliers_dropped} dropped for odd prices` : ''} (${snap.match_method === 'ai' ? 'AI' : 'keyword'} check).`}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-3"><h2 className="text-base font-semibold text-gray-900">Competing listings ({snap.listings.length})</h2></div>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-2.5">Marketplace</th><th className="px-5 py-2.5">Listing</th><th className="px-5 py-2.5 text-right">Price</th><th className="px-5 py-2.5">Match</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {snap.listings.map((l, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2.5 text-gray-700">{SOURCE_LABEL[l.marketplace] ?? l.marketplace}</td>
                    <td className="max-w-[420px] px-5 py-2.5"><div className="truncate text-gray-900">{l.title}</div>{l.match_reason && <div className="truncate text-xs text-gray-500">{l.match_reason}</div>}</td>
                    <td className="px-5 py-2.5 text-right font-medium tabular-nums">{money(l.price)}</td>
                    <td className="px-5 py-2.5 text-xs text-gray-600">{l.match_score ?? '—'}{l.url && <a href={l.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex text-[#6B3FD9]" aria-label="Open listing"><ExternalLink className="h-3.5 w-3.5" /></a>}</td>
                  </tr>
                ))}
                {snap.listings.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No same-product listings yet. Connect a data source above, or try again later.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Not measured yet</h2>
            <p className="mt-1 text-xs text-gray-500">These need data sources that are not connected. They are left out rather than guessed.</p>
            <div className="mt-3 flex flex-wrap gap-2">{ev.not_measured.map((n) => <span key={n.key} title={n.why} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">{n.label}</span>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
