import { MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface SmsUsage {
  plan: string;
  daily_used: number; daily_limit: number | null;
  monthly_used: number; monthly_limit: number | null;
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground tabular-nums">
          {used.toLocaleString()} {unlimited ? '' : `/ ${limit.toLocaleString()}`}
          {unlimited && <span className="text-muted-foreground font-normal"> · Unlimited</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function SmsUsageCard({ usage }: { usage: SmsUsage }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">SMS quota — {usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1)} plan</p>
        </div>
        <Meter label="Today" used={usage.daily_used} limit={usage.daily_limit} />
        <Meter label="This month" used={usage.monthly_used} limit={usage.monthly_limit} />
      </CardContent>
    </Card>
  );
}
