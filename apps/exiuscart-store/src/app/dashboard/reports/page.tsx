'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3, TrendingUp, DollarSign, ShoppingCart, FileText, Package, Trophy, Boxes, CalendarDays,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { reportsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

const PIE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#14b8a6'];

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
    const now = new Date(); const from = new Date();
    if (period === 'week') from.setDate(now.getDate() - 7);
    else if (period === 'month') from.setMonth(now.getMonth() - 1);
    else from.setFullYear(now.getFullYear() - 1);
    Promise.all([
      reportsApi.getSalesReport(shopId, { from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] }),
      reportsApi.getTopProducts(shopId),
    ])
      .then(([s, t]) => { setSalesData(s.data ?? []); setTopProducts(t.data ?? []); })
      .catch(() => { setSalesData([]); setTopProducts([]); })
      .finally(() => setLoading(false));
  }, [shopId, period]);

  const totalSales = salesData.reduce((s, d) => s + (d.sales ?? 0), 0);
  const totalOrders = salesData.reduce((s, d) => s + (d.orders ?? 0), 0);
  const avgOrder = totalOrders ? totalSales / totalOrders : 0;
  const unitsSold = topProducts.reduce((s, p) => s + (p.quantity ?? 0), 0);
  const bestDay = salesData.reduce((b, d) => (d.sales ?? 0) > (b?.sales ?? -1) ? d : b, null as any);

  const chart = salesData.map((d) => ({
    label: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    sales: Math.round(d.sales ?? 0), orders: d.orders ?? 0,
  }));
  const pieData = topProducts.slice(0, 6).map((p) => ({ name: p.name, value: Math.round(p.revenue ?? 0) }));
  const maxRev = Math.max(1, ...topProducts.map((p) => p.revenue ?? 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Sales performance & product insights</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
            {(['week', 'month', 'year'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {p}
              </button>
            ))}
          </div>
          <Link href="/dashboard/reports/vat" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
            <FileText className="h-4 w-4" /> VAT
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={DollarSign} label="Total sales" value={loading ? '—' : fmt(totalSales, 0)} />
        <Kpi icon={ShoppingCart} label="Orders" value={loading ? '—' : String(totalOrders)} />
        <Kpi icon={TrendingUp} label="Avg. order" value={loading || !totalOrders ? '—' : fmt(Math.round(avgOrder), 0)} />
        <Kpi icon={Boxes} label="Units sold" value={loading ? '—' : String(unitsSold)} />
        <Kpi icon={CalendarDays} label="Best day" value={loading || !bestDay ? '—' : new Date(bestDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} sub={bestDay ? fmt(bestDay.sales, 0) : ''} />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8"><div className="h-80 animate-pulse rounded-xl bg-muted/40" /></div>
      ) : chart.length === 0 ? (
        <Empty />
      ) : (
        <>
          {/* Hero: composed sales + orders, dual axis */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">Sales & orders</h2>
                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{fmt(totalSales, 0)}</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Sales</span>
                <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Orders</span>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rsales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={56} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                  <Tooltip content={<Tip fmt={fmt} />} />
                  <Area yAxisId="l" type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2.5} fill="url(#rsales)" dot={false} activeDot={{ r: 4 }} />
                  <Line yAxisId="r" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Orders bar + product mix */}
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="mb-1 font-semibold text-foreground">Orders by day</h2>
              <p className="mb-4 text-xs text-muted-foreground">Order volume across the period</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={20} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                    <Tooltip content={<Tip fmt={fmt} />} cursor={{ fill: '#6366f1', fillOpacity: 0.06 }} />
                    <Bar dataKey="orders" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="mb-1 font-semibold text-foreground">Product mix</h2>
              <p className="mb-2 text-xs text-muted-foreground">Revenue share by product</p>
              {pieData.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No product sales yet</div>
              ) : (
                <>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2} stroke="none">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                        </Pie>
                        <Tooltip content={<Tip fmt={fmt} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {pieData.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE[i % PIE.length] }} />
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
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Trophy className="h-4 w-4 text-amber-500" /> Top products</h2>
              <div className="space-y-4">
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
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${((p.revenue ?? 0) / maxRev) * 100}%` }} />
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

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><Icon className="h-4 w-4 text-foreground/70" /></div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Tip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
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

function Empty() {
  return (
    <div className="rounded-2xl border border-border bg-card p-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><BarChart3 className="h-7 w-7 text-muted-foreground" /></div>
      <h3 className="font-semibold text-foreground">No data yet</h3>
      <p className="text-sm text-muted-foreground">Charts will populate once you start making sales.</p>
    </div>
  );
}
