import { PackageCheck, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard/dashboard-types';

const TILES: { key: string; label: string; icon: React.ElementType; className: string; statuses?: string[] }[] = [
  { key: 'total', label: 'Total Orders', icon: PackageCheck, className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { key: 'processing', label: 'Processing', icon: Clock3, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', statuses: ['processing', 'confirmed', 'shipped', 'pending'] },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle, className: 'bg-red-500/10 text-red-500' },
];

export function OrdersByStatus({ stats }: { stats: DashboardStats | null; fmt?: (n: number, d?: number) => string }) {
  const breakdown = stats?.orderStatusBreakdown ?? {};
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);

  const valueFor = (tile: typeof TILES[number]): number => {
    if (tile.key === 'total') return total;
    if (tile.statuses) return tile.statuses.reduce((s, k) => s + (breakdown[k] ?? 0), 0);
    return breakdown[tile.key] ?? 0;
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Orders by status</h2>
        <span className="text-xs text-muted-foreground">All time</span>
      </div>
      {total === 0 ? (
        <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">No orders yet</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.key} className="rounded-xl border border-border bg-muted/40 p-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tile.className}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{valueFor(tile)}</p>
                <p className="text-[10px] text-muted-foreground">{tile.label}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
