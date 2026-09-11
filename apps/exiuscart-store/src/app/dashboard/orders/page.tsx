'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileText, ChevronDown, Package, ShoppingCart, Truck, X, ExternalLink, CheckCircle2, PackageCheck, XCircle, Copy, Check, Download, AlertCircle, TrendingUp, Banknote, CreditCard, ArrowLeftRight, Landmark, BarChart2, RefreshCw, Lock, ChevronRight, MessageCircle, Globe, Calendar as CalendarIcon } from 'lucide-react';
import Link from 'next/link';
import { ordersApi, subscriptionApi, dropshipApi, channelsApi, shopifyApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { UsageBanner } from '@/components/usage-banner';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { channelMeta } from '@/components/channels/channelMeta';
import ChannelLogo from '@/components/channels/ChannelLogo';

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
  fulfillment_supplier: string | null;
  fulfillment_status: string | null;
  // Real channel this order came through (ebay/daraz/custom/thedersi/etc.)
  // — resolved server-side from ChannelOrderMeta since `source` itself is
  // just "channel" for every connected marketplace (see NATIVE_ORDER_SOURCES
  // below). Null for POS/WhatsApp/online/Shopify orders, which `source`
  // already identifies on its own.
  channel_type: string | null;
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

// Order.source only ever literally holds these three plus "shopify" and the
// generic "channel" bucket (see OrderSource enum backend-side) — every real
// marketplace (eBay, Daraz, Custom Website, TheDersi, ...) writes
// source="channel" and is told apart via order.channel_type instead (see
// the Order interface above). These three are ExiusCart's own native
// order-taking methods, not third-party "sales channels", so they get their
// own small icon set rather than living in the shared channel-logo registry.
const NATIVE_SOURCE_META: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pos: { label: 'Point of Sale', icon: ShoppingCart, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  online: { label: 'Online Store', icon: Globe, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
};

// One real channel identity for an order — native source (POS/WhatsApp/
// Online) or a real connected sales channel (with its real brand logo),
// used consistently across the revenue breakdown, the channel filter, and
// every order row/card below. `key` is what the backend's ?source= filter
// (or the resolved channel_type) actually matches.
function channelVisual(key: string): { key: string; label: string; icon: React.ReactNode; className: string } {
  const native = NATIVE_SOURCE_META[key];
  if (native) {
    const Icon = native.icon;
    return { key, label: native.label, icon: <Icon className="w-3 h-3" />, className: native.className };
  }
  const meta = channelMeta(key);
  return { key, label: meta.label, icon: <ChannelLogo channelType={key} size={12} />, className: 'bg-muted text-foreground' };
}

function ChannelPill({ order }: { order: Order }) {
  const v = channelVisual(order.channel_type ?? order.source);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full self-start ${v.className}`}>
      {v.icon} {v.label}
    </span>
  );
}

// Same "trigger button + popover checklist" shape as Channel Listings' own
// filters. Real capability here is one whole month at a time (the backend
// only ever takes a "YYYY-MM"), not an arbitrary range — so this is a
// month picker, not a full date-range calendar, on purpose.
function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = value ? MONTH_OPTIONS.find((o) => o.value === value)?.label ?? value : 'All time';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full sm:w-48 h-[38px] px-3 flex items-center gap-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30">
          <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="truncate">{current}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="max-h-80 overflow-y-auto space-y-0.5">
          <button onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition ${!value ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
            All time {!value && <Check className="w-3.5 h-3.5" />}
          </button>
          {MONTH_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition ${value === o.value ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
              {o.label} {value === o.value && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Single-select channel filter with real brand logos — only channels
// actually connected are offered (picking a disconnected one would always
// silently match zero orders, same trap the old plain <select> fell into
// by listing all ~18 CHANNEL_META entries regardless of connection state).
function ChannelFilterPicker({ options, value, onChange }: {
  options: { key: string; label: string; icon: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full sm:w-48 h-[38px] px-3 flex items-center gap-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30">
          {current ? current.icon : <Package className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="truncate">{current ? current.label : 'All Channels'}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="max-h-80 overflow-y-auto space-y-0.5">
          <button onClick={() => { onChange('all'); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition ${value === 'all' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
            All Channels
          </button>
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">No channels connected yet</p>
          ) : options.map((o) => (
            <button key={o.key} onClick={() => { onChange(o.key); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition ${value === o.key ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ShipModal({ order, onClose, onShipped, shopId }: ShipModalProps) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [deliveryCost, setDeliveryCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isFreeDelivery = Number(order.total) >= FREE_DELIVERY_THRESHOLD;
  // Was `order.source === 'thedersi'` — always false, since TheDersi orders
  // (like every connected channel) actually carry source="channel"; the
  // real channel type only ever showed up on order.channel_type. This
  // modal's TheDersi-specific delivery-cost field was silently dead.
  const isTheDersi = order.channel_type === 'thedersi';

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
        delivery_cost: isTheDersi && deliveryCost !== '' ? Number(deliveryCost) : undefined,
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

          {isTheDersi && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Your Real Delivery Cost <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={deliveryCost}
                onChange={e => setDeliveryCost(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">What you actually paid the courier, from your receipt. TheDersi reimburses this, capped at what the customer paid for delivery. Don't have it yet? Skip this — you can add it from the order page later.</p>
            </div>
          )}

          {/* Delivery charge (customer pays) — not asked for TheDersi orders:
              TheDersi already tells us what the customer paid for delivery
              in their own order webhook (shown as "Customer paid for
              delivery" on the order page), so asking the seller to type it
              in again here would be redundant and risks not matching
              TheDersi's own number. Only relevant for channels where we
              have no other source for it (POS, custom website, etc). */}
          {!isTheDersi && (
            isFreeDelivery ? (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5">
                <span className="text-lg">🎁</span>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Free delivery <span className="font-normal text-muted-foreground">(order is {FREE_DELIVERY_THRESHOLD.toLocaleString()}+)</span>
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
            )
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
  hypersku: 'HyperSKU',
  eprolo: 'EPROLO',
  printful: 'Printful',
};

// Short form for the compact Fulfillment table badge — SUPPLIER_LABELS'
// full names ("CJ Dropshipping") don't fit a dense table cell.
const SUPPLIER_SHORT: Record<string, string> = {
  cj: 'CJ',
  hypersku: 'HyperSKU',
  eprolo: 'EPROLO',
  printful: 'Printful',
};

const FULFILLMENT_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  shipped: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  delivered: 'bg-green-500/10 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
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

  // CJ shipping estimate — shown before confirming, so the seller can see
  // roughly what CJ will charge instead of finding out after the fact.
  // Unverified against a real CJ account — shown as an estimate, not a promise.
  const [shippingEstimates, setShippingEstimates] = useState<Record<number, { logistic_name: string; price: number; days: number | string | null }[]>>({});
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [estimateError, setEstimateError] = useState('');

  useEffect(() => {
    if (selected !== 'cj') return;
    let countryCode = '';
    try {
      const addr = order.shipping_address ? JSON.parse(order.shipping_address) : null;
      countryCode = addr?.country_code || addr?.country || '';
    } catch {}
    if (!countryCode) return;

    const productIds = Array.from(new Set(order.items.map((i) => i.product_id).filter((id): id is number => id != null)));
    if (productIds.length === 0) return;

    setLoadingEstimate(true);
    setEstimateError('');
    Promise.all(productIds.map((pid) =>
      dropshipApi.cjShippingEstimate(shopId, pid, countryCode)
        .then((res) => [pid, res.data?.options ?? []] as const)
        .catch(() => [pid, null] as const)
    )).then((results) => {
      const next: Record<number, { logistic_name: string; price: number; days: number | string | null }[]> = {};
      let anyFailed = false;
      for (const [pid, options] of results) {
        if (options) next[pid] = options;
        else anyFailed = true;
      }
      setShippingEstimates(next);
      if (anyFailed && Object.keys(next).length === 0) {
        setEstimateError('Could not fetch a shipping estimate from CJ for this destination.');
      }
    }).finally(() => setLoadingEstimate(false));
  }, [selected, order, shopId]);

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
                    <span>Upgrade to Premium to use HyperSKU</span>
                  </div>
                )}
              </div>

              {selected === 'cj' && (
                <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">Estimated CJ shipping cost</p>
                  {loadingEstimate ? (
                    <p className="text-xs text-muted-foreground">Checking with CJ…</p>
                  ) : estimateError ? (
                    <p className="text-xs text-muted-foreground">{estimateError} You'll see the real amount once CJ ships it.</p>
                  ) : Object.keys(shippingEstimates).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No estimate available for this order's destination.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.entries(shippingEstimates).map(([pid, options]) => (
                        <div key={pid} className="text-xs text-muted-foreground">
                          {options.length === 0 ? (
                            'No shipping options returned for this product.'
                          ) : (
                            options.slice(0, 3).map((opt, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span>{opt.logistic_name}{opt.days ? ` · ~${opt.days} days` : ''}</span>
                                <span className="font-medium text-foreground">${opt.price.toFixed(2)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                      <p className="text-[11px] text-muted-foreground/70 pt-1">Estimate only — the amount actually charged may differ slightly.</p>
                    </div>
                  )}
                </div>
              )}

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
  const [channelFilter, setChannelFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(MONTH_OPTIONS[0].value);
  const [shipTarget, setShipTarget] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [shopId, setShopId] = useState('');
  const [plan, setPlan] = useState('');
  const [hasTheDersi, setHasTheDersi] = useState(false);
  const [connectedSuppliers, setConnectedSuppliers] = useState<string[]>([]);
  // Real connected sales channels, for the channel filter dropdown below —
  // only channels actually connected are offered, same convention as
  // Channel Listings/Channel Orders (never list ones that would always
  // silently match zero orders).
  const [connectedChannelTypes, setConnectedChannelTypes] = useState<string[]>([]);
  const [hasShopify, setHasShopify] = useState(false);
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
    const map: Record<string, { orders: number; revenue: number; cash: number; card: number; bankTransfer: number; split: number }> = {};
    for (const o of salesOrders) {
      // Bucket by the real channel (eBay, Daraz, Custom Website, ...) when
      // there is one — every connected channel otherwise collapsed into one
      // meaningless "channel" bucket, since that's the literal value of
      // Order.source for all of them.
      const src = o.channel_type || o.source || 'other';
      if (!map[src]) map[src] = { orders: 0, revenue: 0, cash: 0, card: 0, bankTransfer: 0, split: 0 };
      map[src].orders += 1;
      map[src].revenue += Number(o.total);
      if (src === 'pos') {
        const n = o.notes || '';
        if (n.includes('Payment: split')) map[src].split += 1;
        else if (n.includes('Payment: card')) map[src].card += 1;
        else if (n.includes('Payment: bank_transfer')) map[src].bankTransfer += 1;
        else map[src].cash += 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [salesOrders]);

  // Native order-taking methods are always offered; real sales channels only
  // once actually connected.
  const channelFilterOptions = useMemo(() => {
    const keys = ['pos', 'whatsapp', 'online', ...(hasShopify ? ['shopify'] : []), ...connectedChannelTypes];
    return keys.map((k) => { const v = channelVisual(k); return { key: k, label: v.label, icon: v.icon }; });
  }, [hasShopify, connectedChannelTypes]);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') ?? ''); }, []);

  useEffect(() => {
    if (!shopId) return;
    subscriptionApi.getCurrent(shopId)
      .then((r) => setPlan(r.data?.plan?.plan_type || ''))
      .catch(() => {});
    // Detected via an active TheDersi connection, not plan_type —
    // TheDersi's Growth/Premium tier maps to plan_type='starter', same as
    // a direct customer, so a plan-string check alone misses them.
    channelsApi.getConnections(shopId)
      .then((r) => {
        const connections = r.data ?? [];
        setHasTheDersi(connections.some((c: any) => c.channel_type === 'thedersi'));
        setConnectedChannelTypes(connections.map((c: any) => c.channel_type));
      })
      .catch(() => {});
    // Shopify is tracked through a completely separate system (no
    // ChannelConnection row), so it needs its own status check.
    shopifyApi.getStatus(shopId)
      .then((r) => setHasShopify(Boolean(r.data?.connected)))
      .catch(() => setHasShopify(false));
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
        source: channelFilter !== 'all' ? channelFilter : undefined,
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
  }, [shopId, searchQuery, statusFilter, channelFilter, monthFilter]);

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
    !hasTheDersi
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Revenue — hero card */}
        <div className="col-span-2 lg:col-span-1 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-indigo-600/10 p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">Total Revenue</p>
            <p className="text-lg font-bold leading-tight tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
              {loading ? '—' : fmt(totalRevenue)}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{salesOrders.length} order{salesOrders.length !== 1 ? 's' : ''} · {monthFilter ? 'this period' : 'all time'}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"><BarChart2 className="h-4 w-4 text-foreground/60" /></div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">Avg Order Value</p>
            <p className="text-lg font-bold leading-tight tracking-tight tabular-nums text-foreground">{loading ? '—' : fmt(avgOrderValue)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">Collected Revenue</p>
            <p className="text-lg font-bold leading-tight tracking-tight tabular-nums text-green-600 dark:text-green-400">{loading ? '—' : fmt(completedRevenue)}</p>
          </div>
        </div>

        <div className={`rounded-xl border bg-card p-3 flex items-center gap-3 ${pendingCount > 0 ? 'border-yellow-500/30' : 'border-border'}`}>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${pendingCount > 0 ? 'bg-yellow-500/10' : 'bg-muted'}`}>
            <Package className={`h-4 w-4 ${pendingCount > 0 ? 'text-yellow-500' : 'text-foreground/60'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">Needs Attention</p>
            <p className={`text-lg font-bold leading-tight tracking-tight tabular-nums ${pendingCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'}`}>
              {loading ? '—' : pendingCount}
            </p>
          </div>
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
              const v = channelVisual(channel);
              const pct = totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={channel} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {v.icon}
                      <p className="text-xs font-semibold text-foreground">{v.label}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${v.className}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-lg font-bold text-foreground tabular-nums">{fmt(stats.revenue)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats.orders} order{stats.orders !== 1 ? 's' : ''}</p>

                  {/* POS payment breakdown */}
                  {channel === 'pos' && stats.orders > 0 && (
                    <div className="mt-2 pt-2 border-t border-border flex gap-3 text-xs text-muted-foreground">
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
                      {stats.bankTransfer > 0 && (
                        <span className="flex items-center gap-1">
                          <Landmark className="w-3 h-3" /> {stats.bankTransfer}
                        </span>
                      )}
                      {stats.split > 0 && (
                        <span className="flex items-center gap-1">
                          <ArrowLeftRight className="w-3 h-3" /> {stats.split}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Revenue bar — one consistent fill colour across every
                      channel now that real logos (not per-channel dot
                      colours) are what tells channels apart */}
                  <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters — compact controls (was py-2.5 + w-5 h-5 icons, felt
          oversized next to everything else on the page) */}
      <div className="bg-card rounded-xl border border-border p-3 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <MonthPicker value={monthFilter} onChange={setMonthFilter} />
        <ChannelFilterPicker options={channelFilterOptions} value={channelFilter} onChange={setChannelFilter} />
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="appearance-none w-full sm:w-36 px-3 py-2 pr-8 text-sm bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
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
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
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
              {searchQuery || statusFilter !== 'all' || channelFilter !== 'all' ? 'No orders found' : 'No orders yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery || statusFilter !== 'all' || channelFilter !== 'all' ? 'Try adjusting your search or filters' : 'Orders will appear here once you make your first sale'}
            </p>
            {!searchQuery && statusFilter === 'all' && channelFilter === 'all' && (
              <Link href="/dashboard/pos" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <ShoppingCart className="w-4 h-4" /> Go to POS
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Order</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Customer</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Items</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Channel</th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Payment</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Fulfillment</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <>
                    <tr key={order.id} className="hover:bg-muted/30 transition cursor-pointer" onClick={() => window.location.href = `/dashboard/orders/${order.id}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-muted rounded-lg">
                            {order.status === 'shipped' ? <Truck className="w-3.5 h-3.5 text-cyan-500" /> : <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{order.order_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString('en-GB')} · {new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        {order.customer_name ? (
                          <div>
                            <p className="text-xs text-foreground font-medium">{order.customer_name}</p>
                            {order.customer_phone && <p className="text-xs text-muted-foreground">{order.customer_phone}</p>}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <div className="flex flex-col gap-1">
                          <ChannelPill order={order} />
                          {order.source === 'pos' && order.notes && (() => {
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
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm font-semibold text-foreground">{fmt(order.total)}</span>
                      </td>
                      <td className="p-3 text-center hidden md:table-cell">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                          order.payment_status === 'paid' ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : order.payment_status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                          : order.payment_status === 'refunded' ? 'bg-gray-500/10 text-gray-500'
                          : 'bg-red-500/10 text-red-500'
                        }`}>{order.payment_status}</span>
                      </td>
                      <td className="p-3 text-center hidden sm:table-cell">
                        {order.fulfillment_supplier ? (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${FULFILLMENT_STYLES[order.fulfillment_status ?? ''] ?? 'bg-muted text-muted-foreground'}`}>
                            {order.fulfillment_status === 'delivered' ? 'Delivered'
                              : order.fulfillment_status === 'failed' ? 'Failed'
                              : `Sent · ${SUPPLIER_SHORT[order.fulfillment_supplier] ?? order.fulfillment_supplier}`}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[order.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
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
                        <td colSpan={9} className="px-6 py-3">
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

          {/* Mobile Cards — the desktop table above already hides most
              columns below sm/md, but Actions can carry up to 4-5
              full-text-label buttons (Confirm/Packing/Ship/Delivered/
              Cancel for TheDersi orders) which still cramped into one
              narrow table cell on a real phone. A stacked card gives
              every button its own row instead of fighting for width. */}
          <div className="md:hidden divide-y divide-border">
            {orders.map((order) => {
              return (
                <div key={order.id} className="p-4" onClick={() => window.location.href = `/dashboard/orders/${order.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 bg-muted rounded-lg shrink-0">
                        {order.status === 'shipped' ? <Truck className="w-3.5 h-3.5 text-cyan-500" /> : <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('en-GB')} · {new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">{fmt(order.total)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                    <ChannelPill order={order} />
                    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[order.status] ?? 'bg-muted text-muted-foreground'}`}>{order.status}</span>
                    {order.customer_name && <span className="text-xs text-muted-foreground truncate">{order.customer_name}</span>}
                  </div>
                  {order.status === 'shipped' && order.tracking_number && (
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1.5 font-mono">{order.carrier || 'Tracking'}: {order.tracking_number}</p>
                  )}
                  {updatingId === order.id ? (
                    <p className="text-xs text-muted-foreground mt-3">Updating…</p>
                  ) : order.source === 'thedersi' ? (
                    <div className="flex items-center gap-1.5 flex-wrap mt-3" onClick={e => e.stopPropagation()}>
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
                          className="inline-flex items-center gap-1 text-xs px-2 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition">
                          <XCircle className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  ) : (canShip(order) || canFulfillOrder(order)) && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-3" onClick={e => e.stopPropagation()}>
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
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
