'use client';

import { useEffect, useState } from 'react';
import { PackagePlus, CreditCard, PackageX, Truck, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { ordersApi } from '@/lib/api';
import type { ActivityEvent } from '@/lib/dashboard/dashboard-types';

const EVENT_META: Record<string, { icon: React.ElementType; className: string }> = {
  order_created: { icon: PackagePlus, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  payment_received: { icon: CreditCard, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  stock_low: { icon: PackageX, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  order_shipped: { icon: Truck, className: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  order_delivered: { icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  order_cancelled: { icon: XCircle, className: 'bg-red-500/10 text-red-500' },
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SystemNotifications({ shopId }: { shopId: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!shopId) { setLoading(false); return; }
    ordersApi.getActivityLog(shopId, 8)
      .then((r) => setEvents(r.data?.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [shopId]);

  const markRead = (id: number) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)));
    ordersApi.markActivityRead(shopId, id).catch(() => load());
  };

  const markAllRead = () => {
    setEvents((prev) => prev.map((e) => ({ ...e, is_read: true })));
    ordersApi.markAllActivityRead(shopId).catch(() => load());
  };

  const unreadCount = events.filter((e) => !e.is_read).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">System notifications</h2>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Mark all read
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : events.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">You're all caught up.</div>
      ) : (
        <div className="space-y-1">
          {events.map((e) => {
            const meta = EVENT_META[e.event_type] ?? { icon: PackagePlus, className: 'bg-muted text-muted-foreground' };
            const Icon = meta.icon;
            return (
              <button
                key={e.id}
                onClick={() => !e.is_read && markRead(e.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left transition hover:bg-muted/50 ${e.is_read ? 'opacity-60' : ''}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.className}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{e.title}</span>
                  {e.description && <span className="block truncate text-[10px] text-muted-foreground">{e.description}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                  {!e.is_read && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                  {timeAgo(e.created_at)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
