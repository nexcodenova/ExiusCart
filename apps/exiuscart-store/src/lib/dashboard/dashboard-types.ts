export interface DashboardStats {
  shopName?: string; period?: string;
  sales: number; salesChange: number; orders: number;
  products: number; customers: number;
  lowStockAlerts: { name: string; stock: number; min: number }[];
  recentOrders: { id: string; customer: string; amount: string; status: string; time: string }[];
  orderStatusBreakdown?: Record<string, number>;
  channelBreakdown?: { source: string; sales: number; orders: number }[];
  hourlyOrders?: { hour: number; orders: number; sales: number }[];
  topProducts?: { name: string; revenue: number; qty: number; image_url?: string | null }[];
  avgOrderValue?: number; fulfillmentRate?: number; cancellationRate?: number;
  thisMonthRevenue?: number; lastMonthRevenue?: number; revenueMoM?: number;
  newCustomersMonth?: number;
  dailyBreakdown?: { day: string; orders: number; sales: number }[];
  // Advanced
  allTimeRevenue?: number; allTimeOrders?: number; memberSince?: string;
  thisWeekRevenue?: number; thisWeekOrders?: number;
  thisYearRevenue?: number; thisYearOrders?: number;
  todayAvgOrder?: number;
  monthlyRevenue12m?: { month: string; revenue: number; orders: number; growth: number }[];
  repeatCustomerRate?: number; inventoryValue?: number; outOfStockCount?: number;
  topCustomers?: { id: number; name: string; orders: number; revenue: number }[];
  // Real, added for the country/notifications/store-health rebuild
  customersByCountry?: { code: string; country: string; customers: number; percentage: number }[];
  recentCustomers?: { id: number; name: string; orders: number; total: number; date: string | null }[];
  storeHealth?: { channelsConnected: number; lastSyncedAt: string | null };
  // Real, period-filtered numbers driven by the date-range selector —
  // separate from allTime*/monthlyRevenue12m so those keep their own fixed
  // meaning regardless of what period is selected.
  periodRevenue?: number;
  periodOrders?: number;
  periodRevenueChange?: number | null;
  periodOrdersChange?: number | null;
  periodTrend?: { label: string; revenue: number; orders: number; growth: number }[];
}

export type DashboardPeriod = '7d' | '30d' | '90d' | '12m' | 'all';

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
  all: 'All time',
};

export interface ActivityEvent {
  id: number;
  event_type: string;
  title: string;
  description: string | null;
  order_id: number | null;
  created_at: string | null;
  is_read: boolean;
}
