'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Globe2, X } from 'lucide-react';
import { CountryFlag } from '@/components/country-flag';
import { WorldMap } from './world-map';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

type Metric = 'customers' | 'orders' | 'views';

const METRIC_LABEL: Record<Metric, string> = { customers: 'Customers', orders: 'Orders', views: 'Views' };

const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

// The backend only names a handful of countries; visitors can come from
// anywhere, so resolve any ISO code to its English name here.
function countryName(code: string, fallback: string): string {
  if (code === 'Unknown') return 'Other';
  try { return regionNames?.of(code) ?? fallback; } catch { return fallback; }
}

// Counts up to the value once it changes; people who ask their system for less motion get the number at once.
function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from.current === target) { setValue(target); from.current = target; return; }
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(begin + (target - begin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function CustomersByCountry({ stats }: { stats: DashboardStats | null }) {
  const [metric, setMetric] = useState<Metric>('views');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [barsIn, setBarsIn] = useState(false);
  const source = metric === 'orders' ? stats?.ordersByCountry : metric === 'views' ? stats?.viewsByCountry : stats?.customersByCountry;
  // Real countries first (biggest first), the "Other" bucket last.
  const allRows = (source ?? [])
    .map((r) => ({ ...r, country: countryName(r.code, r.country) }))
    .sort((a, b) => (a.code === 'Unknown' ? 1 : 0) - (b.code === 'Unknown' ? 1 : 0) || b.customers - a.customers);
  const rows = selectedCode ? allRows.filter((r) => r.code === selectedCode) : allRows;
  const total = allRows.reduce((s, r) => s + r.customers, 0);
  const mappable = allRows.filter((r) => r.code !== 'Unknown');
  const selectedName = selectedCode ? allRows.find((r) => r.code === selectedCode)?.country : null;
  const maxRow = Math.max(...allRows.map((r) => r.customers), 1);
  const shownTotal = useCountUp(total);

  // The bars grow from zero each time the metric changes.
  useEffect(() => {
    setBarsIn(false);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setBarsIn(true)));
    return () => cancelAnimationFrame(raf);
  }, [metric, stats]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:col-span-2 lg:only:col-span-3">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{METRIC_LABEL[metric]} by country</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg bg-muted/50 p-0.5 text-xs font-medium">
            {(['views', 'customers', 'orders'] as Metric[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMetric(m); setSelectedCode(null); }}
                className={`rounded-md px-2.5 py-1 transition ${
                  metric === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {METRIC_LABEL[m]}
              </button>
            ))}
          </div>
          <Link href="/dashboard/customers" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">View all →</Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* Map always renders, even with zero rows — an empty map still confirms the widget works, instead of
            silently disappearing whenever a metric has no country data yet. */}
        <div className="h-64 w-full overflow-hidden rounded-xl bg-gradient-to-b from-muted/40 to-muted/20 sm:h-80">
          <WorldMap data={mappable} metricLabel={METRIC_LABEL[metric]} selectedCode={selectedCode} onSelectCountry={setSelectedCode} />
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-foreground">{shownTotal}</span>
            <span className="text-sm text-muted-foreground">{METRIC_LABEL[metric].toLowerCase()} in {allRows.length} {allRows.length === 1 ? 'place' : 'places'}</span>
          </div>
          {selectedCode && (
            <button
              type="button"
              onClick={() => setSelectedCode(null)}
              className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400"
            >
              <CountryFlag code={selectedCode} className="h-3 w-4" />
              {selectedName ?? selectedCode}
              <X className="h-3 w-3" />
            </button>
          )}
          {total === 0 ? (
            <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
              No {metric} data yet
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.code}>
                  <div className="flex items-center gap-2">
                    {r.code === 'Unknown' ? (
                      <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <CountryFlag code={r.code} />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{r.country}</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{r.customers}</span>
                    <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{r.percentage}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-700 ease-out"
                      style={{ width: barsIn ? `${Math.max(4, Math.round((r.customers / maxRow) * 100))}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!selectedCode && allRows.some((r) => r.code === 'Unknown') && (
            <p className="mt-4 border-t border-border pt-2 text-[10px] text-muted-foreground">
              {metric === 'orders'
                ? '"Other" = orders from a customer added before country tracking, or from a source that doesn\'t report it yet.'
                : metric === 'views'
                  ? '"Other" = views recorded before visitor countries were tracked, or where the lookup failed. Views cover your Custom Website storefront only.'
                  : '"Other" = customers added before country tracking, or from a source that doesn\'t report it yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
