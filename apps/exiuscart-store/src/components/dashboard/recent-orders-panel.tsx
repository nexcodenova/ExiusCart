import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  shipped: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
  delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};

export function RecentOrdersPanel({ stats, loading, fmt }: { stats: DashboardStats | null; loading: boolean; fmt: (n: number, d?: number) => string }) {
  return (
    <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
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
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2.5 font-medium">#</th>
                <th className="pb-2.5 font-medium">Customer</th>
                <th className="pb-2.5 font-medium">Items</th>
                <th className="pb-2.5 font-medium">Total</th>
                <th className="pb-2.5 font-medium">Status</th>
                <th className="pb-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map((o) => {
                const amtNum = parseFloat(o.amount);
                const timeStr = (() => { try { return new Date(o.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return o.time; } })();
                return (
                  <tr key={o.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">#{o.id}</td>
                    <td className="max-w-[160px] truncate py-3.5 pr-3 text-sm text-foreground">{o.customer}</td>
                    <td className="py-3.5 pr-3 text-sm text-muted-foreground">{o.items ? `${o.items} ${o.items === 1 ? 'item' : 'items'}` : '—'}</td>
                    <td className="py-3.5 pr-3 text-sm font-semibold tabular-nums text-foreground">{isNaN(amtNum) ? o.amount : fmt(amtNum, 0)}</td>
                    <td className="py-3.5 pr-3">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_BADGE[o.status] ?? 'bg-muted text-muted-foreground'}`}>{o.status}</span>
                    </td>
                    <td className="py-3.5 text-sm text-muted-foreground">{timeStr}</td>
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
