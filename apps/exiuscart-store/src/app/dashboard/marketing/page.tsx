'use client';

import { useEffect, useState } from 'react';
import { Target, Flame, GitBranch, Send, Loader2 } from 'lucide-react';
import { leadsApi, dripFlowsApi, marketingApi, whatsappApi, subscriptionApi } from '@/lib/api';
import KpiCard from '@/components/analytics/KpiCard';
import SectionCard from '@/components/analytics/SectionCard';
import { DonutChart } from '@/components/charts/DonutChart';
import MarketingQuickLinks from '@/components/marketing/MarketingQuickLinks';
import MarketingHubLockScreen from '@/components/marketing/MarketingHubLockScreen';

function shopIdFromStorage() { return typeof window !== 'undefined' ? localStorage.getItem('shop_id') || '1' : '1'; }

interface LeadStats {
  total: number; score_hot: number; score_warm: number; score_cold: number;
}

// A hub, not a second deep-analytics dashboard — real Marketing performance
// (attribution, campaign open/delivery rates, drip conversion) already
// lives at Analytics → Marketing (Growth/Scale). Open to every plan EXCEPT
// TheDersi Free Forever specifically (Lite/Pro/Official all get it) —
// quick counts pulled from each tool's own already-ungated endpoint, plus
// a launchpad into every marketing feature.
export default function MarketingOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [activeFlows, setActiveFlows] = useState(0);
  const [campaignsSent, setCampaignsSent] = useState(0);

  useEffect(() => {
    const shopId = shopIdFromStorage();
    subscriptionApi.getCurrent(shopId).then((r) => {
      if (r.data?.plan?.plan_type === 'thedersi_free_forever') { setLocked(true); setLoading(false); return; }
      Promise.all([
        leadsApi.getStats(shopId).catch(() => null),
        dripFlowsApi.getAll(shopId).catch(() => null),
        marketingApi.getEmailCampaigns(shopId).catch(() => null),
        marketingApi.getSmsCampaigns(shopId).catch(() => null),
        whatsappApi.listCampaigns(shopId).catch(() => null),
      ]).then(([leadsRes, flowsRes, emailRes, smsRes, waRes]) => {
        if (leadsRes) setLeadStats(leadsRes.data);
        if (flowsRes) setActiveFlows((flowsRes.data ?? []).filter((f: any) => f.is_active).length);
        const emailSent = (emailRes?.data ?? []).filter((c: any) => c.status === 'sent').length;
        const smsSent = (smsRes?.data ?? []).filter((c: any) => c.status === 'sent').length;
        const waSent = (waRes?.data?.campaigns ?? []).filter((c: any) => c.status === 'sent').length;
        setCampaignsSent(emailSent + smsSent + waSent);
      }).finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }

  if (locked) {
    return <MarketingHubLockScreen title="Marketing Overview" description="Available on TheDersi Lite, Pro, and Official." />;
  }

  const leadBreakdown = leadStats
    ? [
        { tier: 'Hot', count: leadStats.score_hot },
        { tier: 'Warm', count: leadStats.score_warm },
        { tier: 'Cold', count: leadStats.score_cold },
      ].filter((t) => t.count > 0)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Marketing Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">A launchpad across every marketing tool, plus your key numbers at a glance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Leads" value={(leadStats?.total ?? 0).toLocaleString()} icon={<Target className="w-5 h-5" />} />
        <KpiCard label="Hot Leads" value={(leadStats?.score_hot ?? 0).toLocaleString()}
          icon={<Flame className="w-5 h-5" />} iconClassName="bg-red-500/10 text-red-600" />
        <KpiCard label="Active Automations" value={activeFlows.toLocaleString()}
          icon={<GitBranch className="w-5 h-5" />} iconClassName="bg-violet-500/10 text-violet-600" />
        <KpiCard label="Campaigns Sent" value={campaignsSent.toLocaleString()}
          icon={<Send className="w-5 h-5" />} iconClassName="bg-blue-500/10 text-blue-600" />
      </div>

      {leadBreakdown.length > 0 && (
        <SectionCard title="Lead temperature" description="How your captured leads are scoring right now">
          <DonutChart data={leadBreakdown} category="count" index="tier" valueFormatter={(v) => v.toLocaleString()} label="leads" />
        </SectionCard>
      )}

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">All marketing tools</h2>
        <MarketingQuickLinks />
      </div>
    </div>
  );
}
