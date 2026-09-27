import { Layers, ImageOff, Eye } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

// One list: what sold and how often each product was looked at, side by side.
export function TopProductsPanel({ stats, fmt, periodLabel }: { stats: DashboardStats | null; fmt: (n: number, d?: number) => string; periodLabel: string }) {
  if (!stats?.topProducts || stats.topProducts.length === 0) return null;
  const maxRev = Math.max(...stats.topProducts.map((p) => p.revenue), 0);
  const maxViews = Math.max(...stats.topProducts.map((p) => p.views ?? 0), 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Top products</h2>
        </div>
        <span className="text-xs text-muted-foreground">{periodLabel}</span>
      </div>
      <div className="space-y-3.5">
        {stats.topProducts.map((p) => {
          const revPct = maxRev > 0 ? Math.round((p.revenue / maxRev) * 100) : 0;
          const viewPct = maxViews > 0 ? Math.round(((p.views ?? 0) / maxViews) * 100) : 0;
          return (
            <div key={p.name} className="flex items-center gap-2.5">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageOff className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-foreground">{p.name}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{fmt(p.revenue, 0)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${revPct}%` }} />
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{p.qty} sold</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${viewPct}%` }} />
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground"><Eye className="h-3 w-3" />{(p.views ?? 0).toLocaleString()} views</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
