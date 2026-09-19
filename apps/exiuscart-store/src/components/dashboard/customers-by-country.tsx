import { useState } from 'react';
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
  if (code === 'Unknown') return 'Unknown';
  try { return regionNames?.of(code) ?? fallback; } catch { return fallback; }
}

export function CustomersByCountry({ stats }: { stats: DashboardStats | null }) {
  const [metric, setMetric] = useState<Metric>('customers');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const source = metric === 'orders' ? stats?.ordersByCountry : metric === 'views' ? stats?.viewsByCountry : stats?.customersByCountry;
  const allRows = (source ?? []).map((r) => ({ ...r, country: countryName(r.code, r.country) }));
  const rows = selectedCode ? allRows.filter((r) => r.code === selectedCode) : allRows;
  const total = allRows.reduce((s, r) => s + r.customers, 0);
  const mappable = allRows.filter((r) => r.code !== 'Unknown');
  const selectedName = selectedCode ? allRows.find((r) => r.code === selectedCode)?.country : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{METRIC_LABEL[metric]} by country</h2>
        </div>
        <Link href="/dashboard/customers" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">View all →</Link>
      </div>
      <div className="mb-3 inline-flex rounded-lg bg-muted/50 p-0.5 text-xs font-medium">
        {(['customers', 'orders', 'views'] as Metric[]).map((m) => (
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
      <div className="space-y-3">
        {/* Map always renders, even with zero rows — an empty map still
            confirms the widget works, instead of silently disappearing
            whenever a metric has no country data yet (see the note below
            for what "Unknown" means, and the empty-state text under the
            map for when there's genuinely nothing at all). */}
        <div className="h-36 w-full overflow-hidden rounded-lg bg-muted/30">
          <WorldMap data={mappable} metricLabel={METRIC_LABEL[metric]} selectedCode={selectedCode} onSelectCountry={setSelectedCode} />
        </div>
        {selectedCode && (
          <button
            type="button"
            onClick={() => setSelectedCode(null)}
            className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400"
          >
            <CountryFlag code={selectedCode} className="h-3 w-4" />
            {selectedName ?? selectedCode}
            <X className="h-3 w-3" />
          </button>
        )}
        {total === 0 ? (
          <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
            No {metric} data yet
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.code} className="flex items-center gap-2">
                {r.code === 'Unknown' ? (
                  <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <CountryFlag code={r.code} />
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">{r.country}</span>
                <span className="text-xs font-semibold tabular-nums text-foreground">{r.customers}</span>
                <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{r.percentage}%</span>
              </div>
            ))}
          </div>
        )}
        {!selectedCode && allRows.some((r) => r.code === 'Unknown') && (
          <p className="pt-2 text-[10px] text-muted-foreground border-t border-border">
            {metric === 'orders'
              ? '"Unknown" = orders from a customer added before country tracking, or from a source that doesn\'t report it yet.'
              : metric === 'views'
                ? '"Unknown" = views recorded before visitor countries were tracked, or where the lookup failed. Views cover your Custom Website storefront only.'
                : '"Unknown" = customers added before country tracking, or from a source that doesn\'t report it yet.'}
          </p>
        )}
      </div>
    </div>
  );
}
