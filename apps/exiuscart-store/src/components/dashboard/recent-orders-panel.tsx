import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { OrderRow } from './shared';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function RecentOrdersPanel({ stats, loading, fmt }: { stats: DashboardStats | null; loading: boolean; fmt: (n: number, d?: number) => string }) {
  return (
    <div className="lg:col-span-2 rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
        <h2 className="font-semibold text-foreground">Recent orders</h2>
        <Link href="/dashboard/orders" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">View all</Link>
      </div>
      {loading ? (
        <div className="divide-y divide-border">{[1, 2, 3, 4].map(i => <div key={i} className="h-[62px] animate-pulse bg-muted/30" />)}</div>
      ) : stats?.recentOrders?.length ? (
        <div className="divide-y divide-border">{stats.recentOrders.map(o => <OrderRow key={o.id} {...o} fmt={fmt} />)}</div>
      ) : (
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No orders yet</p>
          <Link href="/dashboard/pos" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            <ShoppingCart className="h-4 w-4" /> Open point of sale
          </Link>
        </div>
      )}
    </div>
  );
}
