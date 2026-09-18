import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { SparkAreaChart } from '@/components/charts/SparkChart';

export function PeriodCard({ icon: Icon, label, value, sub, delta, color, plain, sparkData, sparkKey }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  delta?: number; color: string; plain?: boolean;
  // Optional inline trend line (SparkAreaChart) — real month-over-month
  // data already fetched for this dashboard (monthlyRevenue12m), just
  // never visualized before. sparkKey picks which field off each entry.
  sparkData?: { month: string; revenue: number; orders: number; growth: number }[];
  sparkKey?: 'revenue' | 'orders';
}) {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    violet: 'text-violet-600 dark:text-violet-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  };
  const iconMap: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconMap[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={`text-lg font-bold leading-tight tabular-nums ${plain ? 'text-foreground' : colorMap[color]}`}>{value}</p>
        {delta !== undefined && delta !== 0 && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
        {sub && !delta && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
      {sparkData && sparkKey && sparkData.length > 1 && (
        <SparkAreaChart
          data={sparkData}
          index="month"
          categories={[sparkKey]}
          colors={[(color === 'indigo' || color === 'violet' || color === 'emerald' || color === 'amber' || color === 'rose' ? color : 'gray') as any]}
          className="h-10 w-16 shrink-0"
        />
      )}
    </div>
  );
}

export function HealthCard({ icon: Icon, label, value, sub, good }: {
  icon: React.ElementType; label: string; value: string; sub: string; good: boolean;
}) {
  const color = good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500';
  const bg = good ? 'bg-emerald-500/10' : 'bg-red-500/10';
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={`text-lg font-bold leading-tight tabular-nums ${color}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}

export function StockRow({ name, stock, min }: { name: string; stock: number; min: number }) {
  const pct = Math.min(100, Math.max(6, min > 0 ? (stock / (min * 2)) * 100 : stock * 10));
  const critical = stock <= 2;
  return (
    <li>
      <div className="flex items-baseline justify-between text-sm">
        <span className="truncate pr-2 text-foreground">{name}</span>
        <span className={`shrink-0 tabular-nums ${critical ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{stock} left</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${critical ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

export function OrderRow({ id, customer, amount, status, time, fmt }: {
  id: string; customer: string; amount: string; status: string; time: string; fmt: (n: number, d?: number) => string;
}) {
  const badge: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    confirmed: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    processing: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    shipped: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400',
    delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    cancelled: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  };
  const initials = (customer || 'C').trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const timeStr = (() => { try { return new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch { return time; } })();
  const amtNum = parseFloat(amount);
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30 sm:px-6">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">{initials}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">#{id} · {customer}</p>
        <p className="truncate text-xs text-muted-foreground">{timeStr}</p>
      </div>
      <span className="tabular-nums text-sm font-semibold text-foreground">{isNaN(amtNum) ? amount : fmt(amtNum, 0)}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${badge[status] ?? 'bg-muted text-muted-foreground'}`}>{status}</span>
    </div>
  );
}

export function Shortcut({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/40">
      <Icon className="h-4 w-4 text-muted-foreground" /> {label}
    </Link>
  );
}
