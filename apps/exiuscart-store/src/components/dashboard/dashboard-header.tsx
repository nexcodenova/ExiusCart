'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Radio } from 'lucide-react';
import DateRangePicker, { type DateRangeValue } from '@/components/channels/listings/DateRangePicker';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// A recent sync reads as "5m ago"; one older than a month reads as its date.
function syncedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
  // Re-render every minute so "5m ago" keeps counting while the dashboard stays open.
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60000); return () => clearInterval(t); }, []);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const lastSync = syncedLabel(lastSyncedAt ?? null);
  const hasChannels = channelsConnected !== undefined && channelsConnected > 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting()}{storeName ? `, ${storeName}` : ''}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
          <span>{today}</span>
          {memberSince && <><span aria-hidden className="text-border">•</span><span>Member since {memberSince}</span></>}
          {hasChannels && (
            <>
              <span aria-hidden className="text-border">•</span>
              <span className="inline-flex items-center gap-1">
                <Radio className="h-3.5 w-3.5 text-emerald-500" />
                {channelsConnected} channel{channelsConnected !== 1 ? 's' : ''} connected
              </span>
              <span aria-hidden className="text-border">•</span>
              <span>{lastSync ? `Last sync: ${lastSync}` : 'Not synced yet'}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="w-[160px]">
          <DateRangePicker value={dateRange} onChange={onDateRangeChange} compact />
        </div>
        <Link href="/dashboard/pos"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3.5 text-sm font-semibold text-background transition hover:opacity-90">
          <ShoppingCart className="h-4 w-4" /> New sale
        </Link>
      </div>
    </div>
  );
}
