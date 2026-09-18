'use client';

import { DollarSign, ShoppingCart, Users, Receipt, Loader2 } from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { useAnalyticsData } from '@/components/analytics/useAnalyticsData';
import AnalyticsUpgradeGate from '@/components/analytics/AnalyticsUpgradeGate';
import KpiCard from '@/components/analytics/KpiCard';
import SectionCard from '@/components/analytics/SectionCard';
import RevenueTrendChart from '@/components/analytics/overview/RevenueTrendChart';
import ChannelRevenueDonut from '@/components/analytics/overview/ChannelRevenueDonut';
import FulfillmentSnapshotList from '@/components/analytics/overview/FulfillmentSnapshotList';

interface OverviewData {
  kpis: {
    revenue_30d: number; revenue_change_pct: number;
    orders_30d: number; orders_change_pct: number;
    avg_order_value: number; total_customers: number;
  };
  revenue_trend: { month: string; Revenue: number; Orders: number }[];
  by_channel: { channel: string; revenue: number; orders: number }[];
  fulfillment_snapshot: Record<string, number>;
}

export default function AnalyticsOverviewPage() {
  const { fmt } = useCurrency();
  const { data, loading, locked } = useAnalyticsData<OverviewData>(analyticsApi.overview);

  if (locked) return <AnalyticsUpgradeGate title="Analytics Overview" />;
  if (loading || !data) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Your store's performance across every channel, last 30 days.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Revenue (30d)" value={fmt(kpis.revenue_30d)} changePct={kpis.revenue_change_pct}
          icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard label="Orders (30d)" value={kpis.orders_30d.toLocaleString()} changePct={kpis.orders_change_pct}
          icon={<ShoppingCart className="w-5 h-5" />} iconClassName="bg-blue-500/10 text-blue-600" />
        <KpiCard label="Avg Order Value" value={fmt(kpis.avg_order_value)}
          icon={<Receipt className="w-5 h-5" />} iconClassName="bg-violet-500/10 text-violet-600" />
        <KpiCard label="Total Customers" value={kpis.total_customers.toLocaleString()}
          icon={<Users className="w-5 h-5" />} iconClassName="bg-emerald-500/10 text-emerald-600" />
      </div>

      <SectionCard title="Revenue trend" description="Last 6 months">
        <RevenueTrendChart data={data.revenue_trend} fmt={fmt} />
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Revenue by channel" description="Last 30 days">
          <ChannelRevenueDonut data={data.by_channel} fmt={fmt} />
        </SectionCard>
        <SectionCard title="Fulfillment status" description="Last 30 days">
          <FulfillmentSnapshotList data={data.fulfillment_snapshot} />
        </SectionCard>
      </div>
    </div>
  );
}
