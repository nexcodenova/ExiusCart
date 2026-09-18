'use client';

import { Link2, Loader2 } from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { useAnalyticsData } from '@/components/analytics/useAnalyticsData';
import AnalyticsUpgradeGate from '@/components/analytics/AnalyticsUpgradeGate';
import KpiCard from '@/components/analytics/KpiCard';
import SectionCard from '@/components/analytics/SectionCard';
import { DonutChart } from '@/components/charts/DonutChart';
import ChannelPerformanceTable from '@/components/analytics/channels/ChannelPerformanceTable';

interface ChannelsData {
  channels: {
    channel: string; connected: boolean; revenue: number; orders: number;
    avg_order_value: number; share_pct: number; growth_pct: number | null; commission_paid_90d: number;
  }[];
  total_revenue_90d: number;
}

export default function ChannelAnalyticsPage() {
  const { fmt } = useCurrency();
  const { data, loading, locked } = useAnalyticsData<ChannelsData>(analyticsApi.channels);

  if (locked) return <AnalyticsUpgradeGate title="Channel Analytics" />;
  if (loading || !data) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Channel Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Revenue and growth across every sales channel, last 90 days.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard label="Revenue (90d)" value={fmt(data.total_revenue_90d)} icon={<Link2 className="w-5 h-5" />} />
        <KpiCard label="Active channels" value={data.channels.length.toString()} icon={<Link2 className="w-5 h-5" />} iconClassName="bg-blue-500/10 text-blue-600" />
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        <SectionCard title="Revenue share">
          {data.channels.length ? (
            <DonutChart data={data.channels} category="revenue" index="channel" valueFormatter={fmt} label="90-day revenue" />
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No orders in the last 90 days.</p>
          )}
        </SectionCard>
        <SectionCard title="Per-channel performance">
          <ChannelPerformanceTable data={data.channels} fmt={fmt} />
        </SectionCard>
      </div>
    </div>
  );
}
