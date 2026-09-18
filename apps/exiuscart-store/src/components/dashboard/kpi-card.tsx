'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

const ICON_BG: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};
const BAR_BG: Record<string, string> = {
  indigo: 'bg-indigo-300 dark:bg-indigo-500/50',
  violet: 'bg-violet-300 dark:bg-violet-500/50',
  emerald: 'bg-emerald-300 dark:bg-emerald-500/50',
  amber: 'bg-amber-300 dark:bg-amber-500/50',
  rose: 'bg-rose-300 dark:bg-rose-500/50',
};

export function KpiCard({
  icon: Icon, label, value, change, comparison, href, trend, color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  change?: number | null; // real period-over-period % — omitted rather than fabricated
  comparison: string;
  href: string;
  trend: number[];
  color: 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose';
}) {
  const isPositive = (change ?? 0) > 0;
  const max = Math.max(...trend, 1);

  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${ICON_BG[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-muted-foreground" />
      </div>

      <div className="mt-2">
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          {change !== undefined && change !== null && change !== 0 && (
            <span className={`flex items-center font-semibold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {isPositive ? <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" /> : <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}
              {Math.abs(change)}%
            </span>
          )}
          {comparison}
        </p>
      </div>

      {trend.length > 1 && (
        <div className="mt-2 flex h-6 items-end gap-[3px]">
          {trend.map((v, i) => (
            <span
              key={i}
              className={`flex-1 rounded-sm transition-all group-hover:opacity-80 ${BAR_BG[color]}`}
              style={{ height: `${Math.max(3, (v / max) * 22)}px` }}
            />
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
        View details
        <ArrowRight className="ml-1 h-3 w-3" />
      </div>
    </Link>
  );
}
