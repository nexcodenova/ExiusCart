'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, ShoppingCart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { channelsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface ChannelOrderRow {
  id: number;
  order_number: string;
  customer_name: string;
  total: number;
  payment_status: string;
  fulfillment_label: string;
  needs_attention: boolean;
  created_at: string | null;
}

const PAYMENT_CLASS: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-600 dark:text-green-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  failed: 'bg-destructive/10 text-destructive',
  refunded: 'bg-muted text-muted-foreground',
};

// Real slice of this channel's orders (same /channels/orders list the full
// Channel Orders page uses, just capped at `limit`) — for a channel's
// "Orders" tab so a seller doesn't have to leave the integration page to
// see what's come in.
export default function ChannelOrdersMini({ shopId, channelType, limit = 10 }: { shopId: string; channelType: string; limit?: number }) {
  const { fmt } = useCurrency();
  const [rows, setRows] = useState<ChannelOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    channelsApi.getChannelOrders(shopId, { channel: channelType, limit })
      .then((r) => {
        setRows(r.data?.orders ?? r.data?.items ?? r.data ?? []);
        setTotal(r.data?.total ?? (r.data?.orders ?? r.data)?.length ?? 0);
      })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [shopId, channelType, limit]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground">Orders</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Latest orders imported from this channel.</p>
        </div>
        <Link href={`/dashboard/channels/orders?channel=${channelType}`}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 shrink-0">
          View all in Channel Orders <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <ShoppingCart className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No orders from this channel yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {['Order', 'Customer', 'Total', 'Payment', 'Fulfillment', 'Placed'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
                    <Link href={`/dashboard/orders/${o.id}`} className="hover:text-primary hover:underline">#{o.order_number}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{o.customer_name || 'Guest'}</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground whitespace-nowrap">{fmt(o.total)}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={`text-[10px] border-transparent ${PAYMENT_CLASS[o.payment_status] ?? 'bg-muted text-muted-foreground'}`}>
                      {o.payment_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{o.fulfillment_label}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
