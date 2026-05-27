'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, FileText, ChevronDown, Package, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { ordersApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface Order {
  id: string;
  date: string;
  customer: { name: string; phone: string };
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod: string;
  status: 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  confirmed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  processing: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { fmt } = useCurrency();

  const fetchOrders = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await ordersApi.getAll(shopId, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
      });
      setOrders(res.data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, searchQuery, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground text-sm">Track and manage all your orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['Total', 'Pending', 'Completed', 'Cancelled'].map((label, i) => {
          const counts = [
            orders.length,
            orders.filter(o => o.status === 'pending').length,
            orders.filter(o => o.status === 'completed').length,
            orders.filter(o => o.status === 'cancelled').length,
          ];
          return (
            <div key={label} className="bg-card rounded-xl border border-border p-4">
              <p className="text-muted-foreground text-xs mb-1">{label} Orders</p>
              <p className="text-2xl font-bold text-foreground">{loading ? '—' : counts[i]}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order ID or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="appearance-none w-full sm:w-44 px-4 py-2.5 pr-10 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center">
            <ShoppingCart className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">
              {searchQuery || statusFilter !== 'all' ? 'No orders found' : 'No orders yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Orders will appear here once you make your first sale'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Link href="/dashboard/pos" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <ShoppingCart className="w-4 h-4" /> Go to POS
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Order</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Customer</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Total</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Payment</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/30 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg"><FileText className="w-4 h-4 text-muted-foreground" /></div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{order.id}</p>
                          <p className="text-xs text-muted-foreground">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium text-foreground">{order.customer.name || 'Walk-in'}</p>
                      {order.customer.phone && <p className="text-xs text-muted-foreground">{order.customer.phone}</p>}
                    </td>
                    <td className="p-4"><p className="text-sm text-foreground">{new Date(order.date).toLocaleDateString('en-AE')}</p></td>
                    <td className="p-4 text-right"><span className="text-sm font-semibold text-foreground">{fmt(order.total)}</span></td>
                    <td className="p-4 text-center"><span className="text-xs text-muted-foreground capitalize">{order.paymentMethod}</span></td>
                    <td className="p-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[order.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
