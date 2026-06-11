'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, FileText, ChevronDown, Package, ShoppingCart, Truck, X, ExternalLink, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ordersApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: number;
  order_number: string;
  shop_id: number;
  customer_id: number | null;
  status: string;
  payment_status: string;
  source: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  notes: string | null;
  shipping_address: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
  estimated_delivery: string | null;
  items: OrderItem[];
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  confirmed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  processing: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  shipped: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  delivered: 'bg-green-500/10 text-green-600 dark:text-green-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const CARRIERS = ['DHL', 'FedEx', 'Aramex', 'Emirates Post', 'Smsa', 'Other'];

interface ShipModalProps {
  order: Order;
  onClose: () => void;
  onShipped: (order: Order) => void;
  shopId: string;
}

function ShipModal({ order, onClose, onShipped, shopId }: ShipModalProps) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) { setError('Tracking number is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await ordersApi.ship(shopId, String(order.id), {
        tracking_number: trackingNumber.trim(),
        carrier: carrier || undefined,
        estimated_delivery: estimatedDelivery || undefined,
      });
      onShipped(res.data);
    } catch {
      setError('Failed to mark as shipped. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg"><Truck className="w-5 h-5 text-cyan-500" /></div>
            <div>
              <h2 className="font-semibold text-foreground">Mark as Shipped</h2>
              <p className="text-xs text-muted-foreground">{order.order_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Tracking Number <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="e.g. 1Z999AA10123456784"
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Carrier</label>
            <select
              value={carrier}
              onChange={e => setCarrier(e.target.value)}
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
            >
              <option value="">Select carrier</option>
              {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Estimated Delivery</label>
            <input
              type="date"
              value={estimatedDelivery}
              onChange={e => setEstimatedDelivery(e.target.value)}
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
            />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
              <Truck className="w-4 h-4" />
              {saving ? 'Saving...' : 'Mark Shipped'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [shipTarget, setShipTarget] = useState<Order | null>(null);
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

  const handleShipped = (updated: Order) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    setShipTarget(null);
  };

  const canShip = (status: string) => ['pending', 'confirmed', 'processing'].includes(status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground text-sm">Track and manage all your orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['Total', 'Pending', 'Shipped', 'Completed'].map((label, i) => {
          const counts = [
            orders.length,
            orders.filter(o => o.status === 'pending').length,
            orders.filter(o => o.status === 'shipped').length,
            orders.filter(o => o.status === 'completed' || o.status === 'delivered').length,
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
            placeholder="Search by order number..."
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
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
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
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">Source</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Total</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Payment</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <>
                    <tr key={order.id} className="hover:bg-muted/30 transition cursor-pointer" onClick={() => window.location.href = `/dashboard/orders/${order.id}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            {order.status === 'shipped' ? <Truck className="w-4 h-4 text-cyan-500" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{order.order_number}</p>
                            <p className="text-xs text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">{order.source}</span>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-foreground">{new Date(order.created_at).toLocaleDateString('en-AE')}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-semibold text-foreground">{fmt(order.total)}</span>
                      </td>
                      <td className="p-4 text-center hidden md:table-cell">
                        <span className="text-xs text-muted-foreground capitalize">{order.payment_status}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[order.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {canShip(order.status) && (
                          <button
                            onClick={() => setShipTarget(order)}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition font-medium"
                          >
                            <Truck className="w-3.5 h-3.5" /> Ship
                          </button>
                        )}
                        {order.status === 'shipped' && order.tracking_number && (
                          <span className="text-xs text-muted-foreground">Tracking ↓</span>
                        )}
                      </td>
                    </tr>

                    {/* Tracking info row for shipped orders */}
                    {order.status === 'shipped' && order.tracking_number && (
                      <tr key={`${order.id}-tracking`} className="bg-cyan-500/5 border-b border-cyan-500/10">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-cyan-500" />
                              <span className="text-muted-foreground">Carrier:</span>
                              <span className="font-medium text-foreground">{order.carrier || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-cyan-500" />
                              <span className="text-muted-foreground">Tracking:</span>
                              <span className="font-mono font-medium text-foreground">{order.tracking_number}</span>
                            </div>
                            {order.shipped_at && (
                              <div>
                                <span className="text-muted-foreground">Shipped:</span>
                                <span className="ml-1 text-foreground">{new Date(order.shipped_at).toLocaleDateString('en-AE')}</span>
                              </div>
                            )}
                            {order.estimated_delivery && (
                              <div>
                                <span className="text-muted-foreground">Est. delivery:</span>
                                <span className="ml-1 font-medium text-foreground">{order.estimated_delivery}</span>
                              </div>
                            )}
                            <a
                              href={`/dashboard/orders/${order.id}/tracking`}
                              className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" /> View tracking page
                            </a>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {shipTarget && (
        <ShipModal
          order={shipTarget}
          shopId={shopId}
          onClose={() => setShipTarget(null)}
          onShipped={handleShipped}
        />
      )}
    </div>
  );
}
