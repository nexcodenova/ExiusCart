'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { marketingApi, whatsappApi, socialPostingApi, subscriptionApi } from '@/lib/api';
import { normalizeEmail, normalizeSms, normalizeWhatsApp, normalizeSocial, UnifiedCampaign } from '@/components/campaigns/normalizeCampaigns';
import CampaignsTable from '@/components/campaigns/CampaignsTable';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketingHubLockScreen from '@/components/marketing/MarketingHubLockScreen';

function shopIdFromStorage() { return typeof window !== 'undefined' ? localStorage.getItem('shop_id') || '1' : '1'; }

const FILTERS: { key: UnifiedCampaign['channel'] | 'All'; label: string }[] = [
  { key: 'All', label: 'All' }, { key: 'Email', label: 'Email' }, { key: 'SMS', label: 'SMS' },
  { key: 'WhatsApp', label: 'WhatsApp' }, { key: 'Social', label: 'Social' },
];

// A read-only unified view over campaigns that already live in 4 separate
// tools (Email/SMS/WhatsApp/Social) — no new backend, just each tool's own
// already-existing list endpoint, normalized and merged client-side (see
// normalizeCampaigns.ts). Managing a campaign still happens on its own
// dedicated page — this is a timeline to see everything at once, not a
// second place to edit them.
export default function CampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [campaigns, setCampaigns] = useState<UnifiedCampaign[]>([]);
  const [filter, setFilter] = useState<typeof FILTERS[number]['key']>('All');

  useEffect(() => {
    const shopId = shopIdFromStorage();
    subscriptionApi.getCurrent(shopId).then((r) => {
      if (r.data?.plan?.plan_type === 'thedersi_free_forever') { setLocked(true); setLoading(false); return; }
      Promise.all([
        marketingApi.getEmailCampaigns(shopId).catch(() => ({ data: [] })),
        marketingApi.getSmsCampaigns(shopId).catch(() => ({ data: [] })),
        whatsappApi.listCampaigns(shopId).catch(() => ({ data: { campaigns: [] } })),
        socialPostingApi.listPosts(shopId).catch(() => ({ data: { posts: [] } })),
      ]).then(([emailRes, smsRes, waRes, socialRes]) => {
        const all = [
          ...normalizeEmail(emailRes.data ?? []),
          ...normalizeSms(smsRes.data ?? []),
          ...normalizeWhatsApp(waRes.data?.campaigns ?? []),
          ...normalizeSocial(socialRes.data?.posts ?? []),
        ].sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        setCampaigns(all);
      }).finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (filter === 'All' ? campaigns : campaigns.filter((c) => c.channel === filter)),
    [campaigns, filter],
  );

  if (!loading && locked) {
    return <MarketingHubLockScreen title="Campaigns" description="Available on TheDersi Lite, Pro, and Official." />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
        <p className="text-sm text-muted-foreground mt-1">Every Email, SMS, WhatsApp, and Social campaign in one timeline.</p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.key} value={f.key}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : (
        <CampaignsTable campaigns={filtered} />
      )}
    </div>
  );
}
