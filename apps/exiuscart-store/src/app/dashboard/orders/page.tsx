'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileText, ChevronDown, Package, ShoppingCart, Truck, X, ExternalLink, CheckCircle2, PackageCheck, XCircle, Copy, Check, Download, AlertCircle, TrendingUp, Banknote, CreditCard, ArrowLeftRight, BarChart2, RefreshCw, Lock, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ordersApi, subscriptionApi, dropshipApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { UsageBanner } from '@/components/usage-banner';

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = i === 0 ? `This month (${d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })})` : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}
const MONTH_OPTIONS = getMonthOptions();

interface OrderItem {
  id: number;
  product_id: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: number;
  order_number: string;
  shop_id: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
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
  packing: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  processing: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  shipped: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  in_transit: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  delivered: 'bg-green-500/10 text-green-600 dark:text-green-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const CARRIERS = ['Lanka Speed Couriers', 'Kapruka', 'Pronto', 'DHL', 'FedEx', 'Aramex', 'Emirates Post', 'Smsa', 'Other'];

interface ShipModalProps {
  order: Order;
  onClose: () => void;
  onShipped: (order: Order) => void;
  shopId: string;
}

const FREE_DELIVERY_THRESHOLD = 10000;

const CHANNEL_META: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  pos:            { label: 'Point of Sale',   bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-500/20' },
  thedersi:       { label: 'TheDersi',        bg: 'bg-indigo-500/10',  text: 'text-indigo-600 dark:text-indigo-400',   dot: 'bg-indigo-500',  border: 'border-indigo-500/20' },
  shopify:        { label: 'Shopify',         bg: 'bg-green-500/10',   text: 'text-green-600 dark:text-green-400',     dot: 'bg-green-500',   border: 'border-green-500/20' },
  custom_website: { label: 'Custom Website',  bg: 'bg-blue-500/10',    text: 'text-blue-600 dark:text-blue-400',       dot: 'bg-blue-500',    border: 'border-blue-500/20' },
  daraz:          { label: 'Daraz',           bg: 'bg-orange-500/10',  text: 'text-orange-600 dark:text-orange-400',   dot: 'bg-orange-500',  border: 'border-orange-500/20' },
  website:        { label: 'Website',         bg: 'bg-purple-500/10',  text: 'text-purple-600 dark:text-purple-400',   dot: 'bg-purple-500',  border: 'border-purple-500/20' },
  manual:         { label: 'Manual',          bg: 'bg-gray-500/10',    text: 'text-gray-600 dark:text-gray-400',       dot: 'bg-gray-400',    border: 'border-gray-500/20' },
};

function ShipModal({ order, onClose, onShipped, shopId }: ShipModalProps) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isFreeDelivery = Number(order.total) >= FREE_DELIVERY_THRESHOLD;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await ordersApi.ship(shopId, String(order.id), {
        tracking_number: trackingNumber.trim() || undefined,
        carrier: carrier || undefined,
        estimated_delivery: estimatedDelivery || undefined,
        delivery_charge: isFreeDelivery ? 0 : (deliveryCharge !== '' ? Number(deliveryCharge) : undefined),
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
            <label className="block text-sm font-medium text-foreground mb-1.5">Tracking Number <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="text"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="Courier tracking no. — leave blank if self-delivery"
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">Only needed if you use a courier with tracking. Hand-delivering? Just leave it blank.</p>
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

          {/* Delivery charge — orders of 10,000+ get free delivery */}
          {isFreeDelivery ? (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5">
              <span className="text-lg">🎁</span>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Free delivery — a gift from TheDersi <span className="font-normal text-muted-foreground">(order is {FREE_DELIVERY_THRESHOLD.toLocaleString()}+)</span>
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Delivery Charge <span className="text-muted-foreground font-normal">(customer pays)</span></label>
              <input
                type="number"
                min={0}
                value={deliveryCharge}
                onChange={e => setDeliveryCharge(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Order is under {FREE_DELIVERY_THRESHOLD.toLocaleString()} — enter the delivery fee the customer pays. It's added to their invoice.</p>
            </div>
          )}

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

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      title="Copy tracking number"
      className="ml-1 p-1 rounded hover:bg-muted/80 transition"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
}

const SUPPLIER_LABELS: Record<string, string> = {
  cj: 'CJ Dropshipping',
  zendrop: 'Zendrop',
  hypersku: 'HyperSKU',
  wiio: 'Wiio',
};

interface FulfillModalProps {
  order: Order;
  plan: string;
  connectedSuppliers: string[];
  shopId: string;
  onClose: () => void;
  onFulfilled: () => void;
}

function FulfillModal({ order, plan, connectedSuppliers, shopId, onClose, onFulfilled }: FulfillModalProps) {
  const isPremium = plan === 'premium';
  const isStarter = plan === 'starter';
  const availableSuppliers = isPremium
    ? connectedSuppliers
    : isStarter
      ? connectedSuppliers.filter((s) => s === 'cj')
      : [];
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFulfill = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      await dropshipApi.fulfillOrder(shopId, String(order.id), selected);
      setSuccess(true);
      setTimeout(() => { onFulfilled(); onClose(); }, 1800);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to send order to supplier. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Package className="w-5 h-5 text-primary" /></div>
            <div>
              <h2 className="font-semibold text-foreground">Fulfill with Supplier</h2>
              <p className="text-xs text-muted-foreground">{order.order_number} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <div className="p-3 bg-green-500/10 rounded-full"><CheckCircle2 className="w-8 h-8 text-green-500" /></div>
              <p className="font-semibold text-foreground">Order sent to supplier!</p>
              <p className="text-sm text-muted-foreground">Track shipment in <Link href="/dashboard/dropshipping" className="text-primary hover:underline">Dropshipping → Orders</Link>.</p>
            </div>
          ) : availableSuppliers.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <div className="p-3 bg-muted rounded-full w-fit mx-auto"><Package className="w-6 h-6 text-muted-foreground" /></div>
              {isStarter && connectedSuppliers.length > 0 && !connectedSuppliers.includes('cj') ? (
                <p className="text-sm text-muted-foreground">Your Starter plan only supports CJ Dropshipping. Connect CJ in the Dropshipping section to fulfil orders automatically.</p>
              ) : (
                <p className="text-sm text-muted-foreground">No suppliers connected yet. Connect CJ Dropshipping or another supplier first.</p>
              )}
              <Link href="/dashboard/dropshipping" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Go to Dropshipping <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Select a supplier to forward this order. Tracking updates will sync automatically.</p>
              <div className="space-y-2">
                {availableSuppliers.map((s) => (
                  <button key={s} onClick={() => setSelected(s)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition text-left ${selected === s ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                    <span className="text-sm font-medium text-foreground">{SUPPLIER_LABELS[s] ?? s}</span>
                    {selected === s && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                ))}
                {isStarter && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 pt-1">
                    <Lock className="w-3 h-3 shrink-0" />
                    <span>Upgrade to Premium to use Zendrop, HyperSKU & Wiio</span>
                  </div>
                )}
              </div>
              {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition">Cancel</button>
                <button type="button" onClick={handleFulfill} disabled={!selected || loading}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                  <Package className="w-4 h-4" />
                  {loading ? 'Sending…' : 'Fulfill Order'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(MONTH_OPTIONS[0].value);
  const [shipTarget, setShipTarget] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [shopId, setShopId] = useState('');
  const [plan, setPlan] = useState('');
  const [connectedSuppliers, setConnectedSuppliers] = useState<string[]>([]);
  const [fulfillTarget, setFulfillTarget] = useState<Order | null>(null);
  const { fmt } = useCurrency();

  // ── Analytics derived from the currently-filtered orders ──────────────────
  const salesOrders = useMemo(() => orders.filter(o => o.source !== 'pos_return'), [orders]);
  const totalRevenue = useMemo(() => salesOrders.reduce((s, o) => s + Number(o.total), 0), [salesOrders]);
  const avgOrderValue = useMemo(() => salesOrders.length > 0 ? totalRevenue / salesOrders.length : 0, [salesOrders, totalRevenue]);
  const pendingCount = useMemo(() => orders.filter(o => o.status === 'pending').length, [orders]);
  const completedRevenue = useMemo(() =>
    orders.filter(o => ['delivered', 'completed'].includes(o.status)).reduce((s, o) => s + Number(o.total), 0),
    [orders]
  );

  const channelBreakdown = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number; cash: number; card: number; split: number }> = {};
    for (const o of salesOrders) {
      const src = o.source || 'other';
      if (!map[src]) map[src] = { orders: 0, revenue: 0, cash: 0, card: 0, split: 0 };
      map[src].orders += 1;
      map[src].revenue += Number(o.total);
      if (src === 'pos') {
        const n = o.notes || '';
        if (n.includes('Payment: split')) map[src].split += 1;
        else if (n.includes('Payment: card')) map[src].card += 1;
        else map[src].cash += 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [salesOrders]);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') ?? ''); }, []);

  useEffect(() => {
    if (!shopId) return;
    subscriptionApi.getCurrent(shopId)
      .then((r) => setPlan(r.data?.plan?.plan_type || ''))
      .catch(() => {});
    dropshipApi.getConnections(shopId)
      .then((r) => {
        const active = (r.data?.connections ?? []).filter((c: any) => c.is_active).map((c: any) => c.supplier_type as string);
        setConnectedSuppliers(active);
      })
      .catch(() => {});
  }, [shopId]);

  const fetchOrders = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError('');
    try {
      const res = await ordersApi.getAll(shopId, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
        month: monthFilter || undefined,
      });
      setOrders(res.data ?? []);
    } catch (e: any) {
      setOrders([]);
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Failed to load orders. Check your connection.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      console.error('[Orders] fetch error:', e?.response?.data ?? e);
    } finally {
      setLoading(false);
    }
  }, [shopId, searchQuery, statusFilter, monthFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleExcelExport = async () => {
    if (!shopId) return;
    setExporting(true);
    try {
      const res = await ordersApi.getAll(shopId, { limit: 2000 });
      const allOrders: Order[] = res.data ?? [];
      const groups: Record<string, Order[]> = {};
      for (const o of allOrders) {
        const d = new Date(o.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(o);
      }
      const XLSX = (await import('xlsx')) as any;
      const wb = XLSX.utils.book_new();
      const sortedMonths = Object.keys(groups).sort().reverse();
      for (const mk of sortedMonths) {
        const d = new Date(mk + '-01');
        const sheetName = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        const rows = groups[mk].map((o) => ({
          'Order #': o.order_number,
          'Date': new Date(o.created_at).toLocaleDateString('en-GB'),
          'Time': new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          'Customer': o.customer_name ?? '',
          'Phone': o.customer_phone ?? '',
          'Source': o.source,
          'Status': o.status,
          'Payment': o.payment_status,
          'Items': o.items.length,
          'Subtotal': Number(o.subtotal),
          'Discount': Number(o.discount_amount),
          'Tax': Number(o.tax_amount),
          'Total': Number(o.total),
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
      }
      XLSX.writeFile(wb, `orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleShipped = (updated: Order) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    setShipTarget(null);
  };

  const handleStatusUpdate = async (order: Order, newStatus: string) => {
    setUpdatingId(order.id);
    try {
      const res = await ordersApi.updateStatus(shopId, String(order.id), newStatus);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: res.data.status } : o));
    } catch {
      // silent — let user retry
    } finally {
      setUpdatingId(null);
    }
  };

  const canShip = (o: Order) => (o.source === 'thedersi' ? ['packing', 'processing'] : ['pending', 'confirmed', 'processing']).includes(o.status);

  const canFulfillOrder = (o: Order) =>
    !plan.startsWith('thedersi')
    && o.source !== 'thedersi'
    && o.source !== 'pos'
    && !['shipped', 'delivered', 'completed', 'cancelled'].includes(o.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">Track and manage all your orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchOrders()}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="Refresh orders"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExcelExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition shrink-0"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <UsageBanner shopId={shopId} show={['invoice_emails', 'orders']} />
      <p className="text-xs text-muted-foreground -mt-3">
        Channel order limit applies to TheDersi, Shopify, and other connected channels only.{' '}
        <span className="text-green-600 dark:text-green-400 font-medium">POS sales are unlimited.</span>
      </p>

      {/* ── Revenue Overview ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue — hero card */}
        <div className="col-span-2 lg:col-span-1 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-indigo-600/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-indigo-500/15 rounded-xl">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
            {loading ? '—' : fmt(totalRevenue)}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">{salesOrders.length} order{salesOrders.length !== 1 ? 's' : ''} · {monthFilter ? 'this period' : 'all time'}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-muted rounded-xl"><BarChart2 className="h-4 w-4 text-foreground/60" /></div>
            <p className="text-sm text-muted-foreground">Avg Order Value</p>
          </div>
          <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{loading ? '—' : fmt(avgOrderValue)}</p>
          <p className="text-xs text-muted-foreground mt-1.5">Per transaction</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-green-500/10 rounded-xl"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
            <p className="text-sm text-muted-foreground">Collected Revenue</p>
          </div>
          <p className="text-2xl font-bold tracking-tight tabular-nums text-green-600 dark:text-green-400">{loading ? '—' : fmt(completedRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1.5">Delivered & completed</p>
        </div>

        <div className={`rounded-2xl border bg-card p-5 ${pendingCount > 0 ? 'border-yellow-500/30' : 'border-border'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-xl ${pendingCount > 0 ? 'bg-yellow-500/10' : 'bg-muted'}`}>
              <Package className={`h-4 w-4 ${pendingCount > 0 ? 'text-yellow-500' : 'text-foreground/60'}`} />
            </div>
            <p className="text-sm text-muted-foreground">Needs Attention</p>
          </div>
          <p className={`text-2xl font-bold tracking-tight tabular-nums ${pendingCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'}`}>
            {loading ? '—' : pendingCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">Pending orders</p>
        </div>
      </div>

      {/* ── Channel Revenue Breakdown ── */}
      {!loading && channelBreakdown.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Revenue by Channel</h2>
            <span className="text-xs text-muted-foreground">({channelBreakdown.length} active)</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {channelBreakdown.map(([channel, stats]) => {
              const meta = CHANNEL_META[channel] ?? { label: channel, bg: 'bg-muted', text: 'text-foreground', dot: 'bg-gray-400', border: 'border-border' };
              const pct = totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={channel} className={`rounded-2xl border ${meta.border} bg-card p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.dot} shrink-0`} />
                      <p className={`text-xs font-semibold ${meta.text}`}>{meta.label}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${meta.bg} ${meta.text}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums">{fmt(stats.revenue)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats.orders} order{stats.orders !== 1 ? 's' : ''}</p>

                  {/* POS payment breakdown */}
                  {channel === 'pos' && stats.orders > 0 && (
                    <div className="mt-3 pt-3 border-t border-border flex gap-3 text-xs text-muted-foreground">
                      {stats.cash > 0 && (
                        <span className="flex items-center gap-1">
                          <Banknote className="w-3 h-3" /> {stats.cash}
                        </span>
                      )}
                      {stats.card > 0 && (
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" /> {stats.card}
                        </span>
                      )}
                      {stats.split > 0 && (
                        <span className="flex items-center gap-1">
                          <ArrowLeftRight className="w-3 h-3" /> {stats.split}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Revenue bar */}
                  <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${meta.dot} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            aria-label="Filter by month"
            className="appearance-none w-full sm:w-52 px-4 py-2.5 pr-10 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
          >
            <option value="">All Time</option>
            {MONTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
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
            <option value="packing">Packing</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="in_transit">In Transit</option>
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
                        {order.source === 'pos' ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 self-start">POS</span>
                            {order.notes && (() => {
                              const m = order.notes.match(/Payment:\s*(\w+)/i);
                              if (!m) return null;
                              const method = m[1].toLowerCase();
                              const cls = method === 'cash' ? 'text-green-600 dark:text-green-400'
                                : method === 'card' ? 'text-blue-600 dark:text-blue-400'
                                : method === 'split' ? 'text-purple-600 dark:text-purple-400'
                                : 'text-muted-foreground';
                              return <p className={`text-xs capitalize font-medium ${cls}`}>{method}</p>;
                            })()}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {(() => {
                              const meta = CHANNEL_META[order.source] ?? { label: order.source, bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-gray-400', border: 'border-border' };
                              return <span className={`text-xs px-2 py-1 rounded-full self-start ${meta.bg} ${meta.text}`}>{meta.label}</span>;
                            })()}
                            {order.customer_name && <p className="text-xs text-foreground font-medium">{order.customer_name}</p>}
                            {order.customer_phone && <p className="text-xs text-muted-foreground">{order.customer_phone}</p>}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-foreground">{new Date(order.created_at).toLocaleDateString('en-GB')}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-semibold text-foreground">{fmt(order.total)}</span>
                      </td>
                      <td className="p-4 text-center hidden md:table-cell">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                          order.payment_status === 'paid' ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : order.payment_status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                          : order.payment_status === 'refunded' ? 'bg-gray-500/10 text-gray-500'
                          : 'bg-red-500/10 text-red-500'
                        }`}>{order.payment_status}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[order.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                        {updatingId === order.id ? (
                          <span className="text-xs text-muted-foreground">Updating…</span>
                        ) : order.source === 'thedersi' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {order.status === 'pending' && (
                              <button onClick={() => handleStatusUpdate(order, 'confirmed')}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-lg transition font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                              </button>
                            )}
                            {order.status === 'confirmed' && (
                              <button onClick={() => handleStatusUpdate(order, 'packing')}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 rounded-lg transition font-medium">
                                <Package className="w-3.5 h-3.5" /> Packing
                              </button>
                            )}
                            {canShip(order) && (
                              <button onClick={() => setShipTarget(order)}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition font-medium">
                                <Truck className="w-3.5 h-3.5" /> Ship
                              </button>
                            )}
                            {order.status === 'shipped' && (
                              <button onClick={() => handleStatusUpdate(order, 'delivered')}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 rounded-lg transition font-medium">
                                <PackageCheck className="w-3.5 h-3.5" /> Delivered
                              </button>
                            )}
                            {!['delivered', 'cancelled'].includes(order.status) && (
                              <button onClick={() => handleStatusUpdate(order, 'cancelled')}
                                title="Cancel order"
                                className="inline-flex items-center gap-1 text-xs px-2 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {canShip(order) && (
                              <button onClick={() => setShipTarget(order)}
                                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition font-medium">
                                <Truck className="w-3.5 h-3.5" /> Ship
                              </button>
                            )}
                            {canFulfillOrder(order) && (
                              <button onClick={() => setFulfillTarget(order)}
                                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition font-medium">
                                <Package className="w-3.5 h-3.5" /> Fulfill
                              </button>
                            )}
                            {order.status === 'shipped' && order.tracking_number && (
                              <span className="text-xs text-muted-foreground">Tracking ↓</span>
                            )}
                          </div>
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
                              <CopyBtn value={order.tracking_number!} />
                            </div>
                            {order.shipped_at && (
                              <div>
                                <span className="text-muted-foreground">Shipped:</span>
                                <span className="ml-1 text-foreground">{new Date(order.shipped_at).toLocaleDateString('en-GB')}</span>
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

      {fulfillTarget && (
        <FulfillModal
          order={fulfillTarget}
          plan={plan}
          connectedSuppliers={connectedSuppliers}
          shopId={shopId}
          onClose={() => setFulfillTarget(null)}
          onFulfilled={fetchOrders}
        />
      )}
    </div>
  );
}
