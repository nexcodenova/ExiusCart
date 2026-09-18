import { Wallet, ShoppingBag, Users, Boxes } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { DashboardStats, DashboardPeriod } from '@/lib/dashboard/dashboard-types';

const PERIOD_COMPARISON: Record<DashboardPeriod, string> = {
  '7d': 'vs. previous 7 days',
  '30d': 'vs. previous 30 days',
  '90d': 'vs. previous 90 days',
  '12m': 'vs. previous 12 months',
  all: 'vs. previous equivalent period',
};

export function OverviewCards({
  stats, loading, fmt, period,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  fmt: (n: number, d?: number) => string;
  period: DashboardPeriod;
}) {
  const trendPoints = stats?.periodTrend ?? [];
  const revenueTrend = trendPoints.map((p) => p.revenue);
  const ordersTrend = trendPoints.map((p) => p.orders);
  const comparison = PERIOD_COMPARISON[period];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        icon={Wallet} label="Total Revenue" color="indigo" href="/dashboard/reports"
        value={loading ? '—' : fmt(stats?.periodRevenue ?? 0, 0)}
        change={stats?.periodRevenueChange ?? null} comparison={comparison} trend={revenueTrend}
      />
      <KpiCard
        icon={ShoppingBag} label="Total Orders" color="violet" href="/dashboard/orders"
        value={loading ? '—' : (stats?.periodOrders ?? 0).toLocaleString()}
        change={stats?.periodOrdersChange ?? null} comparison={comparison} trend={ordersTrend}
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
