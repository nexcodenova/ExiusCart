import { Lightbulb } from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  create_listing: 'creating new listings',
  update_stock: 'stock updates',
  update_price: 'price updates',
  sync_order: 'order sync',
  listing_status: 'listing status checks',
};

export default function SuccessRateBar({ successRate, topFailingAction, topFailingCount }: {
  successRate: number | null; topFailingAction: string | null; topFailingCount: number;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="font-bold text-foreground">{successRate != null ? `${successRate}% success rate` : 'No activity yet'}</p>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${successRate ?? 0}%` }} />
        </div>
      </div>
      {topFailingAction && (
        <div className="flex items-center gap-3 border-t border-border pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Most failures happen during {ACTION_LABELS[topFailingAction] ?? topFailingAction}</p>
            <p className="text-xs text-muted-foreground">{topFailingCount} failed attempt{topFailingCount !== 1 ? 's' : ''} this period</p>
          </div>
        </div>
      )}
    </div>
  );
}
