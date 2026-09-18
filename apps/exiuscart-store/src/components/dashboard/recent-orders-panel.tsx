import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  confirmed: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  processing: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  shipped: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400',
  delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  cancelled: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

export function RecentOrdersPanel({ stats, loading, fmt }: { stats: DashboardStats | null; loading: boolean; fmt: (n: number, d?: number) => string }) {
  return (
    <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Recent orders</h2>
        <Link href="/dashboard/orders" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">View all →</Link>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted/30" />)}</div>
      ) : !stats?.recentOrders?.length ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No orders yet</p>
          <Link href="/dashboard/pos" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            <ShoppingCart className="h-4 w-4" /> Open point of sale
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Total</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map((o) => {
                const amtNum = parseFloat(o.amount);
                const timeStr = (() => { try { return new Date(o.time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch { return o.time; } })();
                return (
                  <tr key={o.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">#{o.id}</td>
                    <td className="py-2.5 text-xs text-foreground truncate max-w-[140px]">{o.customer}</td>
                    <td className="py-2.5 text-xs font-semibold tabular-nums text-foreground">{isNaN(amtNum) ? o.amount : fmt(amtNum, 0)}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_BADGE[o.status] ?? 'bg-muted text-muted-foreground'}`}>{o.status}</span>
                    </td>
                    <td className="py-2.5 text-[10px] text-muted-foreground">{timeStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
