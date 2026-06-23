'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag, Package, Users, TrendingUp, TrendingDown, AlertTriangle,
  ShoppingCart, Plus, FileText, BarChart3, ArrowUpRight, Banknote, CreditCard, Sparkles,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface DashboardStats {
  sales: number;
  salesChange: number;
  orders: number;
  ordersChange: number;
  products: number;
  customers: number;
  cash: number;
  card: number;
  lowStockAlerts: { name: string; stock: number; min: number }[];
  recentOrders: { id: string; customer: string; amount: string; status: 'new' | 'paid' | 'completed'; time: string }[];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { fmt } = useCurrency();

  useEffect(() => {
    const shopId = localStorage.getItem('shop_id');
    if (!shopId) { setLoading(false); return; }
    dashboardApi.getStats(shopId)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{today}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{greeting()} 👋</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s how your store is doing today.</p>
        </div>
        <Link
          href="/dashboard/pos"
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
        >
          <ShoppingCart className="h-5 w-5" />
          New Sale
          <ArrowUpRight className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard featured title="Today's Sales" value={loading ? '—' : fmt(stats?.sales ?? 0)} change={stats?.salesChange ?? 0} icon={<Sparkles className="h-5 w-5" />} loading={loading} />
        <StatCard title="Orders" value={loading ? '—' : String(stats?.orders ?? 0)} change={stats?.ordersChange ?? 0} icon={<ShoppingBag className="h-5 w-5" />} loading={loading} />
        <StatCard title="Products" value={loading ? '—' : String(stats?.products ?? 0)} icon={<Package className="h-5 w-5" />} loading={loading} />
        <StatCard title="Customers" value={loading ? '—' : String(stats?.customers ?? 0)} icon={<Users className="h-5 w-5" />} loading={loading} />
      </div>

      {/* ── Main row: orders + payment donut ─────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Recent orders */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="font-semibold text-foreground">Recent Orders</h2>
              <p className="text-xs text-muted-foreground">Latest activity across your channels</p>
            </div>
            <Link href="/dashboard/orders" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">View all</Link>
          </div>
          <div className="p-2">
            {loading ? (
              <div className="space-y-2 p-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : stats?.recentOrders?.length ? (
              <div className="divide-y divide-border">
                {stats.recentOrders.map((o) => <OrderRow key={o.id} {...o} />)}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                  <ShoppingBag className="h-7 w-7 text-indigo-500" />
                </div>
                <p className="text-sm font-medium text-foreground">No orders yet</p>
                <p className="text-xs text-muted-foreground mb-4">Ring up your first sale to see it here.</p>
                <Link href="/dashboard/pos" className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition">
                  <ShoppingCart className="h-4 w-4" /> Open POS
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Payment split donut */}
        <div className="rounded-2xl border border-border bg-card shadow-sm p-5 flex flex-col">
          <h2 className="font-semibold text-foreground">Payments Today</h2>
          <p className="text-xs text-muted-foreground">Cash vs card breakdown</p>
          <PaymentDonut cash={stats?.cash ?? 0} card={stats?.card ?? 0} loading={loading} fmt={fmt} />
        </div>
      </div>

      {/* ── Low stock + quick actions ────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Low stock */}
        <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="font-semibold text-foreground">Low Stock</h2>
            {stats?.lowStockAlerts?.length ? (
              <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">{stats.lowStockAlerts.length}</span>
            ) : null}
          </div>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />)}</div>
          ) : stats?.lowStockAlerts?.length ? (
            <div className="space-y-3.5">
              {stats.lowStockAlerts.slice(0, 5).map((it) => <StockBar key={it.name} {...it} />)}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">Everything&apos;s well stocked 🎉</p>
            </div>
          )}
          <Link href="/dashboard/inventory" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
            Manage inventory <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Quick actions */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm p-5">
          <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction href="/dashboard/pos" label="New Sale" icon={<ShoppingCart className="h-5 w-5" />} />
            <QuickAction href="/dashboard/products" label="Add Product" icon={<Plus className="h-5 w-5" />} />
            <QuickAction href="/dashboard/orders" label="Orders" icon={<FileText className="h-5 w-5" />} />
            <QuickAction href="/dashboard/reports" label="Reports" icon={<BarChart3 className="h-5 w-5" />} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat card ──────────────────────────────────────────────────── */
function StatCard({ title, value, change, icon, loading, featured }: {
  title: string; value: string; change?: number; icon: React.ReactNode; loading?: boolean; featured?: boolean;
}) {
  const isPos = (change ?? 0) >= 0;
  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
      featured
        ? 'border-transparent bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/25'
        : 'border-border bg-card'
    }`}>
      {/* decorative blob */}
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${featured ? 'bg-white/20' : 'bg-indigo-500/5'}`} />
      <div className="relative flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          featured ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
        }`}>
          {icon}
        </div>
        {change !== undefined && change !== 0 && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
            featured ? 'bg-white/20 text-white'
              : isPos ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
          }`}>
            {isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPos ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className={`relative mt-3 text-xs font-medium ${featured ? 'text-white/80' : 'text-muted-foreground'}`}>{title}</p>
      {loading
        ? <div className={`relative mt-1 h-7 w-24 rounded animate-pulse ${featured ? 'bg-white/20' : 'bg-muted'}`} />
        : <p className={`relative mt-0.5 text-2xl font-bold tracking-tight ${featured ? 'text-white' : 'text-foreground'}`}>{value}</p>}
    </div>
  );
}

/* ── Payment donut (pure SVG) ───────────────────────────────────── */
function PaymentDonut({ cash, card, loading, fmt }: { cash: number; card: number; loading?: boolean; fmt: (n: number) => string }) {
  const total = cash + card;
  const r = 52, circ = 2 * Math.PI * r;
  const cashFrac = total > 0 ? cash / total : 0;
  const cardFrac = total > 0 ? card / total : 0;

  if (loading) return <div className="mt-4 flex-1 flex items-center justify-center"><div className="h-32 w-32 rounded-full bg-muted animate-pulse" /></div>;

  return (
    <div className="mt-2 flex-1 flex flex-col items-center justify-center">
      <div className="relative my-2">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" strokeWidth="14" className="stroke-muted" />
          {total > 0 && (
            <>
              <circle cx="70" cy="70" r={r} fill="none" strokeWidth="14" strokeLinecap="round"
                stroke="url(#cashGrad)" strokeDasharray={`${cashFrac * circ} ${circ}`} />
              <circle cx="70" cy="70" r={r} fill="none" strokeWidth="14" strokeLinecap="round"
                stroke="url(#cardGrad)" strokeDasharray={`${cardFrac * circ} ${circ}`} strokeDashoffset={`${-cashFrac * circ}`} />
            </>
          )}
          <defs>
            <linearGradient id="cashGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#10b981" /><stop offset="1" stopColor="#34d399" /></linearGradient>
            <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">Total</span>
          <span className="text-lg font-bold text-foreground">{fmt(total)}</span>
        </div>
      </div>
      <div className="mt-3 grid w-full grid-cols-2 gap-2">
        <LegendItem icon={<Banknote className="h-4 w-4" />} label="Cash" value={fmt(cash)} dot="bg-emerald-500" />
        <LegendItem icon={<CreditCard className="h-4 w-4" />} label="Card" value={fmt(card)} dot="bg-indigo-500" />
      </div>
    </div>
  );
}

function LegendItem({ icon, label, value, dot }: { icon: React.ReactNode; label: string; value: string; dot: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dot}`} />{label}
      </div>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

/* ── Low-stock bar (Asana-style) ────────────────────────────────── */
function StockBar({ name, stock, min }: { name: string; stock: number; min: number }) {
  const pct = Math.min(100, Math.max(6, min > 0 ? (stock / (min * 2)) * 100 : stock * 10));
  const critical = stock <= 2;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="truncate pr-2 text-foreground">{name}</span>
        <span className={`shrink-0 font-medium ${critical ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {stock} left
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${critical ? 'bg-gradient-to-r from-rose-500 to-rose-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Order row (avatar + status pill) ───────────────────────────── */
function OrderRow({ id, customer, amount, status, time }: { id: string; customer: string; amount: string; status: 'new' | 'paid' | 'completed'; time: string }) {
  const pill = {
    new: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    completed: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
  }[status];
  const initials = (customer || 'C').trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-muted/50">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/90 to-violet-500/90 text-xs font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{id}</p>
        <p className="truncate text-xs text-muted-foreground">{customer} · {time}</p>
      </div>
      <span className="text-sm font-semibold text-foreground">{amount}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${pill}`}>{status}</span>
    </div>
  );
}

/* ── Quick action tile ──────────────────────────────────────────── */
function QuickAction({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background/50 p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-500 group-hover:text-white dark:bg-indigo-500/10 dark:text-indigo-400">
        {icon}
      </span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </Link>
  );
}
