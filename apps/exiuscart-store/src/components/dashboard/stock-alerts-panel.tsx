import { AlertTriangle, Plus, BarChart3 } from 'lucide-react';
import { StockRow, Shortcut } from './shared';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function StockAlertsPanel({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
        <AlertTriangle className="h-4 w-4 text-amber-500" /> Stock alerts
      </h2>
      {stats?.outOfStockCount ? (
        <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500">
          {stats.outOfStockCount} product{stats.outOfStockCount !== 1 ? 's' : ''} out of stock
        </div>
      ) : null}
      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-9 animate-pulse rounded bg-muted/30" />)}</div>
      ) : stats?.lowStockAlerts?.length ? (
        <ul className="space-y-4">{stats.lowStockAlerts.slice(0, 6).map(it => <StockRow key={it.name} {...it} />)}</ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">Everything is well stocked.</p>
      )}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Shortcut href="/dashboard/products" label="Add product" icon={Plus} />
        <Shortcut href="/dashboard/reports" label="Reports" icon={BarChart3} />
      </div>
    </div>
  );
}
