'use client';

import { DollarSign, TrendingDown, Percent, Loader2 } from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { useAnalyticsData } from '@/components/analytics/useAnalyticsData';
import AnalyticsUpgradeGate from '@/components/analytics/AnalyticsUpgradeGate';
import KpiCard from '@/components/analytics/KpiCard';
import SectionCard from '@/components/analytics/SectionCard';
import BestSellersTable from '@/components/analytics/products/BestSellersTable';
import LowPerformersTable from '@/components/analytics/products/LowPerformersTable';

interface ProductsData {
  best_sellers: { name: string; units_sold: number; revenue: number; margin_pct: number | null }[];
  low_performers: { name: string; views: number; units_sold: number; conversion_pct: number }[];
  margin_summary: { revenue_30d: number; estimated_cost_30d: number; estimated_margin_pct: number };
}

export default function ProductAnalyticsPage() {
  const { fmt } = useCurrency();
  const { data, loading, locked } = useAnalyticsData<ProductsData>(analyticsApi.products);

  if (locked) return <AnalyticsUpgradeGate title="Product Analytics" />;
  if (loading || !data) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Product Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Best sellers, margins, and weak converters — last 30 days.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Revenue (30d)" value={fmt(data.margin_summary.revenue_30d)} icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard label="Estimated Cost (30d)" value={fmt(data.margin_summary.estimated_cost_30d)}
          icon={<TrendingDown className="w-5 h-5" />} iconClassName="bg-amber-500/10 text-amber-600" />
        <KpiCard label="Estimated Margin" value={`${data.margin_summary.estimated_margin_pct}%`}
          icon={<Percent className="w-5 h-5" />} iconClassName="bg-emerald-500/10 text-emerald-600" />
      </div>

      <SectionCard title="Best sellers" description="By revenue, last 30 days">
        <BestSellersTable data={data.best_sellers} fmt={fmt} />
      </SectionCard>

      <SectionCard title="Weak converters" description="Real traffic (10+ views), low units sold — worth a relist or reprice">
        <LowPerformersTable data={data.low_performers} />
      </SectionCard>
    </div>
  );
}
