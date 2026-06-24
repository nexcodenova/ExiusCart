'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3, TrendingUp, DollarSign, ShoppingCart, FileText, Package, Trophy,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { reportsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#ec4899'];

export default function ReportsPage() {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { fmt } = useCurrency();

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    const now = new Date();
    const from = new Date();
    if (period === 'week') from.setDate(now.getDate() - 7);
    else if (period === 'month') from.setMonth(now.getMonth() - 1);
    else from.setFullYear(now.getFullYear() - 1);

    Promise.all([
      reportsApi.getSalesReport(shopId, { from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] }),
      reportsApi.getTopProducts(shopId),
    ])
      .then(([salesRes, topRes]) => {
        setSalesData(salesRes.data ?? []);
        setTopProducts(topRes.data ?? []);
      })
      .catch(() => { setSalesData([]); setTopProducts([]); })
      .finally(() => setLoading(false));
  }, [shopId, period]);

  const totalSales = salesData.reduce((s, d) => s + (d.sales ?? 0), 0);
  const totalOrders = salesData.reduce((s, d) => s + (d.orders ?? 0), 0);
  const avgOrder = totalOrders ? totalSales / totalOrders : 0;

  const chartData = salesData.map((d) => ({
    label: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    sales: Math.round(d.sales ?? 0),
    orders: d.orders ?? 0,
  }));

  const pieData = topProducts.slice(0, 6).map((p) => ({ name: p.name, value: Math.round(p.revenue ?? 0) }));
  const maxProductRevenue = Math.max(1, ...topProducts.map((p) => p.revenue ?? 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Analytics & performance insights</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                period === p
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                  : 'bg-muted text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400'
              }`}>
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'This Year'}
            </button>
          ))}
          <Link href="/dashboard/reports/vat"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-muted transition">
            <FileText className="w-4 h-4" /> VAT Report
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard featured label="Total Sales" value={loading ? '—' : fmt(totalSales, 0)} icon={<DollarSign className="w-5 h-5" />} />
        <StatCard label="Total Orders" value={loading ? '—' : String(totalOrders)} icon={<ShoppingCart className="w-5 h-5" />} />
        <StatCard label="Avg. Order" value={loading || !totalOrders ? '—' : fmt(Math.round(avgOrder), 0)} icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="Top Products" value={loading ? '—' : String(topProducts.length)} icon={<Package className="w-5 h-5" />} />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm"><div className="h-72 rounded-xl bg-muted animate-pulse" /></div>
      ) : chartData.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Hero: sales trend area chart */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Sales Trend</h2>
                <p className="text-xs text-muted-foreground">Revenue over the selected period</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">{fmt(totalSales, 0)}</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip content={<ChartTooltip fmt={fmt} />} />
                  <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2.5} fill="url(#salesGrad)" dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two-up: orders bar + product mix pie */}
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-1 font-semibold text-foreground">Orders by Day</h2>
              <p className="mb-4 text-xs text-muted-foreground">Volume of orders over the period</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ fill: '#6366f1', fillOpacity: 0.06 }} />
                    <Bar dataKey="orders" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-1 font-semibold text-foreground">Product Mix</h2>
              <p className="mb-2 text-xs text-muted-foreground">Revenue share by product</p>
              {pieData.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No product sales yet</div>
              ) : (
                <>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2} stroke="none">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip fmt={fmt} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {pieData.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="flex-1 truncate text-muted-foreground">{p.name}</span>
                        <span className="font-medium text-foreground">{fmt(p.value, 0)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top products ranked */}
          {topProducts.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Trophy className="w-4 h-4 text-amber-500" /> Top Products</h2>
              <div className="space-y-3.5">
                {topProducts.slice(0, 6).map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 truncate pr-2 text-foreground">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                        {p.name}
                      </span>
                      <span className="shrink-0 font-semibold text-foreground">{fmt(p.revenue ?? 0, 0)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${((p.revenue ?? 0) / maxProductRevenue) * 100}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{p.quantity} sold</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, featured }: { label: string; value: string; icon: React.ReactNode; featured?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
      featured ? 'border-transparent bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/25' : 'border-border bg-card'
    }`}>
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${featured ? 'bg-white/20' : 'bg-indigo-500/5'}`} />
      <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${featured ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'}`}>{icon}</div>
      <p className={`relative mt-3 text-xs font-medium ${featured ? 'text-white/80' : 'text-muted-foreground'}`}>{label}</p>
      <p className={`relative mt-0.5 text-2xl font-bold tracking-tight ${featured ? 'text-white' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      {label && <p className="mb-1 text-xs font-medium text-foreground">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs text-muted-foreground">
          {p.name === 'sales' ? 'Sales' : p.name === 'orders' ? 'Orders' : p.name}:{' '}
          <span className="font-semibold text-foreground">{p.name === 'orders' ? p.value : fmt(p.value, 0)}</span>
        </p>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-card p-16 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
        <BarChart3 className="h-7 w-7 text-indigo-500" />
      </div>
      <h3 className="font-semibold text-foreground">No data yet</h3>
      <p className="text-sm text-muted-foreground">Charts will populate once you start making sales.</p>
    </div>
  );
}
