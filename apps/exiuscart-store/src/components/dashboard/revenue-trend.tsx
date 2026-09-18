import {
  ResponsiveContainer, ComposedChart, Area, Line, ReferenceLine,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

export function RevenueTrend({
  stats, loading, fmt,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  fmt: (n: number, d?: number) => string;
}) {
  const monthly12m = stats?.monthlyRevenue12m ?? [];
  const monthlyTotalRev = monthly12m.reduce((s, m) => s + m.revenue, 0);
  const monthlyAvgRev = monthly12m.length ? monthlyTotalRev / monthly12m.length : 0;
  const monthlyFirstHalf = monthly12m.slice(0, Math.floor(monthly12m.length / 2));
  const monthlySecondHalf = monthly12m.slice(Math.floor(monthly12m.length / 2));
  const monthlyFirstHalfAvg = monthlyFirstHalf.length ? monthlyFirstHalf.reduce((s, m) => s + m.revenue, 0) / monthlyFirstHalf.length : 0;
  const monthlySecondHalfAvg = monthlySecondHalf.length ? monthlySecondHalf.reduce((s, m) => s + m.revenue, 0) / monthlySecondHalf.length : 0;
  const monthlyTrendDelta = monthlyFirstHalfAvg > 0 ? Math.round(((monthlySecondHalfAvg - monthlyFirstHalfAvg) / monthlyFirstHalfAvg) * 100) : null;

  return (
    <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Revenue trend</h2>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">{loading ? '—' : fmt(monthlyTotalRev, 0)}</p>
          {!loading && monthlyTrendDelta !== null && (
            <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${monthlyTrendDelta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {monthlyTrendDelta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(monthlyTrendDelta)}% vs first half of period
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Revenue
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Orders
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Growth %
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-px w-5 border-t-2 border-dashed border-indigo-400 opacity-60" /> Monthly avg
          </span>
        </div>
      </div>
      {loading || !monthly12m.length ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthly12m} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <YAxis yAxisId="g" hide domain={['dataMin - 15', 'dataMax + 15']} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
                    <p className="font-semibold text-foreground mb-1">{label}</p>
                    <p className="text-muted-foreground">Revenue: <span className="font-semibold text-foreground">{fmt(d.revenue, 0)}</span></p>
                    <p className="text-muted-foreground">Orders: <span className="font-semibold text-foreground">{d.orders}</span></p>
                    {d.growth !== 0 && <p className={`font-semibold ${d.growth > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{d.growth > 0 ? '+' : ''}{d.growth}% MoM</p>}
                  </div>
                );
              }} />
              <ReferenceLine yAxisId="l" y={monthlyAvgRev} stroke="#6366f1" strokeDasharray="6 3" strokeOpacity={0.45} />
              <Area yAxisId="r" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} fill="url(#ordersGradient)" dot={false} activeDot={{ r: 4, fill: '#10b981' }} isAnimationActive animationDuration={900} animationEasing="ease-out" />
              <Line yAxisId="g" type="linear" dataKey="growth" stroke="#f59e0b" strokeWidth={1.5} strokeOpacity={0.85} dot={{ r: 2, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 4, fill: '#f59e0b' }} isAnimationActive animationDuration={900} animationEasing="ease-out" />
              <Line yAxisId="l" type="linear" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#6366f1' }} isAnimationActive animationDuration={900} animationEasing="ease-out" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {stats?.monthlyRevenue12m && stats.monthlyRevenue12m.some(m => m.revenue > 0) && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-1.5 font-medium">Month</th>
                <th className="pb-1.5 text-right font-medium">Revenue</th>
                <th className="pb-1.5 text-right font-medium">Orders</th>
                <th className="pb-1.5 text-right font-medium">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...stats.monthlyRevenue12m].reverse().slice(0, 6).map((m, i) => (
                <tr key={i}>
                  <td className="py-1.5 font-medium text-foreground">{m.month}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">{fmt(m.revenue, 0)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{m.orders}</td>
                  <td className={`py-1.5 text-right tabular-nums font-semibold ${m.growth > 0 ? 'text-emerald-500' : m.growth < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {m.growth > 0 ? '+' : ''}{m.growth !== 0 ? `${m.growth}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function useMonthlyTrendDeltas(stats: DashboardStats | null) {
  const monthly12m = stats?.monthlyRevenue12m ?? [];
  const monthlyFirstHalf = monthly12m.slice(0, Math.floor(monthly12m.length / 2));
  const monthlySecondHalf = monthly12m.slice(Math.floor(monthly12m.length / 2));
  const firstAvg = monthlyFirstHalf.length ? monthlyFirstHalf.reduce((s, m) => s + m.revenue, 0) / monthlyFirstHalf.length : 0;
  const secondAvg = monthlySecondHalf.length ? monthlySecondHalf.reduce((s, m) => s + m.revenue, 0) / monthlySecondHalf.length : 0;
  const monthlyTrendDelta = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : null;

  const ordersFirstAvg = monthlyFirstHalf.length ? monthlyFirstHalf.reduce((s, m) => s + m.orders, 0) / monthlyFirstHalf.length : 0;
  const ordersSecondAvg = monthlySecondHalf.length ? monthlySecondHalf.reduce((s, m) => s + m.orders, 0) / monthlySecondHalf.length : 0;
  const monthlyOrdersTrendDelta = ordersFirstAvg > 0 ? Math.round(((ordersSecondAvg - ordersFirstAvg) / ordersFirstAvg) * 100) : null;

  return { monthlyTrendDelta, monthlyOrdersTrendDelta };
}
