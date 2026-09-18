import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Activity, CalendarDays } from 'lucide-react';
import { BarChart as TremorBarChart } from '@/components/charts/BarChart';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

function buildHourly(data: { hour: number; orders: number; sales: number }[]) {
  const now = new Date();
  const map = Object.fromEntries(data.map(d => [d.hour, d]));
  return Array.from({ length: 24 }, (_, i) => {
    const h = (now.getHours() - 23 + i + 24) % 24;
    return { label: `${h}:00`, orders: map[h]?.orders ?? 0, sales: map[h]?.sales ?? 0 };
  });
}

export function OrderActivityCharts({ stats }: { stats: DashboardStats | null }) {
  const hourly = buildHourly(stats?.hourlyOrders ?? []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Order activity</h2>
          <span className="ml-auto text-xs text-muted-foreground">Last 24 hours</span>
        </div>
        <div className="h-44">
          {hourly.every(h => h.orders === 0) ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No orders in last 24 hours</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barSize={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.12} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={5} />
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
