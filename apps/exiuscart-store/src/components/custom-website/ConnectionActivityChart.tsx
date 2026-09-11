'use client';

import { useState, useEffect } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { paymentGatewayApi } from '@/lib/api';

// The reference showed "success/retry/failed webhook deliveries" — that
// implies an outbound delivery system with retries, which doesn't exist
// here (Custom Website orders arrive inbound, once, synchronously — no
// retry queue to report on). What IS real: how many orders actually came
// in per day, reusing the same sales-series data already powering the
// Overview tab's chart.
export default function ConnectionActivityChart({ shopId }: { shopId: string }) {
  const [series, setSeries] = useState<{ date: string; orders: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    paymentGatewayApi.getSalesSeries(shopId, 7)
      .then((r) => setSeries((r.data?.series ?? []).map((p: any) => ({ date: p.date, orders: p.orders }))))
      .catch(() => setSeries([]))
      .finally(() => setLoading(false));
  }, [shopId]);

  const total = series.reduce((s, p) => s + p.orders, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-base font-bold text-foreground">Connection activity</h3>
      <p className="text-xs text-muted-foreground mt-0.5">Real orders received over the last 7 days</p>

      <div className="h-40 mt-3">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10}
                tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
              <YAxis tickLine={false} axisLine={false} fontSize={10} width={24} allowDecimals={false} />
              <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                cursor={false} />
              <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 text-center">
        <p className="text-lg font-bold text-foreground">{total}</p>
        <p className="text-xs text-muted-foreground">Total orders this week</p>
      </div>
    </div>
  );
}
