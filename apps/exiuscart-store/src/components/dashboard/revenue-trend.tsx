'use client';

import { useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Bar, Line,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

const AXIS_TICK = { fontSize: 11, fill: '#94a3b8' };

type Metric = 'revenue' | 'orders' | 'views';

const METRICS: Record<Metric, { label: string; color: string }> = {
  revenue: { label: 'Revenue', color: '#4f46e5' },
  orders: { label: 'Orders', color: '#10b981' },
  views: { label: 'Storefront views', color: '#0ea5e9' },
};

// All three in one chart: revenue as a filled area, orders as bars, views as
// a line. Each has its own (hidden) scale so a few orders still show next to
// thousands of views. The tiles on top give the totals and turn each one on
// or off. Views are the real Custom Website storefront views per day/month.
export function RevenueTrend({
  stats, loading, fmt,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  fmt: (n: number, d?: number) => string;
}) {
  const [hidden, setHidden] = useState<Set<Metric>>(new Set());
  const toggle = (m: Metric) => setHidden((prev) => {
    const next = new Set(prev);
    if (next.has(m)) next.delete(m);
    else if (next.size < 2) next.add(m); // always keep one line on
    return next;
  });
  const trend = (stats?.periodTrend ?? []).map((p) => ({ ...p, views: p.views ?? 0 }));
  const totals: Record<Metric, number> = {
    revenue: trend.reduce((s, m) => s + m.revenue, 0),
    orders: trend.reduce((s, m) => s + m.orders, 0),
    views: trend.reduce((s, m) => s + m.views, 0),
  };
  const show = (m: Metric, n: number) => (m === 'revenue' ? fmt(n, 0) : n.toLocaleString());

  return (
    <div className="lg:col-span-3 overflow-hidden rounded-xl border border-border bg-card">
      {/* Title, then a small legend that also turns each line on or off */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="font-semibold text-foreground">Sales and traffic</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{trend.length > 13 ? 'Daily' : 'Monthly'} revenue, orders and storefront views</p>
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(METRICS) as Metric[]).map((m) => {
            const active = !hidden.has(m);
            return (
              <button key={m} type="button" onClick={() => toggle(m)} aria-pressed={active}
                title={`${active ? 'Hide' : 'Show'} ${METRICS[m].label.toLowerCase()}: ${loading ? '' : show(m, totals[m])}`}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition hover:bg-muted ${active ? 'text-foreground' : 'text-muted-foreground line-through opacity-60'}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: METRICS[m].color }} />
                {METRICS[m].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 pb-3 pt-4">
        {loading || !trend.length ? (
          <div className="mx-2 h-64 animate-pulse rounded-lg bg-muted/40" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} barCategoryGap="35%">
                <defs>
                  <linearGradient id="trendFill-revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={METRICS.revenue.color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={METRICS.revenue.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#94a3b8" strokeOpacity={0.15} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={28} />
                {/* Revenue scale on the left; orders and views each get their own hidden scale */}
                <YAxis yAxisId="revenue" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52}
                  hide={hidden.has('revenue')} tickFormatter={(v: number) => fmt(v, 0)} />
                <YAxis yAxisId="orders" hide allowDecimals={false} domain={[0, (max: number) => Math.max(1, max) * 2.2]} />
                <YAxis yAxisId="views" hide orientation="right" domain={[0, (max: number) => Math.max(1, max) * 1.1]} />
                <Tooltip
                  cursor={{ fill: '#94a3b8', fillOpacity: 0.08 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as typeof trend[number];
                    const conv = d.views > 0 ? Math.round((d.orders / d.views) * 1000) / 10 : null;
                    return (
                      <div className="min-w-[180px] rounded-lg border border-border bg-popover px-3 py-2.5 text-xs shadow-lg">
                        <p className="mb-1.5 font-medium text-foreground">{label}</p>
                        {(Object.keys(METRICS) as Metric[]).map((m) => (
                          <p key={m} className="flex items-center justify-between gap-4 py-0.5 text-muted-foreground">
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: METRICS[m].color }} />{METRICS[m].label}</span>
                            <span className="font-medium tabular-nums text-foreground">{show(m, d[m])}</span>
                          </p>
                        ))}
                        {conv !== null && (
                          <p className="mt-1.5 border-t border-border pt-1.5 text-muted-foreground">Views to orders <span className="font-medium text-foreground">{conv}%</span></p>
                        )}
                      </div>
                    );
                  }}
                />
                {!hidden.has('orders') && (
                  <Bar yAxisId="orders" dataKey="orders" fill={METRICS.orders.color} fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive animationDuration={600} />
                )}
                {!hidden.has('revenue') && (
                  <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke={METRICS.revenue.color} strokeWidth={2.5}
                    fill="url(#trendFill-revenue)" dot={false}
                    activeDot={{ r: 4, fill: METRICS.revenue.color, stroke: 'var(--card, #fff)', strokeWidth: 2 }}
                    isAnimationActive animationDuration={600} />
                )}
                {!hidden.has('views') && (
                  <Line yAxisId="views" type="monotone" dataKey="views" stroke={METRICS.views.color} strokeWidth={2} strokeDasharray="5 4" dot={false}
                    activeDot={{ r: 4, fill: METRICS.views.color, stroke: 'var(--card, #fff)', strokeWidth: 2 }}
                    isAnimationActive animationDuration={600} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-1 px-2 text-[11px] text-muted-foreground">
          Click a name above to show or hide it. Each one has its own scale. Views count your Custom Website storefront only.
        </p>
      </div>
    </div>
  );
}
