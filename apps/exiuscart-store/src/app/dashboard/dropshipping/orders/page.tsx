'use client';

import { useState, useEffect } from 'react';
import { Loader2, Package, CheckCircle2, Truck, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { dropshipApi } from '@/lib/api';
import Link from 'next/link';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface DropshipOrder {
  id: number;
  order_id: number;
  supplier_type: string;
  supplier_order_id: string | null;
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  cost_paid: number | null;
  error_message: string | null;
  shipped_at: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending:    { label: 'Pending',    className: 'bg-yellow-500/10 text-yellow-500', icon: <Clock className="w-3 h-3" /> },
  processing: { label: 'Processing', className: 'bg-blue-500/10 text-blue-500',    icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  shipped:    { label: 'Shipped',    className: 'bg-green-500/10 text-green-500',  icon: <Truck className="w-3 h-3" /> },
  delivered:  { label: 'Delivered',  className: 'bg-green-600/10 text-green-600',  icon: <CheckCircle2 className="w-3 h-3" /> },
  failed:     { label: 'Failed',     className: 'bg-red-500/10 text-red-500',      icon: <AlertCircle className="w-3 h-3" /> },
};

export default function DropshipOrdersPage() {
  const [shopId, setShopId] = useState('');
  const [orders, setOrders] = useState<DropshipOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    dropshipApi.getDropshipOrders(shopId, {
      status: filterStatus || undefined,
      supplier_type: filterSupplier || undefined,
    })
      .then((r) => setOrders(r.data?.orders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId, filterStatus, filterSupplier]);

  const counts: Record<string, number> = {};
  orders.forEach((o) => { counts[o.status] = (counts[o.status] ?? 0) + 1; });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/dropshipping" className="text-sm text-muted-foreground hover:text-foreground">← Suppliers</Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Supplier Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All orders forwarded to your dropshipping suppliers.</p>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['pending', 'processing', 'shipped', 'delivered'] as const).map((s) => (
          <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            className={`border rounded-xl p-4 text-left transition ${filterStatus === s ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'}`}>
            <p className="text-2xl font-bold text-foreground">{counts[s] ?? 0}</p>
            <p className="text-xs text-muted-foreground capitalize mt-1">{s}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none">
          <option value="">All suppliers</option>
          <option value="cj">CJ Dropshipping</option>
          <option value="zendrop">Zendrop</option>
          <option value="hypersku">HyperSKU</option>
          <option value="wiio">Wiio</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">No supplier orders yet.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            When you fulfill an order through a supplier, it will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">ExiusCart Order</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Supplier Order ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Tracking</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Cost</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => {
                const st = STATUS_STYLES[o.status] ?? STATUS_STYLES.pending;
                return (
                  <tr key={o.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/orders/${o.order_id}`}
                        className="text-primary hover:underline font-medium text-xs">
                        #{o.order_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground capitalize">{o.supplier_type}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{o.supplier_order_id ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${st.className}`}>
                        {st.icon} {st.label}
                      </span>
                      {o.error_message && (
                        <p className="text-xs text-red-400 mt-1 max-w-[200px] truncate" title={o.error_message}>{o.error_message}</p>
                      )}
                    </td>
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
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {o.cost_paid != null ? `$${o.cost_paid.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
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
