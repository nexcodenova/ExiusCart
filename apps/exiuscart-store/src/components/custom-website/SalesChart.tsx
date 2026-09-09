'use client';

import { useState, useEffect } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { paymentGatewayApi } from '@/lib/api';

const PERIODS = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
  { value: 365, label: '1Y' },
];

interface SeriesPoint { date: string; revenue: number; orders: number }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{new Date(label).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
      <p className="text-primary">Revenue: ${payload[0]?.value?.toFixed(2)}</p>
      <p className="text-violet-500">Orders: {payload[1]?.value}</p>
    </div>
  );
}

export default function SalesChart({ shopId, refundsCount }: { shopId: string; refundsCount: number }) {
  const [period, setPeriod] = useState(7);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    paymentGatewayApi.getSalesSeries(shopId, period)
      .then((r) => setSeries(r.data?.series ?? []))
      .catch(() => setSeries([]))
      .finally(() => setLoading(false));
  }, [shopId, period]);

  const totalRevenue = series.reduce((s, p) => s + p.revenue, 0);
  const totalOrders = series.reduce((s, p) => s + p.orders, 0);
  const aov = totalOrders ? totalRevenue / totalOrders : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-foreground">Website sales</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Real revenue and orders placed through your website</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1 shrink-0">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${period === p.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px] mt-4">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
          </div>
        ) : totalOrders === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No orders in this period yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="cw-revenue" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11}
                tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                interval={period > 30 ? Math.floor(series.length / 6) : 'preserveStartEnd'} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `$${v}`} width={48} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#cw-revenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-[11px] text-muted-foreground">Revenue</p>
          <p className="text-base font-bold text-foreground mt-0.5">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-[11px] text-muted-foreground">Orders</p>
          <p className="text-base font-bold text-foreground mt-0.5">{totalOrders}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-[11px] text-muted-foreground">Avg. Order Value</p>
          <p className="text-base font-bold text-foreground mt-0.5">${aov.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-[11px] text-muted-foreground">Refunds (all time)</p>
          <p className="text-base font-bold text-foreground mt-0.5">{refundsCount}</p>
        </div>
      </div>
    </div>
  );
}
