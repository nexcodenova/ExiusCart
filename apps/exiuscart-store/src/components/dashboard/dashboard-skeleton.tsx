import { Skeleton } from '@/components/ui/skeleton';

// Shaped like the real dashboard (header, 5 KPI cards, trend + channel row,
// 3-up row) so the page doesn't jump when the data lands — and so the first
// paint never shows misleading empty states ("No sales in this period")
// while the stats request is still in flight.
const S = 'skeleton-shimmer animate-none';

function CardShell({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl border border-border bg-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className={`${S} h-7 w-64`} />
          <Skeleton className={`${S} h-4 w-44`} />
          <Skeleton className={`${S} h-3 w-72`} />
        </div>
        <div className="flex gap-2">
          <Skeleton className={`${S} h-11 w-[170px] rounded-lg`} />
          <Skeleton className={`${S} h-11 w-32 rounded-lg`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardShell key={i}>
            <div className="flex items-center gap-2.5">
              <Skeleton className={`${S} h-9 w-9 rounded-xl`} />
              <Skeleton className={`${S} h-3.5 w-24`} />
            </div>
            <Skeleton className={`${S} mt-5 h-8 w-32`} />
            <Skeleton className={`${S} mt-3 h-3 w-28`} />
            <Skeleton className={`${S} mt-4 h-3 w-20`} />
          </CardShell>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <CardShell className="lg:col-span-3">
          <Skeleton className={`${S} h-5 w-36`} />
          <Skeleton className={`${S} mt-3 h-8 w-40`} />
          <Skeleton className={`${S} mt-4 h-52 w-full rounded-xl`} />
        </CardShell>
        <CardShell className="lg:col-span-2">
          <Skeleton className={`${S} h-5 w-40`} />
          <div className="mt-5 flex items-center gap-5">
            <Skeleton className={`${S} h-36 w-36 shrink-0 rounded-full`} />
            <div className="w-full space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className={`${S} h-9 w-full`} />)}
            </div>
          </div>
        </CardShell>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardShell key={i}>
            <Skeleton className={`${S} h-5 w-40`} />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className={`${S} h-10 w-full`} />)}
            </div>
          </CardShell>
        ))}
      </div>
    </div>
  );
}
