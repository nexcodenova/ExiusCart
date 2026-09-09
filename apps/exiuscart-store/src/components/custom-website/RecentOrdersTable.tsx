import Link from 'next/link';
import { ShoppingCart, ArrowRight } from 'lucide-react';

export interface RecentOrder {
  id: number;
  order_number: string;
  customer_name: string | null;
  total: number;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  created_at: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_CLASS: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-600 dark:text-green-400',
  failed: 'bg-destructive/10 text-destructive',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  refunded: 'bg-muted text-muted-foreground',
  fulfilled: 'bg-green-500/10 text-green-600 dark:text-green-400',
  shipped: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  unfulfilled: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

function StatusPill({ value }: { value: string }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${STATUS_CLASS[value?.toLowerCase()] ?? 'bg-muted text-muted-foreground'}`}>
      {value}
    </span>
  );
}

export default function RecentOrdersTable({ orders }: { orders: RecentOrder[] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-base font-bold text-foreground">Recent orders via this channel</h3>
        <Link href="/dashboard/orders" className="text-xs font-semibold text-primary hover:opacity-80 flex items-center gap-1 shrink-0">
          View all orders <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No orders through your website yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['Order ID', 'Customer', 'Total', 'Payment', 'Fulfillment', 'Time'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/orders?view=${o.id}`} className="text-xs font-semibold text-primary hover:opacity-80 whitespace-nowrap">
                      #{o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-foreground whitespace-nowrap">{o.customer_name ?? 'Guest'}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-foreground whitespace-nowrap">${o.total.toFixed(2)}</td>
                  <td className="px-4 py-2.5"><StatusPill value={o.payment_status} /></td>
                  <td className="px-4 py-2.5"><StatusPill value={o.fulfillment_status} /></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
