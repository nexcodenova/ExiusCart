import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface KpiCardProps {
  label: string;
  value: string;
  changePct?: number | null; // real period-over-period % — omit rather than fabricate
  icon: React.ReactNode;
  iconClassName?: string;
}

export default function KpiCard({ label, value, changePct, icon, iconClassName }: KpiCardProps) {
  const hasChange = typeof changePct === 'number';
  const positive = hasChange && changePct! >= 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClassName ?? 'bg-primary/10 text-primary'}`}>
            {icon}
          </div>
          {hasChange && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${positive ? 'text-emerald-600' : 'text-destructive'}`}>
              {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {Math.abs(changePct!).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-xs font-medium text-muted-foreground mt-3">{label}</p>
        <p className="text-2xl font-bold text-foreground tracking-tight mt-0.5 tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
