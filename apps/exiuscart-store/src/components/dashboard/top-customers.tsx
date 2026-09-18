import { Star } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function TopCustomers({ stats, fmt }: { stats: DashboardStats | null; fmt: (n: number, d?: number) => string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500" />
        <h2 className="font-semibold text-foreground">Top customers</h2>
        <span className="ml-auto text-xs text-muted-foreground">This month</span>
      </div>
      {!stats?.topCustomers?.length ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No customer data yet</div>
      ) : (
        <div className="space-y-3">
          {stats.topCustomers.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.orders} order{c.orders !== 1 ? 's' : ''}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(c.revenue, 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
