import Link from 'next/link';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function RecentCustomersPanel({ stats, fmt }: { stats: DashboardStats | null; fmt: (n: number, d?: number) => string }) {
  const customers = stats?.recentCustomers ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Recent customers</h2>
        <Link href="/dashboard/customers" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">View all</Link>
      </div>
      {customers.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No customers yet</div>
      ) : (
        <div className="divide-y divide-border">
          {customers.map((c) => {
            const initials = (c.name || 'C').trim().split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
            const dateStr = c.date ? new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
            return (
              <div key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{initials}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.orders} order{c.orders !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold tabular-nums text-foreground">{fmt(c.total, 0)}</p>
                  <p className="text-[9px] text-muted-foreground">{dateStr}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
