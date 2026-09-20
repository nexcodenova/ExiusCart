'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, ReferenceLine,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

const AXIS_TICK = { fontSize: 11, fill: '#94a3b8' };

export function RevenueTrend({
  stats, loading, fmt,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  fmt: (n: number, d?: number) => string;
}) {
  const trend = stats?.periodTrend ?? [];
  const totalRev = trend.reduce((s, m) => s + m.revenue, 0);
  const avgRev = trend.length ? totalRev / trend.length : 0;
  const change = stats?.periodRevenueChange ?? null;

  return (
    <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Revenue trend</h2>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">{loading ? '—' : fmt(totalRev, 0)}</p>
          {!loading && change !== null && (
            <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(change)}% vs previous period
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2.5">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-400" /> Revenue
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-0.5 w-4 rounded bg-indigo-600" /> Trend
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Orders
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-px w-5 border-t-2 border-dashed border-indigo-400 opacity-60" /> Period avg
            </span>
          </div>
        </div>
      </div>

      {loading || !trend.length ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
              <defs>
                <linearGradient id="revBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a5b4fc" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis yAxisId="l" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
              <YAxis yAxisId="r" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: '#94a3b8', fillOpacity: 0.12 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
                      <p className="font-semibold text-foreground mb-1">{label}</p>
                      <p className="text-muted-foreground">Revenue: <span className="font-semibold text-foreground">{fmt(d.revenue, 0)}</span></p>
                      <p className="text-muted-foreground">Orders: <span className="font-semibold text-foreground">{d.orders}</span></p>
                      {d.growth !== 0 && <p className={`font-semibold ${d.growth > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{d.growth > 0 ? '+' : ''}{d.growth}% vs previous</p>}
                    </div>
                  );
                }}
              />
              <ReferenceLine yAxisId="l" y={avgRev} stroke="#6366f1" strokeDasharray="6 3" strokeOpacity={0.45} />

              <Bar yAxisId="l" dataKey="revenue" fill="url(#revBarGradient)" radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive animationDuration={700} />
              <Line yAxisId="l" type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3, fill: '#4f46e5', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#4f46e5' }} isAnimationActive animationDuration={700} />
              <Line yAxisId="r" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', stroke: 'var(--card, #fff)', strokeWidth: 1.5 }} activeDot={{ r: 5, fill: '#10b981' }} isAnimationActive animationDuration={700} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
