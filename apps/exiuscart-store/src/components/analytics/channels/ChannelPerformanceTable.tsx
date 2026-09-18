import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface ChannelRow {
  channel: string; connected: boolean; revenue: number; orders: number;
  avg_order_value: number; share_pct: number; growth_pct: number | null; commission_paid_90d: number;
}

export default function ChannelPerformanceTable({ data, fmt }: { data: ChannelRow[]; fmt: (n: number) => string }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-10 text-center">No orders in the last 90 days.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
            <th className="py-2 pr-4 font-medium">Channel</th>
            <th className="py-2 pr-4 font-medium text-right">Revenue</th>
            <th className="py-2 pr-4 font-medium text-right">Orders</th>
            <th className="py-2 pr-4 font-medium text-right">AOV</th>
            <th className="py-2 pr-4 font-medium text-right">Share</th>
            <th className="py-2 pr-4 font-medium text-right">Growth</th>
            <th className="py-2 font-medium text-right">Commission paid</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((c) => (
            <tr key={c.channel}>
              <td className="py-2.5 pr-4 text-foreground font-medium">{c.channel}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{fmt(c.revenue)}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{c.orders}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{fmt(c.avg_order_value)}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{c.share_pct}%</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {c.growth_pct === null ? (
                  <span className="inline-flex items-center gap-0.5 text-muted-foreground"><Minus className="w-3 h-3" /> —</span>
                ) : c.growth_pct >= 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-emerald-600"><ArrowUpRight className="w-3 h-3" /> {c.growth_pct}%</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-destructive"><ArrowDownRight className="w-3 h-3" /> {Math.abs(c.growth_pct)}%</span>
                )}
              </td>
              <td className="py-2.5 text-right text-muted-foreground tabular-nums">{c.commission_paid_90d > 0 ? fmt(c.commission_paid_90d) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
