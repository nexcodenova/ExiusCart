'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  Store,
  Users,
  CreditCard,
  Package,
  Loader2,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface MonthlyRevenue {
  month: string;
  value: number;
}

interface TopShop {
  name: string;
  revenue: number;
}

interface PlanDist {
  plan: string;
  count: number;
  percentage: number;
}

interface QuickStats {
  new_shops: number;
  new_users: number;
  payments_count: number;
  avg_revenue_per_shop: number;
  total_revenue: number;
}

interface ReportsData {
  monthly_revenue: MonthlyRevenue[];
  top_shops: TopShop[];
  plan_distribution: PlanDist[];
  quick_stats: QuickStats;
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-gray-500',
  business: 'bg-blue-500',
  pro: 'bg-[#F5A623]',
};

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('last_30_days');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await adminApi.getReports({ date_range: dateRange });
        setData(res.data);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#F5A623]" />
      </div>
    );
  }

  const monthly = data?.monthly_revenue ?? [];
  const topShops = data?.top_shops ?? [];
  const planDist = data?.plan_distribution ?? [];
  const qs = data?.quick_stats;

  const maxRevenue = Math.max(...monthly.map((m) => m.value), 1);

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-gray-400 text-sm mt-1">Analytics and insights for your platform</p>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2.5 bg-[#151F32] border border-gray-700 rounded-lg text-white focus:border-[#F5A623] focus:outline-none transition appearance-none cursor-pointer"
          >
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="last_90_days">Last 90 days</option>
            <option value="this_year">This Year</option>
          </select>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 bg-[#F5A623] hover:bg-[#E09612] text-black font-semibold px-4 py-2.5 rounded-lg transition"
          >
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Revenue"
          value={qs ? `${qs.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED` : '—'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          label="New Shops"
          value={qs ? String(qs.new_shops) : '—'}
          icon={<Store className="w-5 h-5" />}
        />
        <StatCard
          label="Payments (period)"
          value={qs ? String(qs.payments_count) : '—'}
          icon={<Package className="w-5 h-5" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Revenue Overview</h3>
              <p className="text-sm text-gray-500">Monthly revenue trend</p>
            </div>
            <BarChart3 className="w-5 h-5 text-[#F5A623]" />
          </div>
          {monthly.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              No revenue data for this period
            </div>
          ) : (
            <div className="flex items-end justify-between gap-2 h-48">
              {monthly.map((item, index) => {
                const heightPercentage = (item.value / maxRevenue) * 100;
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className={`w-full rounded-t-lg transition-all ${
                        index === monthly.length - 1 ? 'bg-[#F5A623]' : 'bg-[#F5A623]/30'
                      }`}
                      style={{ height: `${heightPercentage}%` }}
                    />
                    <span className="text-xs text-gray-500">{item.month}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Total this period</span>
              <span className="text-lg font-semibold text-white">
                {monthly.reduce((sum, m) => sum + m.value, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} AED
              </span>
            </div>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Plan Distribution</h3>
              <p className="text-sm text-gray-500">Active subscriptions by plan</p>
            </div>
            <Package className="w-5 h-5 text-[#F5A623]" />
          </div>
          {planDist.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
              No active subscriptions
            </div>
          ) : (
            <div className="space-y-4">
              {planDist.map((plan) => {
                const colorClass = PLAN_COLORS[plan.plan.toLowerCase()] ?? 'bg-gray-500';
                return (
                  <div key={plan.plan}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300 capitalize">{plan.plan}</span>
                      <span className="text-sm text-gray-400">
                        {plan.count} shops ({plan.percentage}%)
                      </span>
                    </div>
                    <div className="h-3 bg-[#0B1121] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colorClass}`}
                        style={{ width: `${plan.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-6 pt-4 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Total active</span>
              <span className="text-lg font-semibold text-white">
                {planDist.reduce((sum, p) => sum + p.count, 0)} subscriptions
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Shops */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Top Performing Shops</h3>
            <p className="text-sm text-gray-500">Ranked by revenue</p>
          </div>
        </div>

        {topShops.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">No shop data available</p>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                    <th className="pb-3 font-medium">Rank</th>
                    <th className="pb-3 font-medium">Shop Name</th>
                    <th className="pb-3 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topShops.map((shop, index) => (
                    <tr key={shop.name} className="border-b border-gray-800 last:border-0">
                      <td className="py-4">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                            index === 0
                              ? 'bg-[#F5A623]/10 text-[#F5A623]'
                              : index === 1
                              ? 'bg-gray-400/10 text-gray-400'
                              : index === 2
                              ? 'bg-orange-400/10 text-orange-400'
                              : 'bg-gray-700/50 text-gray-500'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#F5A623]/10 rounded-lg flex items-center justify-center">
                            <Store className="w-5 h-5 text-[#F5A623]" />
                          </div>
                          <span className="font-medium text-white">{shop.name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-right font-semibold text-white">
                        {shop.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {topShops.map((shop, index) => (
                <div key={shop.name} className="bg-[#0B1121] rounded-lg p-4 flex items-center gap-4">
                  <span
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                      index === 0
                        ? 'bg-[#F5A623]/10 text-[#F5A623]'
                        : index === 1
                        ? 'bg-gray-400/10 text-gray-400'
                        : index === 2
                        ? 'bg-orange-400/10 text-orange-400'
                        : 'bg-gray-700/50 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{shop.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">
                      {shop.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-500">AED</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <QuickStatCard
          label="New Shops (period)"
          value={qs ? String(qs.new_shops) : '—'}
          icon={<Store className="w-5 h-5" />}
        />
        <QuickStatCard
          label="New Users (period)"
          value={qs ? String(qs.new_users) : '—'}
          icon={<Users className="w-5 h-5" />}
        />
        <QuickStatCard
          label="Payments (period)"
          value={qs ? String(qs.payments_count) : '—'}
          icon={<CreditCard className="w-5 h-5" />}
        />
        <QuickStatCard
          label="Avg. Revenue/Shop"
          value={qs ? `${qs.avg_revenue_per_shop.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED` : '—'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg bg-[#F5A623]/10 text-[#F5A623]">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function QuickStatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gray-500/10 text-gray-400">{icon}</div>
        <div>
          <p className="text-lg font-bold text-white">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
