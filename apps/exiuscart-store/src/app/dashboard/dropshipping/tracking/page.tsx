'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Loader2, Package, CheckCircle2, Truck, AlertTriangle, ExternalLink, MapPinned,
} from 'lucide-react';
import { dropshipApi } from '@/lib/api';
import { SUPPLIER_STYLE } from '@/components/dropshipping/SupplierCard';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface DropshipOrder {
  id: number;
  order_id: number;
  order_number: string | null;
  customer_name: string | null;
  supplier_type: string;
  supplier_order_id: string | null;
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  cost_paid: number | null;
  error_message: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function SupplierBadge({ type }: { type: string }) {
  const style = SUPPLIER_STYLE[type];
  const Icon = style?.icon ?? Package;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground capitalize">
      {style?.logo ? (
        <span className="w-4 h-4 rounded-sm overflow-hidden shrink-0 flex items-center justify-center bg-white ring-1 ring-black/5">
          <Image src={style.logo} alt={type} width={16} height={16} className="w-full h-full object-contain" />
        </span>
      ) : (
        <Icon className={`w-3.5 h-3.5 ${style?.color ?? 'text-muted-foreground'}`} />
      )}
      {type}
    </span>
  );
}

export default function SupplierTrackingPage() {
  const [shopId, setShopId] = useState('');
  const [orders, setOrders] = useState<DropshipOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'in_transit' | 'delayed' | 'delivered' | 'awaiting' | 'all'>('in_transit');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    dropshipApi.getDropshipOrders(shopId)
      .then((r) => setOrders(r.data?.orders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId]);

  // A shipment is "delayed" once it's been in transit more than 10 days
  // with no delivery confirmation yet — a reasonable default for
  // cross-border dropship shipping, not tied to any one supplier's SLA.
  const DELAY_THRESHOLD_DAYS = 10;

  const buckets = useMemo(() => {
    const inTransit: DropshipOrder[] = [];
    const delayed: DropshipOrder[] = [];
    const delivered: DropshipOrder[] = [];
    const awaiting: DropshipOrder[] = [];
    for (const o of orders) {
      if (o.delivered_at) { delivered.push(o); continue; }
      if (o.tracking_number) {
        const days = daysSince(o.shipped_at);
        if (days !== null && days > DELAY_THRESHOLD_DAYS) delayed.push(o);
        else inTransit.push(o);
      } else if (o.status !== 'failed') {
        awaiting.push(o);
      }
    }
    return { inTransit, delayed, delivered, awaiting };
  }, [orders]);

  const visible = view === 'all' ? orders
    : view === 'in_transit' ? buckets.inTransit
    : view === 'delayed' ? buckets.delayed
    : view === 'delivered' ? buckets.delivered
    : buckets.awaiting;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/dropshipping" className="text-sm text-muted-foreground hover:text-foreground">← Suppliers</Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Supplier Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Where every dropshipped order actually is right now, across all your suppliers.</p>
        </div>
      </div>

      {/* Live shipment summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'in_transit', label: 'In transit', count: buckets.inTransit.length, icon: Truck, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
          { key: 'delayed', label: `Delayed (${DELAY_THRESHOLD_DAYS}+ days)`, count: buckets.delayed.length, icon: AlertTriangle, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
          { key: 'delivered', label: 'Delivered', count: buckets.delivered.length, icon: CheckCircle2, className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
          { key: 'awaiting', label: 'Awaiting tracking', count: buckets.awaiting.length, icon: Package, className: 'bg-muted text-muted-foreground' },
        ] as const).map((b) => (
          <button key={b.key} onClick={() => setView(view === b.key ? 'all' : b.key)}
            className={`border rounded-xl p-4 text-left transition ${view === b.key ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'}`}>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-foreground">{loading ? '—' : b.count}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${b.className}`}><b.icon className="w-4 h-4" /></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{b.label}</p>
          </button>
        ))}
      </div>

      {view !== 'all' && (
        <button onClick={() => setView('all')} className="text-xs text-primary hover:underline">Show all shipments</button>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading shipments…</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MapPinned className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">Nothing here right now.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            {view === 'delayed' ? 'No shipments are running late — nice.' : 'Shipments will appear here once orders are fulfilled through a supplier.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Order</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Tracking</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Shipped</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">In transit</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Delivered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((o) => {
                const transitDays = daysSince(o.shipped_at);
                const isDelayed = !o.delivered_at && transitDays !== null && transitDays > DELAY_THRESHOLD_DAYS;
                return (
                  <tr key={o.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/orders/${o.order_id}`} className="text-primary hover:underline font-medium text-xs">
                        {o.order_number ?? `#${o.order_id}`}
                      </Link>
                      {o.customer_name && <p className="text-xs text-muted-foreground mt-0.5">{o.customer_name}</p>}
                    </td>
                    <td className="px-4 py-3"><SupplierBadge type={o.supplier_type} /></td>
                    <td className="px-4 py-3">
                      {o.tracking_number ? (
                        <div>
                          <p className="text-xs text-foreground font-mono">{o.tracking_number}</p>
                          {o.carrier && <p className="text-xs text-muted-foreground">{o.carrier}</p>}
                          {o.tracking_url && (
                            <a href={o.tracking_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary flex items-center gap-1 mt-0.5 hover:underline">
                              Track <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Not yet assigned</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{o.shipped_at ? new Date(o.shipped_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      {o.delivered_at ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : transitDays !== null ? (
                        <span className={`text-xs font-medium ${isDelayed ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                          {transitDays} day{transitDays === 1 ? '' : 's'}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {o.delivered_at ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> {new Date(o.delivered_at).toLocaleDateString()}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
