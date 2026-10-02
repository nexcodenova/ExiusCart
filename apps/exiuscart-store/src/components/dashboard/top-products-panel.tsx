import { ImageOff } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

// One ranked list (best sellers first, then the most-looked-at products that
// have not sold yet). Each row is just the photo, the name, a thin line with
// its own sold and view counts, and its revenue — no comparison bars.
export function TopProductsPanel({ stats, fmt, periodLabel }: { stats: DashboardStats | null; fmt: (n: number, d?: number) => string; periodLabel: string }) {
  if (!stats?.topProducts || stats.topProducts.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="font-semibold text-foreground">Top products</h2>
        <span className="text-xs text-muted-foreground">{periodLabel}</span>
      </div>
      <ol className="mt-3 divide-y divide-border border-t border-border">
        {stats.topProducts.map((p, i) => (
          <li key={`${p.name}-${i}`} className="flex items-center gap-3 px-5 py-2.5">
            <span className="w-3 shrink-0 text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
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
              <p className="truncate text-[13px] font-normal text-foreground">{p.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {p.qty} sold <span className="mx-1 opacity-50">·</span> {(p.views ?? 0).toLocaleString()} views
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">{fmt(p.revenue, 0)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
