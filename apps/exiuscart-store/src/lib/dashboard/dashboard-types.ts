import type { DateRangeValue } from '@/components/channels/listings/DateRangePicker';

export interface DashboardStats {
  shopName?: string; period?: string;
  sales: number; salesChange: number; orders: number;
  products: number; customers: number;
  lowStockAlerts: { name: string; stock: number; min: number }[];
  recentOrders: { id: string; customer: string; amount: string; status: string; time: string; items?: number }[];
  orderStatusBreakdown?: Record<string, number>;
  channelBreakdown?: { source: string; sales: number; orders: number }[];
  activityWindow?: string;
  activityBuckets?: { label: string; orders: number; sales: number }[];
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
  // Real orders-by-country, joined through Customer.country and respecting
  // the same period filter as periodRevenue/periodOrders. "customers" here
  // is reused as the generic count field so both metrics share one row shape.
  ordersByCountry?: { code: string; country: string; customers: number; percentage: number }[];
  // Real storefront product views by visitor country (Custom Website channel only).
  viewsByCountry?: { code: string; country: string; customers: number; percentage: number }[];
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
  // Real conversion rate — Custom Website channel only (StorefrontEvent
  // tracking can't see Shopify/eBay/etc.'s own frontend). null when there
  // simply aren't any tracked views yet, not a fabricated 0%.
  storefrontConversion?: number | null;
  storefrontConversionChange?: number | null;
  storefrontViews?: number;
}

// Converts the shared DateRangePicker's value (same one Orders/Channel
// Orders already use) into this endpoint's query params — a preset maps to
// the fast `period` keyword path server-side, 'custom' sends explicit
// date_from/date_to instead.
export function dateRangeToStatsParams(range: DateRangeValue): { period?: string; date_from?: string; date_to?: string } {
  if (range.preset === 'custom') return { date_from: range.from, date_to: range.to };
  const map: Record<Exclude<DateRangeValue['preset'], 'custom'>, string> = {
    all: 'all', today: '7d', '7': '7d', '30': '30d', '90': '90d', '365': '12m',
  };
  if (range.preset === 'today') {
    return { date_from: new Date().toISOString().slice(0, 10), date_to: new Date().toISOString().slice(0, 10) };
  }
  return { period: map[range.preset] };
}

export interface ActivityEvent {
  id: number;
  event_type: string;
  title: string;
  description: string | null;
  order_id: number | null;
  created_at: string | null;
  is_read: boolean;
}
