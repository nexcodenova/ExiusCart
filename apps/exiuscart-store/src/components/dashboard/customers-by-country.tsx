'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Globe2, X, MapPin } from 'lucide-react';
import { CountryFlag } from '@/components/country-flag';
import { WorldMap, REGION_FOCUS } from './world-map';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const viewsTotal = (stats?.viewsByCountry ?? []).reduce((s, r) => s + r.customers, 0);
  // Open on Views only when there are views (Custom Website); otherwise Orders,
  // e.g. TheDersi shops, which get no storefront views from us.
  const [metric, setMetric] = useState<Metric>(viewsTotal > 0 ? 'views' : 'orders');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const home = stats?.homeCountry ?? null;
  // TheDersi sellers only sell in Sri Lanka: the map stays on Sri Lanka, no picker.
  // Everyone else gets a region picker that opens on World.
  const lockedToSriLanka = !!stats?.theDersiShop;
  const [region, setRegion] = useState<string>('world');
  const activeRegion = lockedToSriLanka ? 'LK' : region;
  const zoomed = activeRegion !== 'world';
  useEffect(() => { if (viewsTotal === 0 && metric === 'views') setMetric('orders'); }, [viewsTotal]); // eslint-disable-line react-hooks/exhaustive-deps
  // Picker options: World, then the countries that have data, then the rest we can zoom on
  const withData = new Set([...(stats?.ordersByCountry ?? []), ...(stats?.customersByCountry ?? []), ...(stats?.viewsByCountry ?? [])].map((r) => r.code));
  const regionOptions = Object.keys(REGION_FOCUS)
    .sort((a, b) => Number(withData.has(b) || b === home) - Number(withData.has(a) || a === home) || countryName(a, a).localeCompare(countryName(b, b)));
  const cities = stats?.ordersByCity ?? [];
  // Top cities are only known for the shop's own country
  const showCities = zoomed && activeRegion === home && cities.length > 0;
  const maxCity = Math.max(...cities.map((c) => c.orders), 1);
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
  }, [metric, stats, activeRegion]);

  const top = allRows.find((r) => r.code !== 'Unknown');

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-2 lg:only:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="font-semibold text-foreground">Where your {METRIC_LABEL[metric].toLowerCase()} come from</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lockedToSriLanka ? 'TheDersi sells across Sri Lanka, so this map shows Sri Lanka.' : zoomed ? `Zoomed on ${countryName(activeRegion, activeRegion)}.` : 'Click a country on the map to focus on it.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Underlined tabs, Apify-style */}
          <div className="flex gap-4 text-xs">
            {(['views', 'customers', 'orders'] as Metric[]).map((m) => (
              <button key={m} type="button" onClick={() => { setMetric(m); setSelectedCode(null); }}
                className={`border-b-2 pb-1 font-medium transition ${metric === m ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {METRIC_LABEL[m]}
              </button>
            ))}
          </div>
          <Link href="/dashboard/customers" className="text-xs font-medium text-muted-foreground hover:text-foreground">View all →</Link>
        </div>
      </div>

      <div className="mt-3 grid border-t border-border lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* Map always renders, even with zero rows — an empty map still confirms the widget works. */}
        <div className="relative h-64 w-full overflow-hidden bg-muted/30 sm:h-80 lg:h-full lg:min-h-[340px] lg:border-r lg:border-border">
          <WorldMap data={mappable} metricLabel={METRIC_LABEL[metric]} selectedCode={selectedCode} onSelectCountry={setSelectedCode} focusCode={zoomed ? activeRegion : null} />
          {/* Region picker (not for TheDersi shops, which stay on Sri Lanka) */}
          {!lockedToSriLanka && (
            <div className="absolute right-3 top-3 w-44">
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="h-8 bg-background/90 text-xs backdrop-blur">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="world">
                    <span className="flex items-center gap-2"><Globe2 className="h-3.5 w-3.5 text-muted-foreground" /> World</span>
                  </SelectItem>
                  {regionOptions.map((code) => (
                    <SelectItem key={code} value={code}>
                      <span className="flex items-center gap-2"><CountryFlag code={code} className="h-2.5 w-3.5" /> {countryName(code, code)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Colour key */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
            <span>Less</span>
            <span className="h-1.5 w-20 rounded-full bg-gradient-to-r from-indigo-200 to-indigo-600" />
            <span>More</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-5">
          {/* Compact summary line: total and the top country */}
          <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Total <span className="ml-1 text-sm font-semibold tabular-nums text-foreground">{shownTotal.toLocaleString()}</span></span>
            {top && (
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                Top <CountryFlag code={top.code} className="h-3 w-4" />
                <span className="truncate text-foreground">{top.country}</span>
                <span>{top.percentage}%</span>
              </span>
            )}
          </div>
          {selectedCode && (
            <button type="button" onClick={() => setSelectedCode(null)}
              className="mt-3 flex w-fit items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted">
              <CountryFlag code={selectedCode} className="h-3 w-4" />
              {selectedName ?? selectedCode}
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {showCities ? (
            <div className="mt-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <MapPin className="h-3 w-3" /> Top cities by orders in {countryName(home!, home!)}
              </p>
              <ol className="space-y-2.5">
                {cities.map((c, i) => (
                  <li key={c.city}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{c.city === 'Not given' ? '' : i + 1}</span>
                      <span className={`min-w-0 flex-1 truncate text-[13px] ${c.city === 'Not given' ? 'text-muted-foreground' : 'text-foreground'}`}>{c.city}</span>
                      <span className="text-[13px] tabular-nums text-foreground">{c.orders}</span>
                      <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{c.percentage}%</span>
                    </div>
                    <div className="ml-[26px] mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-700 ease-out"
                        style={{ width: barsIn ? `${Math.max(4, Math.round((c.orders / maxCity) * 100))}%` : '0%' }} />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : total === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 py-8 text-center text-sm text-muted-foreground">
              No {metric} data yet
              {metric === 'views' && <span className="text-[11px]">Views come from your own Custom Website storefront only.</span>}
            </div>
          ) : (
            <ol className="mt-4 space-y-2.5">
              {rows.map((r, i) => (
                <li key={r.code}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{selectedCode ? '' : i + 1}</span>
                    {r.code === 'Unknown' ? (
                      <Globe2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <CountryFlag code={r.code} className="h-3 w-4" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-normal text-foreground">{r.country}</span>
                    <span className="text-[13px] tabular-nums text-foreground">{r.customers}</span>
                    <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{r.percentage}%</span>
                  </div>
                  <div className="ml-[26px] mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-[width] duration-700 ease-out"
                      style={{ width: barsIn ? `${Math.max(4, Math.round((r.customers / maxRow) * 100))}%` : '0%' }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
          {!selectedCode && !showCities && allRows.some((r) => r.code === 'Unknown') && (
            <p className="mt-auto border-t border-border pt-2 text-[10px] text-muted-foreground">
              {metric === 'orders'
                ? '"Other" = orders from a customer added before country tracking, or from a source that does not report it yet.'
                : metric === 'views'
                  ? '"Other" = views recorded before visitor countries were tracked, or where the lookup failed. Views cover your Custom Website storefront only.'
                  : '"Other" = customers added before country tracking, or from a source that does not report it yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
