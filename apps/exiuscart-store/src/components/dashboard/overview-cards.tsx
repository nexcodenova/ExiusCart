import { Wallet, ShoppingBag, Users, Boxes } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function OverviewCards({
  stats, loading, fmt, monthlyTrendDelta, monthlyOrdersTrendDelta,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  fmt: (n: number, d?: number) => string;
  monthlyTrendDelta: number | null;
  monthlyOrdersTrendDelta: number | null;
}) {
  const monthly = stats?.monthlyRevenue12m ?? [];
  const revenueTrend = monthly.map((m) => m.revenue);
  const ordersTrend = monthly.map((m) => m.orders);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        icon={Wallet} label="Total Revenue" color="indigo" href="/dashboard/reports"
        value={loading ? '—' : fmt(stats?.allTimeRevenue ?? 0, 0)}
        change={monthlyTrendDelta} comparison="vs. first half of period" trend={revenueTrend}
      />
      <KpiCard
        icon={ShoppingBag} label="Total Orders" color="violet" href="/dashboard/orders"
        value={loading ? '—' : (stats?.allTimeOrders ?? 0).toLocaleString()}
        change={monthlyOrdersTrendDelta} comparison="vs. first half of period" trend={ordersTrend}
      />
      <KpiCard
        icon={Users} label="Total Customers" color="emerald" href="/dashboard/customers"
        value={loading ? '—' : (stats?.customers ?? 0).toLocaleString()}
        change={null} comparison={`${stats?.newCustomersMonth ?? 0} new this month`} trend={[]}
      />
      <KpiCard
        icon={Boxes} label="Active Products" color="amber" href="/dashboard/products"
        value={loading ? '—' : (stats?.products ?? 0).toLocaleString()}
        change={null} comparison={stats?.outOfStockCount ? `${stats.outOfStockCount} out of stock` : 'All stocked'} trend={[]}
      />
    </div>
  );
}
