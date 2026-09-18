import { Layers } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function TopProductsPanel({ stats, fmt }: { stats: DashboardStats | null; fmt: (n: number, d?: number) => string }) {
  if (!stats?.topProducts || stats.topProducts.length === 0) return null;
  const maxRev = stats.topProducts[0].revenue;

  return (
    <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Top products</h2>
        </div>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>
      <div className="space-y-3">
        {stats.topProducts.map((p, i) => {
          const pct = maxRev > 0 ? Math.round((p.revenue / maxRev) * 100) : 0;
          return (
            <div key={p.name}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                  <span className="truncate font-medium text-foreground">{p.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-xs text-muted-foreground">{p.qty} sold</span>
                  <span className="font-semibold tabular-nums text-foreground">{fmt(p.revenue, 0)}</span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
