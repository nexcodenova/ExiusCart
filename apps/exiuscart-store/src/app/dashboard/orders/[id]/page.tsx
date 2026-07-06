'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, Truck, DollarSign, ShoppingBag,
  FileText, Percent, Mail, Check, User, Phone, Download,
  RefreshCcw, AlertTriangle, Printer,
} from 'lucide-react';
import Link from 'next/link';
import { ordersApi } from '@/lib/api';
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
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);

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

  const handleRefund = async () => {
    if (!order) return;
    setRefunding(true);
    setRefundError('');
    try {
      const res = await ordersApi.refund(shopId, orderId);
      setOrder(res.data);
      setRefundDone(true);
      setShowRefundConfirm(false);
    } catch (err: any) {
      setRefundError(err.response?.data?.detail || 'Refund failed');
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
          {order.items.map((item) => {
            // Check if TheDersi items_detail has size/color info for this item
            const detail = order.channel_meta?.items_detail?.find((d: any) => d.product_id === item.product_id);
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
                  {detail && (detail.size || detail.color) && (
                    <div className="flex gap-2 mt-1">
                      {detail.size && <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">Size: {detail.size}</span>}
                      {detail.color && <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">Color: {detail.color}</span>}
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

      {/* Refund confirm modal */}
      {showRefundConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Refund this order?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">This will cancel the order, mark it as refunded, and restore stock.</p>
              </div>
            </div>
            {refundError && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{refundError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowRefundConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition">
                Cancel
              </button>
              <button onClick={handleRefund} disabled={refunding}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {refunding && <RefreshCcw className="w-4 h-4 animate-spin" />}
                {refunding ? 'Refunding...' : 'Yes, Refund'}
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

        {/* Refund button — only for POS paid orders that aren't already cancelled */}
        {order.source === 'pos' && order.payment_status === 'paid' && order.status !== 'cancelled' && (
          refundDone ? (
            <span className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 font-medium">
              <RefreshCcw className="w-4 h-4" /> Refunded
            </span>
          ) : (
            <button
              onClick={() => setShowRefundConfirm(true)}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition font-medium"
            >
              <RefreshCcw className="w-4 h-4" /> Refund Order
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
        {order.tracking_number && (
          <Link href={`/dashboard/orders/${orderId}/tracking`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition ml-auto">
            <Truck className="w-4 h-4" /> View tracking
          </Link>
        )}
      </div>
    </div>
  );
}
