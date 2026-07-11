'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag, Package, Users, ArrowUp, ArrowDown, AlertTriangle,
  ShoppingCart, Plus, FileText, BarChart3, Wallet, TrendingUp,
  Activity, Target, XCircle, UserPlus, CalendarDays, Boxes,
  RefreshCw, Star, Layers, BadgeDollarSign, Clock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, PieChart, Pie,
} from 'recharts';
import { dashboardApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface DashboardStats {
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
}

const CHANNEL_LABELS: Record<string, string> = {
  pos: 'Point of Sale', thedersi: 'TheDersi', whatsapp: 'WhatsApp',
  online: 'Online Store', shopify: 'Shopify', channel: 'Marketplace', manual: 'Manual',
};
const CHANNEL_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
  shipped: '#06b6d4', delivered: '#10b981', cancelled: '#ef4444',
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function buildHourly(data: { hour: number; orders: number; sales: number }[]) {
  const now = new Date();
  const map = Object.fromEntries(data.map(d => [d.hour, d]));
  return Array.from({ length: 24 }, (_, i) => {
    const h = (now.getHours() - 23 + i + 24) % 24;
    return { label: `${h}:00`, orders: map[h]?.orders ?? 0, sales: map[h]?.sales ?? 0 };
  });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { fmt } = useCurrency();

  useEffect(() => {
    const shopId = localStorage.getItem('shop_id');
    if (!shopId) { setLoading(false); return; }
    dashboardApi.getStats(shopId)
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const statusPie = Object.entries(stats?.orderStatusBreakdown ?? {}).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1), value: v, color: STATUS_COLORS[k] ?? '#94a3b8',
  }));
  const totalOrders = statusPie.reduce((s, d) => s + d.value, 0);

  const channelPie = (stats?.channelBreakdown ?? []).map((c, i) => ({
    name: CHANNEL_LABELS[c.source] ?? c.source,
    value: Math.round(c.sales), orders: c.orders,
    color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
  }));
  const channelTotal = channelPie.reduce((s, d) => s + d.value, 0);

  const hourly = buildHourly(stats?.hourlyOrders ?? []);
  const maxMonthRev = Math.max(...(stats?.monthlyRevenue12m ?? []).map(m => m.revenue), 1);

  const L = loading;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting()}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{today}</p>
          {stats?.memberSince && (
            <p className="mt-0.5 text-xs text-muted-foreground">Member since {stats.memberSince}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setLoading(true); const id = localStorage.getItem('shop_id'); if (id) dashboardApi.getStats(id).then(r => setStats(r.data)).finally(() => setLoading(false)); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <Link href="/dashboard/pos"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90">
            <ShoppingCart className="h-4 w-4" /> New sale
          </Link>
        </div>
      </div>

      {/* ── Lifetime banner ── */}
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 to-violet-500/5 p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Star className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-foreground">All-time totals</span>
          {stats?.memberSince && <span className="text-xs text-muted-foreground ml-1">since {stats.memberSince}</span>}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Total revenue</p>
            <p className="text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{L ? '—' : fmt(stats?.allTimeRevenue ?? 0, 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total orders</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{L ? '—' : (stats?.allTimeOrders ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total customers</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{L ? '—' : (stats?.customers ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active products</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{L ? '—' : (stats?.products ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Revenue period breakdown ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Revenue</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <PeriodCard label="Today" value={L ? '—' : fmt(stats?.sales ?? 0, 0)} delta={stats?.salesChange} icon={Wallet} color="indigo" />
          <PeriodCard label="This week" value={L ? '—' : fmt(stats?.thisWeekRevenue ?? 0, 0)} icon={CalendarDays} color="violet" />
          <PeriodCard label="This month" value={L ? '—' : fmt(stats?.thisMonthRevenue ?? 0, 0)}
            sub={stats?.revenueMoM !== undefined && stats.revenueMoM !== 0 ? `${stats.revenueMoM > 0 ? '+' : ''}${stats.revenueMoM}% MoM` : undefined}
            delta={stats?.revenueMoM} icon={TrendingUp} color="emerald" />
          <PeriodCard label="This year" value={L ? '—' : fmt(stats?.thisYearRevenue ?? 0, 0)} icon={BarChart3} color="amber" />
          <PeriodCard label="All time" value={L ? '—' : fmt(stats?.allTimeRevenue ?? 0, 0)} icon={BadgeDollarSign} color="rose" />
        </div>
      </div>

      {/* ── Orders period breakdown ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Orders</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <PeriodCard label="Today" value={L ? '—' : String(stats?.orders ?? 0)} sub={stats?.todayAvgOrder ? `Avg ${fmt(stats.todayAvgOrder, 0)}` : undefined} icon={ShoppingBag} color="indigo" plain />
          <PeriodCard label="This week" value={L ? '—' : String(stats?.thisWeekOrders ?? 0)} icon={CalendarDays} color="violet" plain />
          <PeriodCard label="This month" value={L ? '—' : String(Math.round((stats?.thisMonthRevenue ?? 0) > 0 || (stats?.avgOrderValue ?? 0) > 0 ? (stats?.allTimeOrders ?? 0) > 0 ? (stats?.thisYearOrders ?? 0) : 0 : 0))}
            icon={TrendingUp} color="emerald" plain
            value2={L ? '—' : String(stats?.thisYearOrders ?? 0)} label2="This year" />
          <PeriodCard label="This year" value={L ? '—' : String(stats?.thisYearOrders ?? 0)} icon={BarChart3} color="amber" plain />
          <PeriodCard label="All time" value={L ? '—' : (stats?.allTimeOrders ?? 0).toLocaleString()} icon={Boxes} color="rose" plain />
        </div>
      </div>

      {/* ── 12-month revenue chart + channel ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Monthly revenue — last 12 months</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Bar height = revenue · label = MoM growth %</p>
            </div>
          </div>
          {L || !stats?.monthlyRevenue12m?.length ? (
            <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyRevenue12m} margin={{ top: 16, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#94a3b8" strokeOpacity={0.15} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
                        <p className="font-semibold text-foreground mb-1">{label}</p>
                        <p className="text-muted-foreground">Revenue: <span className="font-semibold text-foreground">{fmt(d.revenue, 0)}</span></p>
                        <p className="text-muted-foreground">Orders: <span className="font-semibold text-foreground">{d.orders}</span></p>
                        {d.growth !== 0 && <p className={`font-semibold ${d.growth > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{d.growth > 0 ? '+' : ''}{d.growth}% MoM</p>}
                      </div>
                    );
                  }} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {stats.monthlyRevenue12m.map((m, i) => (
                      <Cell key={i} fill={i === stats.monthlyRevenue12m!.length - 1 ? '#6366f1' : '#6366f130'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Monthly table summary */}
          {stats?.monthlyRevenue12m && stats.monthlyRevenue12m.some(m => m.revenue > 0) && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-1.5 font-medium">Month</th>
                    <th className="pb-1.5 text-right font-medium">Revenue</th>
                    <th className="pb-1.5 text-right font-medium">Orders</th>
                    <th className="pb-1.5 text-right font-medium">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...stats.monthlyRevenue12m].reverse().slice(0, 6).map((m, i) => (
                    <tr key={i}>
                      <td className="py-1.5 font-medium text-foreground">{m.month}</td>
                      <td className="py-1.5 text-right tabular-nums text-foreground">{fmt(m.revenue, 0)}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{m.orders}</td>
                      <td className={`py-1.5 text-right tabular-nums font-semibold ${m.growth > 0 ? 'text-emerald-500' : m.growth < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {m.growth > 0 ? '+' : ''}{m.growth !== 0 ? `${m.growth}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Revenue by channel */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Revenue by channel</h2>
            <span className="ml-auto text-xs text-muted-foreground">30 days</span>
          </div>
          {channelTotal === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">No sales in last 30 days</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-lg font-bold tabular-nums text-foreground">{fmt(channelTotal, 0)}</span>
              </div>
              {channelPie.sort((a, b) => b.value - a.value).map(c => {
                const pct = channelTotal > 0 ? (c.value / channelTotal) * 100 : 0;
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                        {c.name}
                      </span>
                      <span className="flex items-center gap-3 tabular-nums text-xs">
                        <span className="text-muted-foreground">{c.orders} orders</span>
                        <span className="font-semibold text-foreground">{fmt(c.value, 0)}</span>
                        <span className="text-muted-foreground w-8 text-right">{Math.round(pct)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Today's live view ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SmallKpi icon={Wallet} label="Today's revenue" value={L ? '—' : fmt(stats?.sales ?? 0, 0)} delta={stats?.salesChange} />
        <SmallKpi icon={ShoppingBag} label="Today's orders" value={L ? '—' : String(stats?.orders ?? 0)} />
        <SmallKpi icon={Target} label="Avg order today" value={L ? '—' : fmt(stats?.todayAvgOrder ?? 0, 0)} />
        <SmallKpi icon={UserPlus} label="New customers" value={L ? '—' : String(stats?.newCustomersMonth ?? 0)} sub="this month" />
      </div>

      {/* ── Business health ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Business health</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HealthCard label="Fulfillment rate" value={`${stats?.fulfillmentRate ?? 0}%`} sub="Delivered / total" good={(stats?.fulfillmentRate ?? 0) >= 80} icon={TrendingUp} />
          <HealthCard label="Cancellation rate" value={`${stats?.cancellationRate ?? 0}%`} sub="Last 30 days" good={(stats?.cancellationRate ?? 0) < 5} icon={XCircle} invert />
          <HealthCard label="Repeat customers" value={`${stats?.repeatCustomerRate ?? 0}%`} sub="Ordered 2+ times" good={(stats?.repeatCustomerRate ?? 0) >= 20} icon={Users} />
          <HealthCard label="Inventory value" value={L ? '—' : fmt(stats?.inventoryValue ?? 0, 0)}
            sub={stats?.outOfStockCount ? `${stats.outOfStockCount} out of stock` : 'All stocked'}
            good={!stats?.outOfStockCount} icon={Boxes} />
        </div>
      </div>

      {/* ── Order activity (hourly) + status donut ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Order activity</h2>
            <span className="ml-auto text-xs text-muted-foreground">Last 24 hours</span>
          </div>
          <div className="h-44">
            {hourly.every(h => h.orders === 0) ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No orders in last 24 hours</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barSize={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.12} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={5} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
                        <p className="font-medium text-foreground mb-1">{label}</p>
                        <p className="text-muted-foreground">Orders: <span className="font-semibold text-foreground">{payload[0]?.value}</span></p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="orders" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Orders by status</h2>
            <span className="ml-auto text-xs text-muted-foreground">All time</span>
          </div>
          {totalOrders === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">No orders yet</div>
          ) : (
            <>
              <div className="relative mx-auto h-36 w-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={2} stroke="none">
                      {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-base font-bold text-foreground">{totalOrders}</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {statusPie.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-muted-foreground capitalize flex-1">{s.name}</span>
                    <span className="font-semibold text-foreground tabular-nums">{s.value}</span>
                    <span className="text-muted-foreground w-8 text-right">{Math.round((s.value / totalOrders) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Day of week ── */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Orders by day of week</h2>
          <span className="ml-auto text-xs text-muted-foreground">Last 30 days</span>
        </div>
        <div className="h-40">
          {(stats?.dailyBreakdown ?? []).every(d => d.orders === 0) ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No orders yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.dailyBreakdown ?? []} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.12} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
                      <p className="font-medium text-foreground mb-1">{label}</p>
                      <p className="text-muted-foreground">Orders: <span className="font-semibold text-foreground">{payload[0]?.value}</span></p>
                    </div>
                  );
                }} />
                <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                  {(stats?.dailyBreakdown ?? []).map((d, i) => {
                    const maxO = Math.max(...(stats?.dailyBreakdown ?? []).map(x => x.orders), 1);
                    return <Cell key={i} fill={d.orders === maxO ? '#6366f1' : '#6366f120'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-xs text-center text-muted-foreground">Highlighted bar = busiest day — use this to plan promotions &amp; staffing</p>
      </div>

      {/* ── Top customers + recent orders ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Top customers */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-foreground">Top customers</h2>
            <span className="ml-auto text-xs text-muted-foreground">This month</span>
          </div>
          {!stats?.topCustomers?.length ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No customer data yet</div>
          ) : (
            <div className="space-y-3">
              {stats.topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.orders} order{c.orders !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(c.revenue, 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-foreground">Recent orders</h2>
            <Link href="/dashboard/orders" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">View all</Link>
          </div>
          {loading ? (
            <div className="divide-y divide-border">{[1, 2, 3, 4].map(i => <div key={i} className="h-[62px] animate-pulse bg-muted/30" />)}</div>
          ) : stats?.recentOrders?.length ? (
            <div className="divide-y divide-border">{stats.recentOrders.map(o => <OrderRow key={o.id} {...o} fmt={fmt} />)}</div>
          ) : (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-foreground">No orders yet</p>
              <Link href="/dashboard/pos" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                <ShoppingCart className="h-4 w-4" /> Open point of sale
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Top products + low stock ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {stats?.topProducts && stats.topProducts.length > 0 && (
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Top products</h2>
              </div>
              <span className="text-xs text-muted-foreground">Last 30 days</span>
            </div>
            <div className="space-y-3">
              {stats.topProducts.map((p, i) => {
                const maxRev = stats.topProducts![0].revenue;
                const pct = maxRev > 0 ? Math.round((p.revenue / maxRev) * 100) : 0;
                return (
                  <div key={p.name}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                        <span className="truncate font-medium text-foreground">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <span className="text-xs text-muted-foreground">{p.qty} sold</span>
                        <span className="font-semibold tabular-nums text-foreground">{fmt(p.revenue, 0)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Stock alerts
          </h2>
          {stats?.outOfStockCount ? (
            <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500">
              {stats.outOfStockCount} product{stats.outOfStockCount !== 1 ? 's' : ''} out of stock
            </div>
          ) : null}
          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-9 animate-pulse rounded bg-muted/30" />)}</div>
          ) : stats?.lowStockAlerts?.length ? (
            <ul className="space-y-4">{stats.lowStockAlerts.slice(0, 6).map(it => <StockRow key={it.name} {...it} />)}</ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Everything is well stocked.</p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Shortcut href="/dashboard/products" label="Add product" icon={Plus} />
            <Shortcut href="/dashboard/reports" label="Reports" icon={BarChart3} />
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PeriodCard({ icon: Icon, label, value, sub, delta, color, plain, value2, label2 }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  delta?: number; color: string; plain?: boolean; value2?: string; label2?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    violet: 'text-violet-600 dark:text-violet-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  };
  const iconMap: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconMap[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${plain ? 'text-foreground' : colorMap[color]}`}>{value}</p>
      {delta !== undefined && delta !== 0 && (
        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(delta)}%
        </span>
      )}
      {sub && !delta && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SmallKpi({ icon: Icon, label, value, sub, delta }: {
  icon: React.ElementType; label: string; value: string; sub?: string; delta?: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-foreground/70" />
        </div>
        {delta !== undefined && delta !== 0 && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${delta >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
            {delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, sub, good, invert }: {
  icon: React.ElementType; label: string; value: string; sub: string; good: boolean; invert?: boolean;
}) {
  const color = good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500';
  const bg = good ? 'bg-emerald-500/10' : 'bg-red-500/10';
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function StockRow({ name, stock, min }: { name: string; stock: number; min: number }) {
  const pct = Math.min(100, Math.max(6, min > 0 ? (stock / (min * 2)) * 100 : stock * 10));
  const critical = stock <= 2;
  return (
    <li>
      <div className="flex items-baseline justify-between text-sm">
        <span className="truncate pr-2 text-foreground">{name}</span>
        <span className={`shrink-0 tabular-nums ${critical ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{stock} left</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${critical ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function OrderRow({ id, customer, amount, status, time, fmt }: {
  id: string; customer: string; amount: string; status: string; time: string; fmt: (n: number, d?: number) => string;
}) {
  const badge: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    confirmed: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    processing: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    shipped: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400',
    delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    cancelled: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  };
  const initials = (customer || 'C').trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const timeStr = (() => { try { return new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch { return time; } })();
  const amtNum = parseFloat(amount);
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30 sm:px-6">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">{initials}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">#{id} · {customer}</p>
        <p className="truncate text-xs text-muted-foreground">{timeStr}</p>
      </div>
      <span className="tabular-nums text-sm font-semibold text-foreground">{isNaN(amtNum) ? amount : fmt(amtNum, 0)}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${badge[status] ?? 'bg-muted text-muted-foreground'}`}>{status}</span>
    </div>
  );
}

function Shortcut({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/40">
      <Icon className="h-4 w-4 text-muted-foreground" /> {label}
    </Link>
  );
}
