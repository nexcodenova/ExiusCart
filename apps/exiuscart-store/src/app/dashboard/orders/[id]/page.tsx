'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, Truck, DollarSign, ShoppingBag,
  FileText, Percent, Mail, Check, User, Phone, Download,
  RefreshCcw, AlertTriangle, Printer, MessageCircle, X,
  ChevronDown, Minus, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { ordersApi, creditNotesApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface BundleComponentLine {
  product_name: string;
  qty_per_bundle: number;
  total_qty: number;
  variant_size: string | null;
  variant_color: string | null;
}

interface EnrichedItem {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_bundle: boolean;
  bundle_components: BundleComponentLine[];
}

interface ChannelMeta {
  channel_type: string;
  channel_order_id: string | null;
  seller_plan: string | null;
  commission_rate: number | null;
  commission_amount: number | null;
  seller_net_earnings: number | null;
  delivery_fee: number | null;
  delivery_paid_by: string | null;
  delivery_note: string | null;
  items_detail: any[] | null;
  platform_discount?: number | null;
  coupon_code?: string | null;
}

interface Customer {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface OrderDetails {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  source: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  notes: string | null;
  shipping_address: string | null;
  gift_wrap: boolean;
  gift_wrap_fee: number;
  gift_message: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
  estimated_delivery: string | null;
  created_at: string;
  items: EnrichedItem[];
  channel_meta: ChannelMeta | null;
  customer: Customer | null;
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

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  paid: 'bg-green-500/10 text-green-600',
  failed: 'bg-red-500/10 text-red-500',
  refunded: 'bg-gray-500/10 text-gray-600',
};

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm text-right font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { fmt } = useCurrency();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refundDone, setRefundDone] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Return modal state
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [createCreditNote, setCreateCreditNote] = useState(true);

  useEffect(() => {
    if (!shopId || !orderId) return;
    ordersApi.getDetails(shopId, orderId)
      .then(res => setOrder(res.data))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [shopId, orderId]);

  const handleSendInvoice = async () => {
    if (!order) return;
    setSendingInvoice(true);
    setInvoiceError('');
    try {
      await ordersApi.sendInvoice(shopId, orderId);
      setInvoiceSent(true);
      setTimeout(() => setInvoiceSent(false), 4000);
    } catch (err: any) {
      setInvoiceError(err.response?.data?.detail || 'Failed to send invoice');
    } finally {
      setSendingInvoice(false);
    }
  };

  const openReturnModal = () => {
    if (!order) return;
    const initial: Record<number, number> = {};
    order.items.forEach((item) => { initial[item.id] = item.quantity; });
    setReturnQtys(initial);
    setReturnReason('');
    setReturnNotes('');
    setCreateCreditNote(true);
    setRefundError('');
    setShowReturnModal(true);
  };

  const returnTotal = order
    ? order.items.reduce((sum, item) => sum + (returnQtys[item.id] ?? 0) * item.unit_price, 0)
    : 0;

  const handleReturn = async () => {
    if (!order) return;
    if (!returnReason) { setRefundError('Please select a reason for the return.'); return; }
    const hasItems = order.items.some((item) => (returnQtys[item.id] ?? 0) > 0);
    if (!hasItems) { setRefundError('Select at least one item to return.'); return; }

    setRefunding(true);
    setRefundError('');
    try {
      const res = await ordersApi.refund(shopId, orderId);
      setOrder(res.data);

      if (createCreditNote && returnTotal > 0) {
        await creditNotesApi.create(shopId, {
          order_id: order.id,
          reason: returnReason,
          amount: returnTotal,
          notes: returnNotes || undefined,
        }).catch(() => {});
      }

      setRefundDone(true);
      setShowReturnModal(false);
    } catch (err: any) {
      setRefundError(err.response?.data?.detail || 'Refund failed. Please try again.');
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-4">
        <div className="h-8 bg-muted rounded-lg w-48 animate-pulse" />
        {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <Package className="w-14 h-14 mx-auto text-muted-foreground opacity-40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Order not found</h2>
        <Link href="/dashboard/orders" className="text-sm text-primary hover:underline">← Back to orders</Link>
      </div>
    );
  }

  const isTheDersi = order.source === 'thedersi' || order.channel_meta?.channel_type === 'thedersi';

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString('en-AE')}</p>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[order.status] ?? 'bg-muted text-muted-foreground'}`}>
            {order.status}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${PAYMENT_STATUS_STYLES[order.payment_status] ?? 'bg-muted text-muted-foreground'}`}>
            {order.payment_status}
          </span>
        </div>
      </div>

      {/* Channel badge */}
      {isTheDersi && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <ShoppingBag className="w-5 h-5 text-indigo-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">TheDersi Order</p>
            {order.channel_meta?.channel_order_id && (
              <p className="text-xs text-muted-foreground">Channel ref: {order.channel_meta.channel_order_id}</p>
            )}
          </div>
        </div>
      )}

      {/* Order Items */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Items ({order.items.length})</h2>
        </div>
        <div className="divide-y divide-border">
          {order.items.map((item, idx) => {
            // TheDersi stores items_detail from OrderItemIn.model_dump() — field is exiuscart_product_id
            const theDersiItems = order.channel_meta?.items_detail ?? [];
            const detail = isTheDersi
              ? (theDersiItems.find((d: any) =>
                  d.exiuscart_product_id === item.product_id ||
                  d.exiuscart_product_id === String(item.product_id) ||
                  d.product_id === item.product_id
                ) ?? theDersiItems[idx] ?? null)
              : null;
            return (
              <div key={item.id} className="px-5 py-4 flex items-start gap-4">
                <div className="p-2.5 bg-muted rounded-lg shrink-0">
                  <Package className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                    {item.is_bundle && (
                      <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">Bundle</span>
                    )}
                  </div>
                  {item.product_sku && <p className="text-xs text-muted-foreground font-mono">{item.product_sku}</p>}
                  {item.product_id && <p className="text-xs text-muted-foreground/60 font-mono">Product #{item.product_id}</p>}
                  {detail && (detail.size || detail.color) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {detail.color && (
                        <span className="text-xs px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full font-medium">
                          Color: {detail.color}
                        </span>
                      )}
                      {detail.size && (
                        <span className="text-xs px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full font-medium">
                          Size: {detail.size}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Qty: {item.quantity} × {fmt(item.unit_price)}</p>
                  {item.is_bundle && item.bundle_components.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-primary/20 space-y-1">
                      {item.bundle_components.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {c.product_name}
                            {c.variant_size && ` · ${c.variant_size}`}
                            {c.variant_color && ` · ${c.variant_color}`}
                          </span>
                          <span className="text-xs font-medium text-foreground ml-auto shrink-0">×{c.total_qty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-sm font-semibold text-foreground shrink-0">{fmt(item.total_price)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pricing breakdown */}
      <div className="bg-card border border-border rounded-2xl px-5 py-4">
        <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-muted-foreground" /> Pricing
        </h2>
        <InfoRow label="Subtotal" value={fmt(order.subtotal)} />
        {order.gift_wrap && order.gift_wrap_fee > 0 && <InfoRow label="🎁 Gift Wrap Fee" value={fmt(order.gift_wrap_fee)} />}
        {order.discount_amount > 0 && <InfoRow label="Discount" value={`-${fmt(order.discount_amount)}`} />}
        {order.channel_meta?.platform_discount != null && order.channel_meta.platform_discount > 0 && (
          <div className="flex items-start gap-2.5 py-2.5 border-b border-border">
            <div className="flex-1 flex items-start gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Platform Discount</span>
              {order.channel_meta.coupon_code && (
                <span className="text-xs font-mono px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{order.channel_meta.coupon_code}</span>
              )}
            </div>
            <span className="text-sm font-medium text-foreground shrink-0">-{fmt(order.channel_meta.platform_discount)}</span>
          </div>
        )}
        {order.channel_meta?.platform_discount != null && order.channel_meta.platform_discount > 0 && (
          <div className="flex items-center gap-2 py-2 border-b border-border">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <p className="text-xs text-green-600 dark:text-green-400">
              Platform discount applied: {fmt(order.channel_meta.platform_discount)} — this does not affect your earnings
            </p>
          </div>
        )}
        {!isTheDersi && order.tax_amount > 0 && <InfoRow label="VAT (5%)" value={fmt(order.tax_amount)} />}
        <div className="flex items-center justify-between pt-2.5 mt-0.5">
          <span className="font-semibold text-foreground">Total</span>
          <span className="text-lg font-bold text-foreground">{fmt(order.total)}</span>
        </div>
      </div>

      {/* TheDersi commission breakdown */}
      {order.channel_meta && (
        <div className="bg-card border border-border rounded-2xl px-5 py-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Percent className="w-5 h-5 text-muted-foreground" /> Channel Earnings
          </h2>
          {order.channel_meta.seller_plan && (
            <InfoRow label="Your Plan" value={order.channel_meta.seller_plan} />
          )}
          {order.channel_meta.commission_rate != null && (
            <InfoRow label="Commission Rate" value={`${order.channel_meta.commission_rate}%`} />
          )}
          {order.channel_meta.commission_amount != null && (
            <InfoRow label="Commission Amount" value={`-${fmt(order.channel_meta.commission_amount)}`} />
          )}
          {order.channel_meta.delivery_fee != null && (
            <InfoRow
              label={`Delivery Fee (paid by ${order.channel_meta.delivery_paid_by ?? 'N/A'})`}
              value={fmt(order.channel_meta.delivery_fee)}
            />
          )}
          {order.channel_meta.seller_net_earnings != null && (
            <div className="flex items-center justify-between pt-2.5 mt-0.5 border-t border-border">
              <span className="font-semibold text-foreground">Your Net Earnings</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">{fmt(order.channel_meta.seller_net_earnings)}</span>
            </div>
          )}
          {order.channel_meta.delivery_note && (
            <p className="text-xs text-muted-foreground mt-3 bg-muted rounded-lg px-3 py-2">{order.channel_meta.delivery_note}</p>
          )}
        </div>
      )}

      {/* Customer */}
      {order.customer && (
        <div className="bg-card border border-border rounded-2xl px-5 py-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <User className="w-5 h-5 text-muted-foreground" /> Customer
          </h2>
          {order.customer.name && <InfoRow label="Name" value={order.customer.name} />}
          {order.customer.phone && (
            <InfoRow label="Phone" value={
              <a href={`tel:${order.customer.phone}`} className="text-primary hover:underline flex items-center gap-1">
                <Phone className="w-3 h-3" />{order.customer.phone}
              </a>
            } />
          )}
          {order.customer.email && (
            <InfoRow label="Email" value={
              <a href={`mailto:${order.customer.email}`} className="text-primary hover:underline flex items-center gap-1">
                <Mail className="w-3 h-3" />{order.customer.email}
              </a>
            } />
          )}
          {order.customer.address && <InfoRow label="Address" value={order.customer.address} />}
        </div>
      )}

      {/* Shipping / Tracking */}
      {(order.shipping_address || order.tracking_number) && (
        <div className="bg-card border border-border rounded-2xl px-5 py-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5 text-muted-foreground" /> Shipping
          </h2>
          {order.shipping_address && <InfoRow label="Address" value={order.shipping_address} />}
          {order.carrier && <InfoRow label="Carrier" value={order.carrier} />}
          {order.tracking_number && <InfoRow label="Tracking #" value={order.tracking_number} mono />}
          {order.shipped_at && <InfoRow label="Shipped" value={new Date(order.shipped_at).toLocaleDateString('en-AE')} />}
          {order.estimated_delivery && <InfoRow label="Est. Delivery" value={order.estimated_delivery} />}
        </div>
      )}

      {/* Gift Wrap */}
      {order.gift_wrap && (
        <div className="bg-pink-500/5 border border-pink-500/30 rounded-2xl px-5 py-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            🎁 Gift Order
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Gift Wrapping</span>
              <span className="font-medium text-pink-600 dark:text-pink-400">Included</span>
            </div>
            {order.gift_wrap_fee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gift Wrap Fee</span>
                <span className="font-medium text-foreground">LKR {order.gift_wrap_fee.toLocaleString()}</span>
              </div>
            )}
            {order.gift_message && (
              <div className="mt-3 p-3 bg-pink-500/10 rounded-xl border border-pink-500/20">
                <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Gift Message</p>
                <p className="text-sm text-foreground italic">&ldquo;{order.gift_message}&rdquo;</p>
              </div>
            )}
            <p className="text-xs text-pink-600 dark:text-pink-400 mt-2 font-medium">
              ⚠ Pack this order as a gift and include the message card
            </p>
          </div>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="bg-card border border-border rounded-2xl px-5 py-4">
          <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" /> Notes
          </h2>
          <p className="text-sm text-muted-foreground">{order.notes}</p>
        </div>
      )}

      {/* Return / Refund modal */}
      {showReturnModal && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                  <RefreshCcw className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Return / Refund</h3>
                  <p className="text-xs text-muted-foreground">Order {order.order_number}</p>
                </div>
              </div>
              <button onClick={() => setShowReturnModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Items */}
              <div>
                <p className="text-sm font-medium text-foreground mb-3">Select items to return</p>
                <div className="space-y-2">
                  {order.items.map((item) => {
                    const qty = returnQtys[item.id] ?? 0;
                    return (
                      <div key={item.id} className="flex items-center gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{fmt(item.unit_price)} × ordered {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setReturnQtys((prev) => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] ?? item.quantity) - 1) }))}
                            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition text-foreground"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-foreground">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setReturnQtys((prev) => ({ ...prev, [item.id]: Math.min(item.quantity, (prev[item.id] ?? item.quantity) + 1) }))}
                            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition text-foreground"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Return Reason *</label>
                <div className="relative">
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-foreground appearance-none pr-8"
                  >
                    <option value="">Select reason...</option>
                    <option value="Damaged / Defective">Damaged / Defective</option>
                    <option value="Wrong item received">Wrong item received</option>
                    <option value="Customer changed mind">Customer changed mind</option>
                    <option value="Item not as described">Item not as described</option>
                    <option value="Duplicate order">Duplicate order</option>
                    <option value="Other">Other</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Additional Notes</label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional details about this return..."
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-foreground resize-none text-sm"
                />
              </div>

              {/* Credit note toggle */}
              <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Create Credit Note</p>
                  <p className="text-xs text-muted-foreground">Auto-generates CN for {fmt(returnTotal)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateCreditNote((v) => !v)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${createCreditNote ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${createCreditNote ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Summary */}
              {returnTotal > 0 && (
                <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl px-4 py-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Refund amount</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">{fmt(returnTotal)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Stock will be restored · Order marked as refunded</p>
                </div>
              )}

              {refundError && (
                <p className="text-sm text-red-500 bg-red-500/10 rounded-xl px-3 py-2">{refundError}</p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-border flex gap-3 shrink-0">
              <button
                onClick={() => setShowReturnModal(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReturn}
                disabled={refunding}
                className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {refunding && <RefreshCcw className="w-4 h-4 animate-spin" />}
                {refunding ? 'Processing...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email invoice */}
      {invoiceError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">{invoiceError}</div>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap gap-3 pb-4">
        <Link href="/dashboard/orders" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </Link>

        {/* Return / Refund — for any paid order not yet cancelled */}
        {order.payment_status === 'paid' && order.status !== 'cancelled' && (
          refundDone ? (
            <span className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium">
              <RefreshCcw className="w-4 h-4" /> Refunded
            </span>
          ) : (
            <button
              onClick={openReturnModal}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition font-medium"
            >
              <RefreshCcw className="w-4 h-4" /> Return / Refund
            </button>
          )
        )}

        <button
          onClick={handleSendInvoice}
          disabled={sendingInvoice}
          className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition font-medium ${
            invoiceSent
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          } disabled:opacity-50`}
        >
          {invoiceSent ? <Check className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
          {invoiceSent ? 'Invoice sent!' : sendingInvoice ? 'Sending...' : 'Send Invoice'}
        </button>
        <button
          onClick={() => window.open(`/dashboard/orders/${orderId}/invoice`, '_blank')}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition font-medium"
        >
          <Download className="w-4 h-4" /> Download PDF
        </button>
        <button
          onClick={() => window.open(`/dashboard/orders/${orderId}/packing-slip`, '_blank')}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition font-medium"
        >
          <Printer className="w-4 h-4" /> Packing Slip
        </button>
        <button
          onClick={() => window.open(`/dashboard/orders/${orderId}/payment-receipt`, '_blank')}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 transition font-medium"
        >
          <Printer className="w-4 h-4" /> Payment Receipt
        </button>

        {/* WhatsApp — status-aware smart message */}
        {order.customer?.phone && (
          <button
            onClick={() => {
              const phone = order.customer!.phone!.replace(/\D/g, '');
              const name = order.customer!.name ?? 'there';
              let msg = '';
              if (order.status === 'shipped') {
                msg = `Hi ${name}, your order *${order.order_number}* has been shipped!`
                  + (order.carrier ? `\n📦 Carrier: ${order.carrier}` : '')
                  + (order.tracking_number ? `\n🔍 Tracking: ${order.tracking_number}` : '')
                  + (order.estimated_delivery ? `\n🗓 Est. Delivery: ${order.estimated_delivery}` : '')
                  + `\n\nThank you for shopping with us!`;
              } else if (order.status === 'delivered' || order.status === 'completed') {
                msg = `Hi ${name}, your order *${order.order_number}* has been delivered! 🎉\n\nWe hope you love your purchase. Feel free to reach out if you need anything!`;
              } else if (order.status === 'pending') {
                msg = `Hi ${name}, we've received your order *${order.order_number}* (${fmt(order.total)}). We'll confirm it shortly — thank you!`;
              } else if (order.status === 'processing') {
                msg = `Hi ${name}, your order *${order.order_number}* is being prepared. We'll notify you once it ships!`;
              } else {
                msg = `Hi ${name}, your order *${order.order_number}* has been confirmed. Total: ${fmt(order.total)}. Thank you for your purchase!`;
              }
              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
            }}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
            {order.status === 'shipped' && <span className="text-xs bg-[#25D366]/20 px-1.5 py-0.5 rounded-full">+ tracking</span>}
          </button>
        )}

        {order.tracking_number && (
          <Link href={`/dashboard/orders/${orderId}/tracking`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition ml-auto">
            <Truck className="w-4 h-4" /> View tracking
          </Link>
        )}
      </div>
    </div>
  );
}
