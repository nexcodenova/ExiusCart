import { TrendingUp, XCircle, Users, Boxes } from 'lucide-react';
import { HealthCard } from './shared';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function BusinessHealth({ stats, loading, fmt }: { stats: DashboardStats | null; loading: boolean; fmt: (n: number, d?: number) => string }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Business health</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HealthCard label="Fulfillment rate" value={`${stats?.fulfillmentRate ?? 0}%`} sub="Delivered / total" good={(stats?.fulfillmentRate ?? 0) >= 80} icon={TrendingUp} />
        <HealthCard label="Cancellation rate" value={`${stats?.cancellationRate ?? 0}%`} sub="Last 30 days" good={(stats?.cancellationRate ?? 0) < 5} icon={XCircle} />
        <HealthCard label="Repeat customers" value={`${stats?.repeatCustomerRate ?? 0}%`} sub="Ordered 2+ times" good={(stats?.repeatCustomerRate ?? 0) >= 20} icon={Users} />
        <HealthCard label="Inventory value" value={loading ? '—' : fmt(stats?.inventoryValue ?? 0, 0)}
          sub={stats?.outOfStockCount ? `${stats.outOfStockCount} out of stock` : 'All stocked'}
          good={!stats?.outOfStockCount} icon={Boxes} />
      </div>
    </div>
  );
}
