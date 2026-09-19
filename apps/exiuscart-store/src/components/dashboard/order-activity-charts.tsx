'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Activity, CalendarDays } from 'lucide-react';
import { BarChart as TremorBarChart } from '@/components/charts/BarChart';
import { dashboardApi } from '@/lib/api';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

type ActivityWindow = '24h' | '3d' | '7d';
const WINDOW_LABELS: Record<ActivityWindow, string> = { '24h': '24 hours', '3d': '3 days', '7d': '7 days' };

export function OrderActivityCharts({ stats, shopId }: { stats: DashboardStats | null; shopId: string }) {
  const [activityWindow, setActivityWindow] = useState<ActivityWindow>('24h');
  const [buckets, setBuckets] = useState<{ label: string; orders: number; sales: number }[]>([]);

  // Deliberately its own fetch, independent of the page's main date-range
  // filter and main `stats` — this is a "what's happening right now" pulse
  // check with its own short window, not a historical view, so switching
  // it shouldn't reload the whole dashboard.
  useEffect(() => {
    if (!shopId) return;
    dashboardApi.getStats(shopId, { activity_window: activityWindow })
      .then((r) => setBuckets(r.data?.activityBuckets ?? []))
      .catch(() => {});
  }, [shopId, activityWindow]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Order activity</h2>
          <div className="ml-auto flex items-center gap-1 rounded-lg bg-muted p-0.5">
            {(Object.keys(WINDOW_LABELS) as ActivityWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setActivityWindow(w)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  activityWindow === w ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {WINDOW_LABELS[w]}
              </button>
            ))}
          </div>
        </div>
        <div className="h-44">
          {buckets.every((b) => b.orders === 0) ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No orders in the last {WINDOW_LABELS[activityWindow]}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barSize={activityWindow === '24h' ? 6 : activityWindow === '3d' ? 10 : 24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.12} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={activityWindow === '24h' ? 5 : activityWindow === '3d' ? 3 : 0} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
                        <p className="font-medium text-foreground mb-1">{label}</p>
                        <p className="text-muted-foreground">Orders: <span className="font-semibold text-foreground">{payload[0]?.value}</span></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="orders" fill="#6366f1" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Orders by day of week</h2>
          <span className="ml-auto text-xs text-muted-foreground">Last 30 days</span>
        </div>
        <div className="h-44">
          {(stats?.dailyBreakdown ?? []).every(d => d.orders === 0) ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No orders yet</div>
          ) : (
            <TremorBarChart
              className="h-full"
              data={(stats?.dailyBreakdown ?? []).map((d) => ({ day: d.day, Orders: d.orders }))}
              index="day"
              categories={['Orders']}
              colors={['indigo']}
              showLegend={false}
              allowDecimals={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
