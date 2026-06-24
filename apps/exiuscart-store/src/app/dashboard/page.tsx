'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag, Package, Users, ArrowUpRight, ArrowDownRight, AlertTriangle,
  ShoppingCart, Plus, FileText, BarChart3, DollarSign,
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

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{greeting()}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{today}</p>
        </div>
        <Link
          href="/dashboard/pos"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          <ShoppingCart className="h-4 w-4" />
          New sale
        </Link>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 divide-y divide-border rounded-xl border border-border bg-card sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
        <Stat label="Today's sales" value={loading ? '—' : fmt(stats?.sales ?? 0)} change={stats?.salesChange} icon={DollarSign} />
        <Stat label="Orders" value={loading ? '—' : String(stats?.orders ?? 0)} change={stats?.ordersChange} icon={ShoppingBag} />
        <Stat label="Products" value={loading ? '—' : String(stats?.products ?? 0)} icon={Package} />
        <Stat label="Customers" value={loading ? '—' : String(stats?.customers ?? 0)} icon={Users} />
      </div>

      {/* Orders + payments */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent orders</h2>
            <Link href="/dashboard/orders" className="text-sm text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {loading ? (
              <div className="divide-y divide-border">{[1, 2, 3, 4].map(i => <div key={i} className="h-[60px] animate-pulse bg-muted/40" />)}</div>
            ) : stats?.recentOrders?.length ? (
              <div className="divide-y divide-border">
                {stats.recentOrders.map((o) => <OrderRow key={o.id} {...o} />)}
              </div>
            ) : (
              <div className="px-6 py-14 text-center">
                <p className="text-sm font-medium text-foreground">No orders yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Your sales will show up here.</p>
                <Link href="/dashboard/pos" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline">
                  <ShoppingCart className="h-4 w-4" /> Open point of sale
                </Link>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Payments today</h2>
          <div className="rounded-xl border border-border bg-card p-5">
            <PaymentSplit cash={stats?.cash ?? 0} card={stats?.card ?? 0} loading={loading} fmt={fmt} />
          </div>
        </section>
      </div>

      {/* Low stock + quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Low stock
          </h2>
          <div className="rounded-xl border border-border bg-card p-5">
            {loading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded bg-muted/40" />)}</div>
            ) : stats?.lowStockAlerts?.length ? (
              <ul className="space-y-4">
                {stats.lowStockAlerts.slice(0, 5).map((it) => <StockRow key={it.name} {...it} />)}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">Everything is well stocked.</p>
            )}
            <Link href="/dashboard/inventory" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">Manage inventory →</Link>
          </div>
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Shortcuts</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Shortcut href="/dashboard/pos" label="New sale" icon={ShoppingCart} />
            <Shortcut href="/dashboard/products" label="Add product" icon={Plus} />
            <Shortcut href="/dashboard/orders" label="Orders" icon={FileText} />
            <Shortcut href="/dashboard/reports" label="Reports" icon={BarChart3} />
          </div>
        </section>
      </div>
    </div>
  );
}

/* Stat — clean cell, number is the hero, delta only if meaningful */
function Stat({ label, value, change, icon: Icon }: { label: string; value: string; change?: number; icon: React.ElementType }) {
  const has = change !== undefined && change !== 0;
  const pos = (change ?? 0) >= 0;
  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground/60" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</span>
        {has && (
          <span className={`inline-flex items-center text-xs font-medium ${pos ? 'text-emerald-600' : 'text-red-600'}`}>
            {pos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(change!)}%
          </span>
        )}
      </div>
    </div>
  );
}

/* Payment split — slim horizontal bar + figures, two restrained tones */
function PaymentSplit({ cash, card, loading, fmt }: { cash: number; card: number; loading?: boolean; fmt: (n: number) => string }) {
  const total = cash + card;
  const cashPct = total > 0 ? (cash / total) * 100 : 0;
  const cardPct = total > 0 ? (card / total) * 100 : 0;
  if (loading) return <div className="h-24 animate-pulse rounded bg-muted/40" />;
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{fmt(total)}</p>
      <p className="text-xs text-muted-foreground">collected today</p>
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-foreground" style={{ width: `${cashPct}%` }} />
        <div className="h-full bg-indigo-500" style={{ width: `${cardPct}%` }} />
      </div>
      <div className="mt-4 space-y-2.5">
        <Row dot="bg-foreground" label="Cash" value={fmt(cash)} pct={cashPct} />
        <Row dot="bg-indigo-500" label="Card" value={fmt(card)} pct={cardPct} />
      </div>
    </div>
  );
}
function Row({ dot, label, value, pct }: { dot: string; label: string; value: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto tabular-nums font-medium text-foreground">{value}</span>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
    </div>
  );
}

/* Low-stock row — neutral, single thin bar */
function StockRow({ name, stock, min }: { name: string; stock: number; min: number }) {
  const pct = Math.min(100, Math.max(6, min > 0 ? (stock / (min * 2)) * 100 : stock * 10));
  const critical = stock <= 2;
  return (
    <li>
      <div className="flex items-baseline justify-between text-sm">
        <span className="truncate pr-2 text-foreground">{name}</span>
        <span className={`shrink-0 tabular-nums ${critical ? 'text-red-600' : 'text-muted-foreground'}`}>{stock} left</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${critical ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

/* Order row — quiet, status as a small dot + word */
function OrderRow({ id, customer, amount, status, time }: { id: string; customer: string; amount: string; status: 'new' | 'paid' | 'completed'; time: string }) {
  const dot = { new: 'bg-amber-500', paid: 'bg-emerald-500', completed: 'bg-muted-foreground' }[status];
  const initials = (customer || 'C').trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">{initials}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{id}</p>
        <p className="truncate text-xs text-muted-foreground">{customer} · {time}</p>
      </div>
      <span className="tabular-nums text-sm font-medium text-foreground">{amount}</span>
      <span className="flex w-20 items-center justify-end gap-1.5 text-xs text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /><span className="capitalize">{status}</span>
      </span>
    </div>
  );
}

/* Shortcut — plain bordered tile, accent only on hover */
function Shortcut({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-foreground/20 hover:bg-muted/40">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </Link>
  );
}
