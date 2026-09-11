'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { channelsApi } from '@/lib/api';
import ChannelKPICards from './ChannelKPICards';
import SyncActivityChart from './SyncActivityChart';
import ConnectionDetailsCard from './ConnectionDetailsCard';
import RecentActivityCard from './RecentActivityCard';
import TopProductsCard from './TopProductsCard';
import type { ChannelDashboardData } from './types';

// The full real "Overview" tab for a channel's connected dashboard — one
// fetch to /channels/{channelType}/dashboard powers every section below.
// Reusable across channels: pass the channel-specific label/accent, the
// data underneath is already channel-scoped by the backend.
export default function ChannelDashboardOverview({
  shopId, channelType, channelLabel, siteUrl, accentColor = '#7c3aed', onDisconnected, refreshKey = 0,
}: {
  shopId: string;
  channelType: string;
  channelLabel: string;
  siteUrl?: string | null;
  accentColor?: string;
  onDisconnected: () => void;
  refreshKey?: number;
}) {
  const [data, setData] = useState<ChannelDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!shopId) return;
    setLoading(true);
    channelsApi.getChannelDashboard(shopId, channelType)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId, channelType, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Couldn't load this channel's dashboard. Try refreshing the page.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ChannelKPICards kpis={data.kpis} />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <ConnectionDetailsCard
          shopId={shopId}
          channelLabel={channelLabel}
          siteUrl={siteUrl}
          connection={data.connection}
          onDisconnected={onDisconnected}
          onWebhookRotated={(webhookUrl) => setData((d) => d ? { ...d, connection: { ...d.connection, webhook_url: webhookUrl } } : d)}
        />
        <SyncActivityChart daily={data.daily} accentColor={accentColor} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RecentActivityCard channelType={channelType} activity={data.recent_activity} />
        <TopProductsCard channelType={channelType} products={data.top_products} />
      </div>
    </div>
  );
}
