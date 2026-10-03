'use client';

import { useId } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, ComposedChart, Area, Line, Tooltip } from 'recharts';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

const ICON_BG: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};
const STROKE: Record<string, string> = {
  indigo: '#6366f1', violet: '#8b5cf6', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e',
};

type Color = 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose';

// Every card ends in the same 40px chart area so they line up: a smooth
// mini line chart over the period (with a dashed grey line for the same
// buckets last year / the previous period when given), or a split bar
// (e.g. in stock vs out of stock) when the number is a share, not a trend.
export function KpiCard({
  icon: Icon, label, value, change, comparison, href, trend, trendLabels, formatPoint, color, split, compare, compareLabel,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  change?: number | null; // real period-over-period % — omitted rather than fabricated
  comparison: string;
  href: string;
  trend: number[];
  trendLabels?: string[];
  formatPoint?: (n: number) => string;
  color: Color;
  split?: { parts: { label: string; value: number; className: string }[] };
  compare?: number[];
  compareLabel?: string;
}) {
  const isPositive = (change ?? 0) > 0;
  const gid = useId().replace(/:/g, '');
  const stroke = STROKE[color];
  const hasTrend = trend.length > 1 && (trend.some((v) => v > 0) || !!compare?.some((v) => v > 0));
  const hasCompare = !!compare && compare.length === trend.length && compare.some((v) => v > 0);
  const data = trend.map((v, i) => ({ v, p: compare?.[i] ?? 0, label: trendLabels?.[i] ?? '' }));
  const splitTotal = split ? split.parts.reduce((s, p) => s + p.value, 0) : 0;

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-border bg-card px-3.5 pt-3 transition-all duration-200 hover:border-foreground/20 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${ICON_BG[color]}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-muted-foreground" />
      </div>

      <div className="mt-1.5">
        <p className="text-xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          {change !== undefined && change !== null && change !== 0 && (
            <span className={`flex items-center font-semibold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {isPositive ? <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" /> : <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}
              {Math.abs(change)}%
            </span>
          )}
          {comparison}
        </p>
      </div>

      <div className="-mx-3.5 mt-2 h-10">
        {hasTrend ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`kpi-${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={{ stroke, strokeOpacity: 0.3 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { v: number; p: number; label: string };
                  const f = (n: number) => (formatPoint ? formatPoint(n) : n.toLocaleString());
                  return (
                    <div className="rounded-md border border-border bg-popover px-2 py-1 text-[11px] shadow-md">
                      <p><span className="text-muted-foreground">{d.label}</span>{' '}<span className="font-medium tabular-nums text-foreground">{f(d.v)}</span></p>
                      {hasCompare && <p className="text-muted-foreground">{compareLabel ?? 'Before'} <span className="tabular-nums">{f(d.p)}</span></p>}
                    </div>
                  );
                }}
              />
              {hasCompare && (
                <Line type="monotone" dataKey="p" stroke="#94a3b8" strokeWidth={1.25} strokeDasharray="3 3" dot={false} activeDot={false} isAnimationActive={false} />
              )}
              <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.75} fill={`url(#kpi-${gid})`}
                dot={false} activeDot={{ r: 3, fill: stroke, strokeWidth: 0 }} isAnimationActive animationDuration={600} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : split && splitTotal > 0 ? (
          <div className="flex h-full flex-col justify-center gap-1.5 px-3.5">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
              {split.parts.map((p) => (
                <span key={p.label} className={p.className} style={{ width: `${(p.value / splitTotal) * 100}%` }} />
              ))}
            </div>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              {split.parts.map((p) => (
                <span key={p.label} className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${p.className}`} />{p.label} {p.value.toLocaleString()}</span>
              ))}
            </div>
          </div>
        ) : (
          // Flat baseline when there is nothing to chart yet, so every card keeps the same height
          <div className="mx-3.5 mt-6 border-t border-dashed border-border" />
        )}
      </div>
    </Link>
  );
}
