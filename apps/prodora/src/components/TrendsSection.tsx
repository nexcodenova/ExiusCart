'use client';

// Google Trends on the Prodora product page, no click needed: 5 years of
// worldwide search interest, the countries searching most, and what else people
// search for. Shared weekly cache per keyword on the server.

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, TrendingUp } from 'lucide-react';
import { shoppingApi, TrendsResponse } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

const DIRECTION: Record<string, { label: string; cls: string }> = {
  rising: { label: 'Rising', cls: 'bg-green-100 text-green-800' }, falling: { label: 'Falling', cls: 'bg-red-100 text-red-800' },
  steady: { label: 'Steady', cls: 'bg-gray-100 text-gray-700' }, low_interest: { label: 'Very low interest', cls: 'bg-amber-100 text-amber-800' },
};

function Chart({ points }: { points: { month: string; value: number }[] }) {
  if (points.length < 2) return null;
  const w = 600, h = 160, max = Math.max(100, ...points.map((p) => p.value));
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - (p.value / max) * (h - 8) - 4]);
  const line = xy.map(([x, y]) => `${x},${y}`).join(' ');
  const years = points.filter((p) => p.month.endsWith('-01'));
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Search interest over 5 years">
        {[25, 50, 75].map((g) => <line key={g} x1="0" x2={w} y1={h - (g / max) * (h - 8) - 4} y2={h - (g / max) * (h - 8) - 4} stroke="#E5E7EB" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <polygon points={`0,${h} ${line} ${w},${h}`} fill="#2563EB" fillOpacity="0.1" />
        <polyline points={line} fill="none" stroke="#2563EB" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[11px] text-[#9CA3AF]">{years.map((y) => <span key={y.month}>{y.month.slice(0, 4)}</span>)}</div>
    </div>
  );
}

export default function TrendsSection({ productId }: { productId: number }) {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null); setFailed(false);
    shoppingApi.getTrends(productId).then((d) => { if (!cancelled) setData(d); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [productId]);

  // Hidden when it can't help (Trends not set up on the server, or the lookup failed); a product with too
  // little search history still shows the section with a plain "not enough data" line.
  if (failed || (data && !data.trends && data.status !== 'insufficient')) return null;

  const t = data?.trends;
  const exploreUrl = data?.keyword ? `https://trends.google.com/trends/explore?date=today%205-y&q=${encodeURIComponent(data.keyword)}` : null;

  return (
    <div className="min-w-0 max-w-full [contain:inline-size] rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-[#111827]"><TrendingUp className="h-5 w-5 text-[#2563EB]" /> Google Trends</h2>
        {exploreUrl && <a href={exploreUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline">Open in Google Trends <ExternalLink className="h-3.5 w-3.5" /></a>}
      </div>
      {!data ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[#6B7280]"><Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" /> Fetching 5 years of Google searches… (only the first time, up to a minute)</div>
      ) : !t ? (
        <p className="text-sm text-[#6B7280]">Not enough Google search data for &ldquo;{data.keyword}&rdquo; yet.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {t.direction && DIRECTION[t.direction] && <span className={`rounded px-2.5 py-1 text-sm font-bold ${DIRECTION[t.direction].cls}`}>{DIRECTION[t.direction].label}</span>}
            <span className="text-sm text-[#374151]">&ldquo;{data.keyword}&rdquo;: {t.summary}</span>
          </div>
          <Chart points={t.monthly} />
          <p className="mt-1 text-xs text-[#6B7280]">Worldwide, past 5 years. 100 is this search term&apos;s own peak.</p>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {t.countries.length > 0 && (
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold text-[#111827]">Searched most in</h3>
                <ul className="space-y-1.5">
                  {t.countries.slice(0, 6).map((c) => (
                    <li key={c.country} className="text-sm">
                      <div className="flex justify-between gap-2"><span className="truncate text-[#111827]">{c.country}</span><span className="tabular-nums text-[#6B7280]">{c.index}</span></div>
                      <div className="h-1.5 rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.min(100, c.index)}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {t.related.rising.length > 0 && (
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold text-[#111827]">Rising searches</h3>
                <ul className="space-y-1">{t.related.rising.slice(0, 6).map((q) => (
                  <li key={q.query} className="flex justify-between gap-2 text-sm"><span className="truncate text-[#374151]">{q.query}</span><Badge variant="outline" className="shrink-0 font-normal">{String(q.value ?? '')}</Badge></li>
                ))}</ul>
              </div>
            )}
            {t.related.top.length > 0 && (
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold text-[#111827]">Top related searches</h3>
                <ul className="space-y-1">{t.related.top.slice(0, 6).map((q) => (
                  <li key={q.query} className="flex justify-between gap-2 text-sm"><span className="truncate text-[#374151]">{q.query}</span><span className="shrink-0 tabular-nums text-xs text-[#6B7280]">{String(q.value ?? '')}</span></li>
                ))}</ul>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-[#9CA3AF]">Source: {t.source ?? 'Google Trends'}. People searching on Google, not units sold.</p>
        </>
      )}
    </div>
  );
}
