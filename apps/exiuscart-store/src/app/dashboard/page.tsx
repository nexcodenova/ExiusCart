'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingBag,
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShoppingCart,
  Plus,
  FileText,
  BarChart3,
  MessageCircle,
  Clock,
  CreditCard,
  Banknote,
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
  whatsappOrders: { customer: string; phone: string; items: number; time: string }[];
  recentOrders: { id: string; customer: string; amount: string; status: 'new' | 'paid' | 'completed'; time: string }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { fmt, sym } = useCurrency();

  useEffect(() => {
    const shopId = localStorage.getItem('shop_id');
    if (!shopId) { setLoading(false); return; }
    dashboardApi.getStats(shopId)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back! Here&apos;s what&apos;s happening today.</p>
        </div>
        <Link
          href="/dashboard/pos"
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition"
        >
          <ShoppingCart className="w-5 h-5" />
          <span>New Sale</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Sales" value={loading ? '—' : fmt(stats?.sales ?? 0)} change={stats?.salesChange ?? 0} icon={<DollarSign className="w-5 h-5" />} color="blue" loading={loading} />
        <StatCard title="Orders" value={loading ? '—' : (stats?.orders ?? 0).toString()} change={stats?.ordersChange ?? 0} icon={<ShoppingBag className="w-5 h-5" />} color="green" loading={loading} />
        <StatCard title="Products" value={loading ? '—' : (stats?.products ?? 0).toString()} change={0} icon={<Package className="w-5 h-5" />} color="purple" loading={loading} />
        <StatCard title="Customers" value={loading ? '—' : (stats?.customers ?? 0).toString()} change={0} icon={<Users className="w-5 h-5" />} color="orange" loading={loading} />
      </div>

      {/* Payment Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-500/10">
              <Banknote className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cash</p>
              <p className="text-lg font-bold text-foreground">{loading ? '—' : fmt(stats?.cash ?? 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10">
              <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Card</p>
              <p className="text-lg font-bold text-foreground">{loading ? '—' : fmt(stats?.card ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts & WhatsApp Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <h2 className="font-semibold text-foreground">Low Stock Alerts</h2>
            {stats?.lowStockAlerts?.length ? (
              <span className="ml-auto text-xs bg-warning/10 text-warning px-2 py-1 rounded-full font-medium">
                {stats.lowStockAlerts.length} items
              </span>
            ) : null}
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}</div>
          ) : stats?.lowStockAlerts?.length ? (
            <div className="space-y-1">
              {stats.lowStockAlerts.map((item) => (
                <AlertItem key={item.name} name={item.name} stock={item.stock} min={item.min} critical={item.stock <= 2} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">All products are well stocked</p>
          )}
          <Link href="/dashboard/inventory" className="mt-4 text-sm text-primary hover:underline inline-block">
            View all inventory →
          </Link>
        </div>

        {/* Pending WhatsApp Orders */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-green-500/10">
              <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="font-semibold text-foreground">WhatsApp Orders</h2>
            {stats?.whatsappOrders?.length ? (
              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                {stats.whatsappOrders.length} pending
              </span>
            ) : null}
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
          ) : stats?.whatsappOrders?.length ? (
            <div className="space-y-1">
              {stats.whatsappOrders.map((o, i) => (
                <WhatsAppOrderItem key={i} customer={o.customer} phone={o.phone} items={o.items} time={o.time} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No pending WhatsApp orders</p>
          )}
          <Link href="/dashboard/whatsapp" className="mt-4 text-sm text-primary hover:underline inline-block">
            View all WhatsApp orders →
          </Link>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-sm text-primary hover:underline">View All</Link>
        </div>
        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : stats?.recentOrders?.length ? (
          <div className="space-y-1">
            {stats.recentOrders.map((order) => (
              <OrderItem key={order.id} id={order.id} customer={order.customer} amount={order.amount} status={order.status} time={order.time} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No orders yet. Start your first sale!</p>
            <Link href="/dashboard/pos" className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <ShoppingCart className="w-4 h-4" /> Go to POS
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction href="/dashboard/pos" label="New Sale" icon={<ShoppingCart className="w-6 h-6" />} color="blue" />
          <QuickAction href="/dashboard/products" label="Add Product" icon={<Plus className="w-6 h-6" />} color="green" />
          <QuickAction href="/dashboard/orders" label="View Orders" icon={<FileText className="w-6 h-6" />} color="purple" />
          <QuickAction href="/dashboard/reports" label="Reports" icon={<BarChart3 className="w-6 h-6" />} color="orange" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, icon, color, loading }: {
  title: string; value: string; change: number; icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange'; loading?: boolean;
}) {
  const colorStyles = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  };
  const isPositive = change >= 0;
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colorStyles[color]}`}>{icon}</div>
        {change !== 0 && (
          <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isPositive ? '+' : ''}{change}%
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-xs mb-1">{title}</p>
      {loading ? <div className="h-7 w-24 bg-muted rounded animate-pulse" /> : <p className="text-xl font-bold text-foreground">{value}</p>}
    </div>
  );
}

function AlertItem({ name, stock, min, critical }: { name: string; stock: number; min: number; critical?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-foreground">{name}</span>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${critical ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-warning/10 text-warning'}`}>
        {stock} left (min: {min})
      </span>
    </div>
  );
}

function WhatsAppOrderItem({ customer, phone, items, time }: { customer: string; phone: string; items: number; time: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{customer}</p>
        <p className="text-xs text-muted-foreground">{phone} • {items} item{items > 1 ? 's' : ''}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" />{time}
      </div>
    </div>
  );
}

function OrderItem({ id, customer, amount, status, time }: { id: string; customer: string; amount: string; status: 'new' | 'paid' | 'completed'; time: string }) {
  const statusStyles = { new: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', paid: 'bg-green-500/10 text-green-600 dark:text-green-400', completed: 'bg-muted text-muted-foreground' };
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{id}</p>
        <p className="text-xs text-muted-foreground">{customer} • {time}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-foreground">{amount}</span>
        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusStyles[status]}`}>{status}</span>
      </div>
    </div>
  );
}

function QuickAction({ href, label, icon, color }: { href: string; label: string; icon: React.ReactNode; color: 'blue' | 'green' | 'purple' | 'orange' }) {
  const colorStyles = { blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20', green: 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20', purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20', orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20' };
  return (
    <Link href={href} className={`flex flex-col items-center gap-2 p-4 rounded-xl transition ${colorStyles[color]}`}>
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
