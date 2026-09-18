'use client';

import { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
  shipped: '#06b6d4', delivered: '#10b981', cancelled: '#ef4444',
};

export function OrdersByStatus({ stats, fmt }: { stats: DashboardStats | null; fmt: (n: number, d?: number) => string }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const statusPie = Object.entries(stats?.orderStatusBreakdown ?? {}).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1), value: v, color: STATUS_COLORS[k] ?? '#94a3b8',
  }));
  const totalOrders = statusPie.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Orders by status</h2>
        <span className="ml-auto text-xs text-muted-foreground">All time</span>
      </div>
      {totalOrders === 0 ? (
        <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">No orders yet</div>
      ) : (
        <div className="space-y-2">
          <div className="relative mx-auto h-40 w-40 mb-4">
            {activeIdx !== null && statusPie[activeIdx] && (
              <div className="pointer-events-none absolute -top-2 left-1/2 z-10 w-max max-w-[10rem] -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                <p className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusPie[activeIdx].color }} />
                  <span className="truncate">{statusPie[activeIdx].name}</span>
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  <span className="font-bold tabular-nums text-foreground">{statusPie[activeIdx].value}</span>
                  {totalOrders > 0 && <> · {Math.round((statusPie[activeIdx].value / totalOrders) * 100)}%</>}
                </p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPie} dataKey="value" innerRadius={52} outerRadius={76} paddingAngle={2} stroke="none"
                  isAnimationActive animationDuration={700} animationEasing="ease-out"
                  onMouseEnter={(_, i) => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                >
                  {statusPie.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={activeIdx === null || activeIdx === i ? 1 : 0.35} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
              <span className="text-[10px] text-muted-foreground">Total</span>
              <span className="text-sm font-bold text-foreground">{totalOrders}</span>
            </div>
          </div>
          {statusPie.map(s => (
            <div key={s.name} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground capitalize truncate">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-foreground font-semibold">{Math.round((s.value / totalOrders) * 100)}%</span>
            </div>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Products</p>
              <p className="text-xs font-medium tabular-nums text-foreground">{(stats?.products ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Avg order</p>
              <p className="text-xs font-medium tabular-nums text-foreground">{fmt(stats?.avgOrderValue ?? 0, 0)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
