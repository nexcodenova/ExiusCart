'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3, TrendingUp, DollarSign, ShoppingCart, FileText, Package, Trophy,
  Boxes, CalendarDays, Zap, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { reportsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

const PIE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#14b8a6'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CHANNEL_LABELS: Record<string, string> = {
  pos: 'POS (In-store)',
  thedersi: 'TheDersi',
  online: 'Online Store',
  manual: 'Manual',
  unknown: 'Other',
};
const CHANNEL_COLORS: Record<string, string> = {
  pos: '#10b981',
  thedersi: '#6366f1',
  online: '#0ea5e9',
  manual: '#f59e0b',
  unknown: '#94a3b8',
};

export default function ReportsPage() {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [channelRevenue, setChannelRevenue] = useState<any[]>([]);
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
    const fromStr = from.toISOString().split('T')[0];
    const toStr = now.toISOString().split('T')[0];
    Promise.all([
      reportsApi.getSalesReport(shopId, { from: fromStr, to: toStr }),
      reportsApi.getTopProducts(shopId),
      reportsApi.getChannelRevenue(shopId, { from: fromStr, to: toStr }),
    ])
      .then(([s, t, c]) => { setSalesData(s.data ?? []); setTopProducts(t.data ?? []); setChannelRevenue(c.data ?? []); })
      .catch(() => { setSalesData([]); setTopProducts([]); setChannelRevenue([]); })
      .finally(() => setLoading(false));
  }, [shopId, period]);

  const totalSales = salesData.reduce((s, d) => s + (d.sales ?? 0), 0);
  const totalOrders = salesData.reduce((s, d) => s + (d.orders ?? 0), 0);
  const avgOrder = totalOrders ? totalSales / totalOrders : 0;
  const unitsSold = topProducts.reduce((s, p) => s + (p.quantity ?? 0), 0);
  const bestDay = salesData.reduce((b, d) => (d.sales ?? 0) > (b?.sales ?? -1) ? d : b, null as any);
  const avgDailySales = salesData.length ? totalSales / salesData.length : 0;

  // Second-half vs first-half delta for trend badges
  const mid = Math.floor(salesData.length / 2);
  const firstHalf = salesData.slice(0, mid);
  const secondHalf = salesData.slice(mid);
  const halfDelta = (cur: number, prev: number) => prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
  const salesDelta = halfDelta(
    secondHalf.reduce((s, d) => s + (d.sales ?? 0), 0),
    firstHalf.reduce((s, d) => s + (d.sales ?? 0), 0),
  );
  const ordersDelta = halfDelta(
    secondHalf.reduce((s, d) => s + (d.orders ?? 0), 0),
    firstHalf.reduce((s, d) => s + (d.orders ?? 0), 0),
  );

  // Chart data
  const chart = salesData.map((d) => ({
    label: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    sales: Math.round(d.sales ?? 0),
    orders: d.orders ?? 0,
  }));

  // Day-of-week aggregation (avg per day)
  const dowMap: Record<number, { sales: number; orders: number; count: number }> = {};
  for (let i = 0; i < 7; i++) dowMap[i] = { sales: 0, orders: 0, count: 0 };
  salesData.forEach((d) => {
    const dow = new Date(d.date).getDay();
    dowMap[dow].sales += d.sales ?? 0;
    dowMap[dow].orders += d.orders ?? 0;
    dowMap[dow].count++;
  });
  const dowChart = DAYS.map((name, i) => ({
    name,
    sales: dowMap[i].count ? Math.round(dowMap[i].sales / dowMap[i].count) : 0,
  }));
  const bestDow = dowChart.reduce((b, d) => d.sales > b.sales ? d : b, dowChart[0]);

  const pieData = topProducts.slice(0, 6).map((p) => ({ name: p.name, value: Math.round(p.revenue ?? 0) }));
  const maxRev = Math.max(1, ...topProducts.map((p) => p.revenue ?? 0));

  // Auto-insights (no AI — pure arithmetic)
  const insights: string[] = [];
  if (bestDow?.sales > 0) insights.push(`${bestDow.name} is your strongest day, averaging ${fmt(bestDow.sales, 0)} in revenue.`);
  if (topProducts[0]) insights.push(`"${topProducts[0].name}" is your top product — ${Math.round(((topProducts[0].revenue ?? 0) / (totalSales || 1)) * 100)}% of total revenue.`);
  if (salesDelta !== null) insights.push(`Revenue ${salesDelta >= 0 ? 'grew' : 'fell'} ${Math.abs(salesDelta)}% in the second half of this period vs the first.`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Sales performance &amp; product insights</p>
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard icon={DollarSign} label="Total sales" value={loading ? '—' : fmt(totalSales, 0)} delta={loading ? null : salesDelta} />
        <KpiCard icon={ShoppingCart} label="Orders" value={loading ? '—' : String(totalOrders)} delta={loading ? null : ordersDelta} />
        <KpiCard icon={TrendingUp} label="Avg. order" value={loading || !totalOrders ? '—' : fmt(Math.round(avgOrder), 0)} />
        <KpiCard icon={Boxes} label="Units sold" value={loading ? '—' : String(unitsSold)} />
        <KpiCard
          icon={CalendarDays}
          label="Best day"
          value={loading || !bestDay ? '—' : new Date(bestDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          sub={bestDay ? fmt(bestDay.sales, 0) : ''}
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8">
          <div className="h-80 animate-pulse rounded-xl bg-muted/40" />
        </div>
      ) : chart.length === 0 ? (
        <Empty />
      ) : (
        <>
          {/* Insights strip */}
          {insights.length > 0 && (
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-foreground">Period insights</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {insights.map((text, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                ))}
              </div>
            </div>
          )}

          {/* Hero: revenue trend + orders dual axis */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">Revenue trend</h2>
                <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">{fmt(totalSales, 0)}</p>
                {salesDelta !== null && (
                  <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${salesDelta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {salesDelta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(salesDelta)}% vs first half of period
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Revenue
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Orders
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-px w-5 border-t-2 border-dashed border-indigo-400 opacity-60" /> Daily avg
                </span>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rsales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={56} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                  <Tooltip content={<Tip fmt={fmt} />} />
                  <ReferenceLine yAxisId="l" y={avgDailySales} stroke="#6366f1" strokeDasharray="6 3" strokeOpacity={0.45} />
                  <Area yAxisId="l" type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2.5} fill="url(#rsales)" dot={false} activeDot={{ r: 4 }} />
                  <Line yAxisId="r" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Day-of-week + product mix */}
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="mb-1 font-semibold text-foreground">Day-of-week performance</h2>
              <p className="mb-4 text-xs text-muted-foreground">Average revenue earned per day of the week — best day highlighted</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dowChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={56} />
                    <Tooltip content={<Tip fmt={fmt} />} cursor={{ fill: '#6366f1', fillOpacity: 0.06 }} />
                    <Bar dataKey="sales" radius={[6, 6, 0, 0]} maxBarSize={52}>
                      {dowChart.map((d, i) => (
                        <Cell key={i} fill={d.name === bestDow?.name ? '#6366f1' : '#6366f118'} />
                      ))}
                    </Bar>
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

          {/* Revenue per channel */}
          {channelRevenue.length > 0 && (() => {
            const totalChRev = channelRevenue.reduce((s, c) => s + c.revenue, 0);
            return (
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h2 className="mb-1 font-semibold text-foreground">Revenue by channel</h2>
                <p className="mb-5 text-xs text-muted-foreground">Where your revenue is coming from this period</p>
                <div className="space-y-3">
                  {channelRevenue
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((ch) => {
                      const label = CHANNEL_LABELS[ch.source] ?? ch.source;
                      const color = CHANNEL_COLORS[ch.source] ?? '#94a3b8';
                      const pct = totalChRev > 0 ? (ch.revenue / totalChRev) * 100 : 0;
                      return (
                        <div key={ch.source}>
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="flex items-center gap-2 text-foreground font-medium">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                              {label}
                            </span>
                            <span className="flex items-center gap-3 tabular-nums">
                              <span className="text-xs text-muted-foreground">{ch.orders} orders</span>
                              <span className="font-semibold text-foreground">{fmt(ch.revenue, 0)}</span>
                              <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(pct)}%</span>
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })()}

          {/* Top products — 2-column grid, gold/silver/bronze ranks */}
          {topProducts.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="mb-5 flex items-center gap-2 font-semibold text-foreground">
                <Trophy className="h-4 w-4 text-amber-500" /> Top products
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {topProducts.slice(0, 6).map((p, i) => {
                  const rankCls = i === 0
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                    : i === 1
                    ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-300'
                    : i === 2
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400'
                    : 'bg-muted text-muted-foreground';
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 truncate pr-2 text-foreground">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${rankCls}`}>{i + 1}</span>
                          {p.name}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-foreground">{fmt(p.revenue ?? 0, 0)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${((p.revenue ?? 0) / maxRev) * 100}%` }} />
                        </div>
                        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{p.quantity} sold</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, delta }: {
  icon: React.ElementType; label: string; value: string; sub?: string; delta?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-foreground/70" />
        </div>
        {delta !== null && delta !== undefined && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${delta >= 0 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-500'}`}>
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
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
          {p.name === 'sales' ? 'Revenue' : p.name === 'orders' ? 'Orders' : p.name === 'sales' ? 'Avg revenue' : p.name}:{' '}
          <span className="font-semibold text-foreground">
            {p.name === 'orders' ? p.value : fmt(p.value, 0)}
          </span>
        </p>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-border bg-card p-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <BarChart3 className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-foreground">No data yet</h3>
      <p className="text-sm text-muted-foreground">Charts will populate once you start making sales.</p>
    </div>
  );
}
