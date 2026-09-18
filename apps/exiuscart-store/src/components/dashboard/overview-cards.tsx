import { Wallet, ShoppingBag, Users, Boxes } from 'lucide-react';
import { PeriodCard } from './shared';
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
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <PeriodCard label="Total Revenue" value={loading ? '—' : fmt(stats?.allTimeRevenue ?? 0, 0)} delta={monthlyTrendDelta ?? undefined} icon={Wallet} color="indigo" sparkData={stats?.monthlyRevenue12m} sparkKey="revenue" />
      <PeriodCard label="Total Orders" value={loading ? '—' : (stats?.allTimeOrders ?? 0).toLocaleString()} delta={monthlyOrdersTrendDelta ?? undefined} icon={ShoppingBag} color="violet" plain sparkData={stats?.monthlyRevenue12m} sparkKey="orders" />
      <PeriodCard label="Total Customers" value={loading ? '—' : (stats?.customers ?? 0).toLocaleString()} icon={Users} color="emerald" plain />
      <PeriodCard label="Active Products" value={loading ? '—' : (stats?.products ?? 0).toLocaleString()} icon={Boxes} color="amber" plain />
    </div>
  );
}
