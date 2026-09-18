'use client';

import { Clock, Truck, Loader2 } from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { useAnalyticsData } from '@/components/analytics/useAnalyticsData';
import AnalyticsUpgradeGate from '@/components/analytics/AnalyticsUpgradeGate';
import KpiCard from '@/components/analytics/KpiCard';
import SectionCard from '@/components/analytics/SectionCard';
import FulfillmentSnapshotList from '@/components/analytics/overview/FulfillmentSnapshotList';
import SupplierPerformanceTable from '@/components/analytics/fulfillment/SupplierPerformanceTable';

interface FulfillmentData {
  status_breakdown_30d: Record<string, number>;
  avg_fulfillment_hours: number | null;
  supplier_performance_30d: { supplier: string; statuses: Record<string, number>; total: number }[];
}

export default function FulfillmentAnalyticsPage() {
  const { data, loading, locked } = useAnalyticsData<FulfillmentData>(analyticsApi.fulfillment);

  if (locked) return <AnalyticsUpgradeGate title="Fulfillment Analytics" />;
  if (loading || !data) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }

  const totalSupplierOrders = data.supplier_performance_30d.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fulfillment Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">How fast orders ship, and how your dropship suppliers perform — last 30 days.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          label="Avg time to ship"
          value={data.avg_fulfillment_hours === null ? '—' : data.avg_fulfillment_hours < 24 ? `${data.avg_fulfillment_hours}h` : `${(data.avg_fulfillment_hours / 24).toFixed(1)}d`}
          icon={<Clock className="w-5 h-5" />}
        />
        <KpiCard label="Supplier orders (30d)" value={totalSupplierOrders.toLocaleString()}
          icon={<Truck className="w-5 h-5" />} iconClassName="bg-blue-500/10 text-blue-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Order status breakdown">
          <FulfillmentSnapshotList data={data.status_breakdown_30d} />
        </SectionCard>
        <SectionCard title="Supplier performance">
          <SupplierPerformanceTable data={data.supplier_performance_30d} />
        </SectionCard>
      </div>
    </div>
  );
}
