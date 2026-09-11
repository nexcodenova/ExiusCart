// Shared shape for GET /shops/{shopId}/channels/{channelType}/dashboard —
// every field here traces to a real column/query on the backend (see
// channels.py's get_channel_dashboard), nothing fabricated for display.

export interface ChannelDashboardConnection {
  id: number;
  channel_seller_id: string | null;
  channel_api_url: string | null;
  channel_currency: string | null;
  seller_status: string | null;
  webhook_url: string;
  created_at: string | null;
  last_synced_at: string | null;
  auto_payout_enabled: boolean;
}

export interface ChannelDashboardKPIs {
  total_orders: number;
  revenue: number;
  products_listed: number;
  last_synced_at: string | null;
}

export interface ChannelDailyPoint {
  day: string;
  orders: number;
  revenue: number;
}

export interface ChannelActivityItem {
  kind: 'product' | 'order';
  title: string;
  description: string;
  success: boolean;
  image_url: string | null;
  created_at: string;
}

export interface ChannelTopProduct {
  product_id: number | null;
  name: string;
  image_url: string | null;
  orders: number;
  revenue: number;
  growth_pct: number | null;
}

export interface ChannelDashboardData {
  channel_type: string;
  connection: ChannelDashboardConnection;
  kpis: ChannelDashboardKPIs;
  daily: ChannelDailyPoint[];
  recent_activity: ChannelActivityItem[];
  top_products: ChannelTopProduct[];
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
