import { Wallet, CalendarDays, TrendingUp, BarChart3 } from 'lucide-react';
import { PeriodCard } from './shared';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function PerformanceRow({ stats, loading, fmt }: { stats: DashboardStats | null; loading: boolean; fmt: (n: number, d?: number) => string }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Performance</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PeriodCard label="Today" value={loading ? '—' : fmt(stats?.sales ?? 0, 0)}
          sub={`${stats?.orders ?? 0} order${(stats?.orders ?? 0) !== 1 ? 's' : ''}`} delta={stats?.salesChange} icon={Wallet} color="indigo" />
        <PeriodCard label="This week" value={loading ? '—' : fmt(stats?.thisWeekRevenue ?? 0, 0)}
          sub={`${stats?.thisWeekOrders ?? 0} order${(stats?.thisWeekOrders ?? 0) !== 1 ? 's' : ''}`} icon={CalendarDays} color="violet" />
        <PeriodCard label="This month" value={loading ? '—' : fmt(stats?.thisMonthRevenue ?? 0, 0)}
          sub={`${stats?.monthlyRevenue12m?.at(-1)?.orders ?? 0} order${(stats?.monthlyRevenue12m?.at(-1)?.orders ?? 0) !== 1 ? 's' : ''}`}
          delta={stats?.revenueMoM} icon={TrendingUp} color="emerald" />
        <PeriodCard label="This year" value={loading ? '—' : fmt(stats?.thisYearRevenue ?? 0, 0)}
          sub={`${stats?.thisYearOrders ?? 0} order${(stats?.thisYearOrders ?? 0) !== 1 ? 's' : ''}`} icon={BarChart3} color="amber" />
      </div>
    </div>
  );
}
