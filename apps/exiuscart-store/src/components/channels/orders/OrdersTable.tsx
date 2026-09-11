'use client';

import { useRouter } from 'next/navigation';
import { Loader2, ArrowUpRight } from 'lucide-react';
import ChannelLogo from '../ChannelLogo';
import { CHANNEL_META } from '../channelMeta';
import { PaymentBadge, FulfillmentBadge } from './OrderBadges';
import { useCurrency } from '@/components/providers/currency-provider';

export interface ChannelOrderRow {
  id: number;
  order_number: string;
  channel_type: string;
  customer_name: string;
  customer_email: string | null;
  items_count: number;
  total: number;
  payment_status: string;
  fulfillment_key: string;
  fulfillment_label: string;
  supplier_label: string | null;
  tracking_number: string | null;
  needs_attention: boolean;
  created_at: string | null;
}

// Clicking a row (or its "Fix issue" button) goes straight to the existing
// /dashboard/orders/[id] detail page — full order management (status
// changes, shipping, refunds, receipts) already lives there. This table is
// a channel-performance view, not a second place to manage the same order.
export default function OrdersTable({
  rows, loading, selected, onToggleSelect, onToggleSelectAll,
}: {
  rows: ChannelOrderRow[];
  loading: boolean;
  selected: number[];
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: (checked: boolean) => void;
}) {
  const router = useRouter();
  const { fmt } = useCurrency();
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const goToOrder = (id: number) => router.push(`/dashboard/orders/${id}`);

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading channel orders…</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-24 text-center px-6">
        <p className="text-sm font-semibold text-foreground">No channel orders match these filters</p>
        <p className="text-xs text-muted-foreground mt-1">Orders placed through a connected sales channel — not POS or in-store sales — show up here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1140px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="w-10 px-4 py-3">
              <input type="checkbox" checked={allSelected} onChange={(e) => onToggleSelectAll(e.target.checked)} className="rounded border-border" aria-label="Select all orders" />
            </th>
            <th className="px-3 py-3">Order</th>
            <th className="px-3 py-3">Channel</th>
            <th className="px-3 py-3">Customer</th>
            <th className="px-3 py-3">Items</th>
            <th className="px-3 py-3">Total</th>
            <th className="px-3 py-3">Payment</th>
            <th className="px-3 py-3">Fulfillment</th>
            <th className="px-3 py-3">Supplier</th>
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id}
              onClick={() => goToOrder(order.id)}
              className={`cursor-pointer border-b border-border transition hover:bg-muted/40 ${order.needs_attention ? 'bg-destructive/5' : ''}`}>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={selected.includes(order.id)} onChange={() => onToggleSelect(order.id)} className="rounded border-border" aria-label={`Select order ${order.order_number}`} />
              </td>
              <td className="px-3 py-3 font-bold text-primary">{order.order_number}</td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <ChannelLogo channelType={order.channel_type} size={16} />
                  {CHANNEL_META[order.channel_type]?.label ?? order.channel_type}
                </span>
              </td>
              <td className="px-3 py-3">
                <p className="font-medium text-foreground">{order.customer_name}</p>
                {order.customer_email && <p className="text-xs text-muted-foreground">{order.customer_email}</p>}
              </td>
              <td className="px-3 py-3 text-muted-foreground">{order.items_count} item{order.items_count === 1 ? '' : 's'}</td>
              <td className="px-3 py-3 font-bold text-foreground">{fmt(order.total)}</td>
              <td className="px-3 py-3"><PaymentBadge status={order.payment_status} /></td>
              <td className="px-3 py-3"><FulfillmentBadge fulfillmentKey={order.fulfillment_key} label={order.fulfillment_label} /></td>
              <td className="px-3 py-3 text-muted-foreground">{order.supplier_label ?? '—'}</td>
              <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {order.created_at ? new Date(order.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
              </td>
              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                {order.needs_attention ? (
                  <button onClick={() => goToOrder(order.id)}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 whitespace-nowrap">
                    Fix issue
                  </button>
                ) : (
                  <button onClick={() => goToOrder(order.id)} className="text-muted-foreground hover:text-foreground" title="Open order">
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
