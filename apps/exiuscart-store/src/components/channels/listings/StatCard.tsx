import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number | null; // % change vs previous window, real or absent
  trendGoodDirection?: 'up' | 'down'; // "Failed" going up is bad, "Successful" going up is good
  iconClassName?: string;
  icon: React.ReactNode;
  // Optional real trend line, absolute-positioned bottom-right — pass a
  // <MiniSparkline /> built from real daily-bucketed data, never a
  // fabricated shape. Omitted entirely when there's nothing real to draw.
  sparkline?: React.ReactNode;
}

export default function StatCard({ title, value, trend, trendGoodDirection = 'up', iconClassName, icon, sparkline }: StatCardProps) {
  const isGood = trend != null && (trendGoodDirection === 'up' ? trend >= 0 : trend <= 0);
  return (
    <div className="relative overflow-hidden bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground z-10">{title}</p>
        <span className={`z-10 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconClassName ?? 'bg-primary/10 text-primary'}`}>
          {icon}
        </span>
      </div>
      <div className="mt-2 relative z-10">
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        {trend != null && (
          <p className={`mt-1 text-xs font-semibold flex items-center gap-1 ${isGood ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
            {trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend)}% <span className="font-normal text-muted-foreground">vs. previous period</span>
          </p>
        )}
      </div>
      {sparkline}
    </div>
  );
}
