export interface DashboardStats {
  sales: number; salesChange: number; orders: number;
  products: number; customers: number;
  lowStockAlerts: { name: string; stock: number; min: number }[];
  recentOrders: { id: string; customer: string; amount: string; status: string; time: string }[];
  orderStatusBreakdown?: Record<string, number>;
  channelBreakdown?: { source: string; sales: number; orders: number }[];
  hourlyOrders?: { hour: number; orders: number; sales: number }[];
  topProducts?: { name: string; revenue: number; qty: number }[];
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
