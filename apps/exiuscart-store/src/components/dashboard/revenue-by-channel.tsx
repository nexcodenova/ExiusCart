'use client';

import { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useCurrency } from '@/components/providers/currency-provider';
import { channelMeta } from '@/components/channels/channelMeta';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

// channelMeta() covers real sales channels (Shopify/eBay/Daraz/...) with
// their real logos — these aren't channels, they're order-source tags this
// same field also carries, so they get a friendlier label only.
const SOURCE_LABEL_OVERRIDES: Record<string, string> = {
  pos: 'Point of Sale', online: 'Online Store', channel: 'Marketplace', manual: 'Manual',
};
const DONUT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

export function RevenueByChannel({ stats, fmt }: { stats: DashboardStats | null; fmt: (n: number, d?: number) => string }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const { sym, convert } = useCurrency();
  const compactFmt = (n: number) => `${sym}${new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(convert(n))}`;

  const channelPie = (stats?.channelBreakdown ?? []).map((c, i) => {
    const meta = channelMeta(c.source);
    return {
      source: c.source,
      name: SOURCE_LABEL_OVERRIDES[c.source] ?? meta.label,
      value: Math.round(c.sales), orders: c.orders,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      icon: meta.icon, iconColor: meta.color, iconBg: meta.bg, logo: meta.logo,
    };
  }).sort((a, b) => b.value - a.value);
  const channelTotal = channelPie.reduce((s, d) => s + d.value, 0);

  return (
    <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Revenue by channel</h2>
        <span className="ml-auto text-xs text-muted-foreground">30 days</span>
      </div>
      {channelTotal === 0 ? (
        <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">No sales in last 30 days</div>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="relative h-32 w-32 shrink-0">
            {activeIdx !== null && channelPie[activeIdx] && (
              <div className="pointer-events-none absolute -top-2 left-1/2 z-10 w-max max-w-[10rem] -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                <p className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: channelPie[activeIdx].color }} />
                  <span className="truncate">{channelPie[activeIdx].name}</span>
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  <span className="font-bold tabular-nums text-foreground">{fmt(channelPie[activeIdx].value, 0)}</span>
                  {channelTotal > 0 && <> · {Math.round((channelPie[activeIdx].value / channelTotal) * 100)}%</>}
                </p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelPie} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={2} stroke="none"
                  isAnimationActive animationDuration={700} animationEasing="ease-out"
                  onMouseEnter={(_, i) => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                >
                  {channelPie.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={activeIdx === null || activeIdx === i ? 1 : 0.35} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
              <span className="text-[10px] text-muted-foreground">Total</span>
              <span className="text-sm font-bold tabular-nums text-foreground">{compactFmt(channelTotal)}</span>
            </div>
          </div>

          <div className="w-full min-w-0 flex-1 space-y-3">
            {channelPie.map((c) => {
              const pct = channelTotal > 0 ? (c.value / channelTotal) * 100 : 0;
              const Icon = c.icon;
              return (
                <div key={c.source} className="flex items-center gap-2.5">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md ${c.iconBg}`}>
                    {c.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.logo} alt={c.name} className="h-full w-full object-contain p-0.5" />
                    ) : (
                      <Icon className={`h-3.5 w-3.5 ${c.iconColor}`} />
                    )}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{c.name}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{fmt(c.value, 0)}</span>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
            {stats?.topProducts?.[0] && (
              <div className="mt-2 border-t border-border pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Top product</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{stats.topProducts[0].name}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{fmt(stats.topProducts[0].revenue, 0)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
