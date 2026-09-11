'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { useCurrency } from '@/components/providers/currency-provider';
import type { ChannelDailyPoint } from './types';

type Metric = 'orders' | 'revenue';

// Real per-day orders/revenue series — the same "daily" array Channel
// Orders' own stats endpoint returns, just scoped to one channel. No
// fabricated "items synced" metric (that isn't something we actually
// track) — this shows orders or revenue, whichever the seller picks.
export default function SyncActivityChart({ daily, accentColor = '#7c3aed' }: {
  daily: ChannelDailyPoint[];
  accentColor?: string;
}) {
  const { fmt } = useCurrency();
  const [metric, setMetric] = useState<Metric>('orders');

  const data = useMemo(
    () => daily.map((d) => ({
      day: new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: metric === 'orders' ? d.orders : d.revenue,
    })),
    [daily, metric],
  );

  const totalOrders = daily.reduce((sum, d) => sum + d.orders, 0);
  const totalRevenue = daily.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <h2 className="text-sm font-bold text-foreground">Sync Activity</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Orders synced from this channel, per day</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          <button onClick={() => setMetric('orders')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${metric === 'orders' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Orders
          </button>
          <button onClick={() => setMetric('revenue')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${metric === 'revenue' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Revenue
          </button>
        </div>
      </div>

      <div className="px-3 pb-1 pt-4">
        {daily.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
            No orders synced from this channel yet.
          </div>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="channelSyncGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accentColor} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={36} allowDecimals={false} />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))',
                    boxShadow: '0 10px 30px rgba(15,23,42,.12)', fontSize: 11, color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: number) => [metric === 'revenue' ? fmt(value) : `${value} orders`, metric === 'revenue' ? 'Revenue' : 'Orders']}
                />
                <Area
                  type="monotone" dataKey="value" stroke={accentColor} strokeWidth={2.5}
                  fill="url(#channelSyncGradient)"
                  dot={{ r: 2.5, strokeWidth: 2, fill: 'hsl(var(--card))', stroke: accentColor }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">Orders (period)</p>
          <p className="text-sm font-bold text-foreground mt-0.5">{totalOrders.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">Revenue (period)</p>
          <p className="text-sm font-bold text-foreground mt-0.5">{fmt(totalRevenue)}</p>
        </div>
      </div>
    </Card>
  );
}
