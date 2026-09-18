'use client';

import { Target, GitBranch, Loader2 } from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { useAnalyticsData } from '@/components/analytics/useAnalyticsData';
import AnalyticsUpgradeGate from '@/components/analytics/AnalyticsUpgradeGate';
import KpiCard from '@/components/analytics/KpiCard';
import SectionCard from '@/components/analytics/SectionCard';
import { DonutChart } from '@/components/charts/DonutChart';
import CampaignPerformanceCards from '@/components/analytics/marketing/CampaignPerformanceCards';

interface MarketingData {
  leads_by_source: { source: string; count: number }[];
  channel_performance: Record<string, { sent: number; opened?: number; clicked?: number; delivered?: number; open_rate_pct?: number; delivery_rate_pct?: number }>;
  drip_flows: { status_breakdown: Record<string, number>; conversion_pct: number };
}

export default function MarketingAnalyticsPage() {
  const { data, loading, locked } = useAnalyticsData<MarketingData>(analyticsApi.marketing);

  if (locked) return <AnalyticsUpgradeGate title="Marketing Analytics" />;
  if (loading || !data) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }

  const totalLeads = data.leads_by_source.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Marketing Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Where your leads come from, and how your campaigns actually perform.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Total leads" value={totalLeads.toLocaleString()} icon={<Target className="w-5 h-5" />} />
        <KpiCard label="Drip flow conversion" value={`${data.drip_flows.conversion_pct}%`}
          icon={<GitBranch className="w-5 h-5" />} iconClassName="bg-blue-500/10 text-blue-600" />
      </div>

      <SectionCard title="Campaign performance">
        <CampaignPerformanceCards data={data.channel_performance} />
      </SectionCard>

      <SectionCard title="Leads by source">
        {data.leads_by_source.length ? (
          <DonutChart data={data.leads_by_source} category="count" index="source" valueFormatter={(v) => v.toLocaleString()} label="leads" />
        ) : (
          <p className="text-sm text-muted-foreground py-10 text-center">No leads captured yet.</p>
        )}
      </SectionCard>
    </div>
  );
}
