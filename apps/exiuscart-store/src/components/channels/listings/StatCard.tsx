import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number | null; // % change vs previous window, real or absent
  trendGoodDirection?: 'up' | 'down'; // "Failed" going up is bad, "Successful" going up is good
  iconClassName?: string;
  icon: React.ReactNode;
}

export default function StatCard({ title, value, trend, trendGoodDirection = 'up', iconClassName, icon }: StatCardProps) {
  const isGood = trend != null && (trendGoodDirection === 'up' ? trend >= 0 : trend <= 0);
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconClassName ?? 'bg-primary/10 text-primary'}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3">
        <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
        {trend != null && (
          <p className={`mt-1 text-xs font-semibold flex items-center gap-1 ${isGood ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
            {trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend)}% <span className="font-normal text-muted-foreground">vs. previous period</span>
          </p>
        )}
      </div>
    </div>
  );
}
