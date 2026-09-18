'use client';

import { useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import type { DashboardStats, DashboardPeriod } from '@/lib/dashboard/dashboard-types';

import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { OverviewCards } from '@/components/dashboard/overview-cards';
import { RevenueTrend } from '@/components/dashboard/revenue-trend';
import { RevenueByChannel } from '@/components/dashboard/revenue-by-channel';
import { OrdersByStatus } from '@/components/dashboard/orders-by-status';
import { PerformanceRow } from '@/components/dashboard/performance-row';
import { BusinessHealth } from '@/components/dashboard/business-health';
import { OrderActivityCharts } from '@/components/dashboard/order-activity-charts';
import { TopCustomers } from '@/components/dashboard/top-customers';
import { RecentOrdersPanel } from '@/components/dashboard/recent-orders-panel';
import { TopProductsPanel } from '@/components/dashboard/top-products-panel';
import { StockAlertsPanel } from '@/components/dashboard/stock-alerts-panel';
import { CustomersByCountry } from '@/components/dashboard/customers-by-country';
import { RecentCustomersPanel } from '@/components/dashboard/recent-customers-panel';
import { SystemNotifications } from '@/components/dashboard/system-notifications';

function shopIdFromStorage() {
  return typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
}

export default function DashboardPage() {
  const [shopId, setShopId] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { fmt } = useCurrency();

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    setLoading(true);
    dashboardApi.getStats(shopId, period)
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId, period]);

  const refresh = () => {
    if (!shopId) return;
    setRefreshing(true);
    dashboardApi.getStats(shopId, period)
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        storeName={stats?.shopName}
        memberSince={stats?.memberSince}
        channelsConnected={stats?.storeHealth?.channelsConnected}
        lastSyncedAt={stats?.storeHealth?.lastSyncedAt}
        refreshing={refreshing}
        onRefresh={refresh}
        period={period}
        onPeriodChange={setPeriod}
      />

      <OverviewCards stats={stats} loading={loading} fmt={fmt} period={period} />

      <div className="grid gap-5 lg:grid-cols-3">
        <RevenueTrend stats={stats} loading={loading} fmt={fmt} />
        <RevenueByChannel stats={stats} fmt={fmt} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <OrdersByStatus stats={stats} />
        <TopProductsPanel stats={stats} fmt={fmt} />
        <CustomersByCountry stats={stats} />
      </div>

      <PerformanceRow stats={stats} loading={loading} fmt={fmt} />
      <BusinessHealth stats={stats} loading={loading} fmt={fmt} />
      <OrderActivityCharts stats={stats} />

      <div className="grid gap-5 lg:grid-cols-3">
        <TopCustomers stats={stats} fmt={fmt} />
        <RecentOrdersPanel stats={stats} loading={loading} fmt={fmt} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <RecentCustomersPanel stats={stats} fmt={fmt} />
        <StockAlertsPanel stats={stats} loading={loading} />
        {shopId && <SystemNotifications shopId={shopId} />}
      </div>
    </div>
  );
}
