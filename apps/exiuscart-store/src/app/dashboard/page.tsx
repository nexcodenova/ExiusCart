'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag, Package, Users, ArrowUp, ArrowDown, AlertTriangle,
  ShoppingCart, Plus, FileText, BarChart3, Wallet, MoreHorizontal,
  TrendingUp, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { dashboardApi, reportsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface DashboardStats {
  sales: number; salesChange: number; orders: number; ordersChange: number;
  products: number; customers: number; cash: number; card: number;
  lowStockAlerts: { name: string; stock: number; min: number }[];
  recentOrders: { id: string; customer: string; amount: string; status: string; time: string }[];
  orderStatusBreakdown?: Record<string, number>;
  channelBreakdown?: { source: string; sales: number; orders: number }[];
  hourlyOrders?: { hour: number; orders: number; sales: number }[];
  topProducts?: { name: string; revenue: number; qty: number }[];
}

const CHANNEL_LABELS: Record<string, string> = {
  pos: 'POS', whatsapp: 'WhatsApp', online: 'Online', shopify: 'Shopify', channel: 'Marketplace',
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
    return {
      label: `${h}:00`,
      orders: map[h]?.orders ?? 0,
      sales: map[h]?.sales ?? 0,
    };
  });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [series, setSeries] = useState<{ label: string; sales: number; orders: number }[]>([]);
  const [range, setRange] = useState<'week' | 'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const { fmt } = useCurrency();

  useEffect(() => {
    const shopId = localStorage.getItem('shop_id');
    if (!shopId) { setLoading(false); return; }
    dashboardApi.getStats(shopId).then((r) => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const shopId = localStorage.getItem('shop_id');
    if (!shopId) return;
    const now = new Date(); const from = new Date();
    if (range === 'week') from.setDate(now.getDate() - 7);
    else if (range === 'month') from.setMonth(now.getMonth() - 1);
    else from.setFullYear(now.getFullYear() - 1);
    reportsApi.getSalesReport(shopId, { from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] })
      .then((r) => setSeries((r.data ?? []).map((d: any) => ({
        label: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        sales: Math.round(d.sales ?? 0), orders: d.orders ?? 0,
      }))))
      .catch(() => setSeries([]));
  }, [range]);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const rangeTotal = series.reduce((s, d) => s + d.sales, 0);
  const payTotal = (stats?.cash ?? 0) + (stats?.card ?? 0);
  const pie = [
    { name: 'Cash', value: Math.round(stats?.cash ?? 0) },
    { name: 'Card', value: Math.round(stats?.card ?? 0) },
  ];
  const PIE = ['#0f172a', '#6366f1'];

  // Order status pie
  const statusPie = Object.entries(stats?.orderStatusBreakdown ?? {}).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1), value: v, color: STATUS_COLORS[k] ?? '#94a3b8',
  }));
  const totalOrders = statusPie.reduce((s, d) => s + d.value, 0);

  // Channel pie
  const channelPie = (stats?.channelBreakdown ?? []).map((c, i) => ({
    name: CHANNEL_LABELS[c.source] ?? c.source,
    value: Math.round(c.sales),
    orders: c.orders,
    color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
  }));
  const channelTotal = channelPie.reduce((s, d) => s + d.value, 0);

  // Hourly heartbeat
  const hourly = buildHourly(stats?.hourlyOrders ?? []);
  const hourlyMax = Math.max(...hourly.map(h => h.orders), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting()}, here&apos;s your store</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{today}</p>
        </div>
        <Link href="/dashboard/pos"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90">
          <ShoppingCart className="h-4 w-4" /> New sale
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Wallet} label="Today's sales" value={loading ? '—' : fmt(stats?.sales ?? 0)} delta={stats?.salesChange} />
        <Metric icon={ShoppingBag} label="Orders today" value={loading ? '—' : String(stats?.orders ?? 0)} delta={stats?.ordersChange} />
        <Metric icon={Package} label="Active products" value={loading ? '—' : String(stats?.products ?? 0)} />
        <Metric icon={Users} label="Customers" value={loading ? '—' : String(stats?.customers ?? 0)} />
      </div>

      {/* Sales area chart + payments pie */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Sales overview</h2>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{fmt(rangeTotal, 0)}</p>
            </div>
            <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
              {(['week', 'month', 'year'] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${range === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="h-72">
            {series.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales in this period yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip content={<TipBox fmt={fmt} />} />
                  <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2.5} fill="url(#g1)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payments */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Payments today</h2>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </div>
          {payTotal === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center text-center">
              <p className="text-2xl font-bold text-foreground">{fmt(0)}</p>
              <p className="text-sm text-muted-foreground">No payments yet today</p>
            </div>
          ) : (
            <>
              <div className="relative mx-auto h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" innerRadius={58} outerRadius={78} paddingAngle={2} stroke="none">
                      {pie.map((_, i) => <Cell key={i} fill={PIE[i]} />)}
                    </Pie>
                    <Tooltip content={<TipBox fmt={fmt} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-lg font-bold text-foreground">{fmt(payTotal, 0)}</span>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <PayRow color="#0f172a" label="Cash" value={fmt(stats?.cash ?? 0)} pct={payTotal ? Math.round((stats!.cash / payTotal) * 100) : 0} />
                <PayRow color="#6366f1" label="Card" value={fmt(stats?.card ?? 0)} pct={payTotal ? Math.round((stats!.card / payTotal) * 100) : 0} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Advanced analytics row ── */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Order status donut */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Orders by status</h2>
          </div>
          {totalOrders === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">No orders yet</div>
          ) : (
            <>
              <div className="relative mx-auto h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
                      {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-lg font-bold text-foreground">{totalOrders}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {statusPie.map((s) => (
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

        {/* Sales by channel donut */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Earnings by channel</h2>
            <span className="ml-auto text-xs text-muted-foreground">30 days</span>
          </div>
          {channelTotal === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">No sales in last 30 days</div>
          ) : (
            <>
              <div className="relative mx-auto h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelPie} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
                      {channelPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [fmt(Number(v), 0)]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-sm font-bold text-foreground">{fmt(channelTotal, 0)}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {channelPie.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <span className="text-muted-foreground flex-1">{c.name}</span>
                    <span className="font-semibold text-foreground tabular-nums">{fmt(c.value, 0)}</span>
                    <span className="text-muted-foreground w-8 text-right">{channelTotal ? Math.round((c.value / channelTotal) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Hourly heartbeat */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Order activity</h2>
            <span className="ml-auto text-xs text-muted-foreground">24 hrs</span>
          </div>
          <div className="h-52">
            {hourlyMax <= 1 && hourly.every(h => h.orders === 0) ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No orders in last 24 hours</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barSize={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.12} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    interval={5} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
                          <p className="font-medium text-foreground mb-1">{label}</p>
                          <p className="text-muted-foreground">Orders: <span className="font-semibold text-foreground">{payload[0]?.value}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="orders" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top products + recent orders + low stock */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent orders */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-foreground">Recent orders</h2>
            <Link href="/dashboard/orders" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">View all</Link>
          </div>
          {loading ? (
            <div className="divide-y divide-border">{[1, 2, 3, 4].map(i => <div key={i} className="h-[62px] animate-pulse bg-muted/30" />)}</div>
          ) : stats?.recentOrders?.length ? (
            <div className="divide-y divide-border">{stats.recentOrders.map(o => <OrderRow key={o.id} {...o} />)}</div>
          ) : (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-foreground">No orders yet</p>
              <Link href="/dashboard/pos" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                <ShoppingCart className="h-4 w-4" /> Open point of sale
              </Link>
            </div>
          )}
        </div>

        {/* Low stock + shortcuts */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-amber-500" /> Low stock</h2>
          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-9 animate-pulse rounded bg-muted/30" />)}</div>
          ) : stats?.lowStockAlerts?.length ? (
            <ul className="space-y-4">{stats.lowStockAlerts.slice(0, 5).map(it => <StockRow key={it.name} {...it} />)}</ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Everything is well stocked.</p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Shortcut href="/dashboard/products" label="Add product" icon={Plus} />
            <Shortcut href="/dashboard/reports" label="Reports" icon={BarChart3} />
          </div>
        </div>
      </div>

      {/* Top products by revenue */}
      {stats?.topProducts && stats.topProducts.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Top products by revenue</h2>
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
    </div>
  );
}

function Metric({ icon: Icon, label, value, delta }: { icon: React.ElementType; label: string; value: string; delta?: number }) {
  const has = delta !== undefined && delta !== 0;
  const pos = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-foreground/70" />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
        </div>
        {has && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold ${pos ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
            {pos ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(delta!)}%
          </span>
        )}
      </div>
    </div>
  );
}

function PayRow({ color, label, value, pct }: { color: string; label: string; value: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums text-foreground">{value}</span>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
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

function OrderRow({ id, customer, amount, status, time }: { id: string; customer: string; amount: string; status: string; time: string }) {
  const badge: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    confirmed: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    processing: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    shipped: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400',
    delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    cancelled: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    completed: 'bg-muted text-muted-foreground',
  };
  const initials = (customer || 'C').trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const timeStr = (() => {
    try { return new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
    catch { return time; }
  })();
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30 sm:px-6">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">{initials}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">#{id}</p>
        <p className="truncate text-xs text-muted-foreground">{customer} · {timeStr}</p>
      </div>
      <span className="tabular-nums text-sm font-semibold text-foreground">{amount}</span>
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

function TipBox({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
      {label && <p className="mb-1 text-xs font-medium text-foreground">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs text-muted-foreground">{p.name === 'sales' ? 'Sales' : p.name}: <span className="font-semibold text-foreground">{fmt ? fmt(p.value, 0) : p.value}</span></p>
      ))}
    </div>
  );
}
