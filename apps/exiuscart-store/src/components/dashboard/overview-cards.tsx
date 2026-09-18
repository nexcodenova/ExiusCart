import { Wallet, ShoppingBag, Users, Boxes, Target } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function OverviewCards({
  stats, loading, fmt,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  fmt: (n: number, d?: number) => string;
}) {
  const trendPoints = stats?.periodTrend ?? [];
  const revenueTrend = trendPoints.map((p) => p.revenue);
  const ordersTrend = trendPoints.map((p) => p.orders);

  const hasConversionData = (stats?.storefrontViews ?? 0) > 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <KpiCard
        icon={Wallet} label="Total Revenue" color="indigo" href="/dashboard/reports"
        value={loading ? '—' : fmt(stats?.periodRevenue ?? 0, 0)}
        change={stats?.periodRevenueChange ?? null} comparison="vs. previous period" trend={revenueTrend}
      />
      <KpiCard
        icon={ShoppingBag} label="Total Orders" color="violet" href="/dashboard/orders"
        value={loading ? '—' : (stats?.periodOrders ?? 0).toLocaleString()}
        change={stats?.periodOrdersChange ?? null} comparison="vs. previous period" trend={ordersTrend}
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
      <KpiCard
        icon={Target} label="Storefront Conversion" color="rose" href="/dashboard/channels/integrations/custom-website"
        value={loading ? '—' : hasConversionData ? `${stats?.storefrontConversion}%` : 'No data yet'}
        change={hasConversionData ? stats?.storefrontConversionChange ?? null : null}
        comparison={hasConversionData ? 'vs. previous period · Custom Website only' : 'Custom Website channel only'}
        trend={[]}
      />
    </div>
  );
}
