'use client';

import { Users, Repeat, Wallet, UserPlus, Loader2 } from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { useAnalyticsData } from '@/components/analytics/useAnalyticsData';
import AnalyticsUpgradeGate from '@/components/analytics/AnalyticsUpgradeGate';
import KpiCard from '@/components/analytics/KpiCard';
import SectionCard from '@/components/analytics/SectionCard';
import { DonutChart } from '@/components/charts/DonutChart';
import TopCustomersTable from '@/components/analytics/customers/TopCustomersTable';
import CustomerGrowthChart from '@/components/analytics/customers/CustomerGrowthChart';

interface CustomersData {
  summary: {
    total_customers_with_orders: number; returning_customers: number;
    repeat_purchase_rate_pct: number; avg_ltv: number; new_customers_90d: number;
  };
  top_customers: { name: string; orders: number; ltv: number }[];
  by_source: { source: string; count: number }[];
  growth_trend: { month: string; 'New customers': number }[];
}

export default function CustomerAnalyticsPage() {
  const { fmt } = useCurrency();
  const { data, loading, locked } = useAnalyticsData<CustomersData>(analyticsApi.customers);

  if (locked) return <AnalyticsUpgradeGate title="Customer Analytics" />;
  if (loading || !data) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }

  const { summary } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Lifetime value, repeat purchases, and where your customers come from.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Avg LTV" value={fmt(summary.avg_ltv)} icon={<Wallet className="w-5 h-5" />} />
        <KpiCard label="Repeat Purchase Rate" value={`${summary.repeat_purchase_rate_pct}%`}
          icon={<Repeat className="w-5 h-5" />} iconClassName="bg-blue-500/10 text-blue-600" />
        <KpiCard label="Customers (with orders)" value={summary.total_customers_with_orders.toLocaleString()}
          icon={<Users className="w-5 h-5" />} iconClassName="bg-violet-500/10 text-violet-600" />
        <KpiCard label="New (90d)" value={summary.new_customers_90d.toLocaleString()}
          icon={<UserPlus className="w-5 h-5" />} iconClassName="bg-emerald-500/10 text-emerald-600" />
      </div>

      <SectionCard title="New customer growth" description="Last 6 months">
        <CustomerGrowthChart data={data.growth_trend} />
      </SectionCard>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        <SectionCard title="Customers by source">
          {data.by_source.length ? (
            <DonutChart data={data.by_source} category="count" index="source" valueFormatter={(v) => v.toLocaleString()} label="customers" />
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No customer data yet.</p>
          )}
        </SectionCard>
        <SectionCard title="Top customers by lifetime value">
          <TopCustomersTable data={data.top_customers} fmt={fmt} />
        </SectionCard>
      </div>
    </div>
  );
}
