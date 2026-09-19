import Link from 'next/link';
import { ShoppingCart, Radio } from 'lucide-react';
import DateRangePicker, { type DateRangeValue } from '@/components/channels/listings/DateRangePicker';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DashboardHeader({
  storeName, memberSince, channelsConnected, lastSyncedAt, dateRange, onDateRangeChange,
}: {
  storeName?: string;
  memberSince?: string;
  channelsConnected?: number;
  lastSyncedAt?: string | null;
  dateRange: DateRangeValue;
  onDateRangeChange: (v: DateRangeValue) => void;
}) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const lastSync = timeAgo(lastSyncedAt ?? null);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting()}{storeName ? `, ${storeName}` : ''}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{today}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {memberSince && <span>Member since {memberSince}</span>}
          {channelsConnected !== undefined && channelsConnected > 0 && (
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3 w-3 text-emerald-500" />
              {channelsConnected} channel{channelsConnected !== 1 ? 's' : ''} connected
            </span>
          )}
          {lastSync && <span>Last sync: {lastSync}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-[170px]">
          <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
        </div>
        <Link href="/dashboard/pos"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90">
          <ShoppingCart className="h-4 w-4" /> New sale
        </Link>
      </div>
    </div>
  );
}
