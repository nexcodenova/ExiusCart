import { Globe2 } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function CustomersByCountry({ stats }: { stats: DashboardStats | null }) {
  const rows = stats?.customersByCountry ?? [];
  const total = rows.reduce((s, r) => s + r.customers, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Globe2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Customers by country</h2>
      </div>
      {total === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No customer data yet</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.code} className="flex items-center gap-2">
              <span className="flex h-5 w-8 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                {r.code === 'Unknown' ? '—' : r.code}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">{r.country}</span>
              <span className="text-xs font-semibold tabular-nums text-foreground">{r.customers}</span>
              <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{r.percentage}%</span>
            </div>
          ))}
          {rows.some((r) => r.code === 'Unknown') && (
            <p className="pt-2 text-[10px] text-muted-foreground border-t border-border mt-2">
              "Unknown" = customers added before country tracking, or from a source that doesn't report it yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
