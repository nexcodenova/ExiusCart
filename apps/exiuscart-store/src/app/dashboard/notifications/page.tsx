'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { ordersApi } from '@/lib/api';
import {
  type ActivityEvent, ACTIVITY_EVENT_META, DEFAULT_ACTIVITY_EVENT_META, activityTimeAgo,
} from '@/lib/activity-event-meta';

// Backend caps /activity-log at 100 per request.
const PAGE_LIMIT = 100;

type Filter = 'all' | 'unread';

export default function NotificationsPage() {
  const [shopId, setShopId] = useState('');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => { setShopId(localStorage.getItem('shop_id') ?? ''); }, []);

  const load = (id: string) =>
    ordersApi.getActivityLog(id, PAGE_LIMIT)
      .then((res) => setEvents(res.data?.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    load(shopId);
  }, [shopId]);

  const markRead = (id: number) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)));
    ordersApi.markActivityRead(shopId, id).catch(() => load(shopId));
  };

  const markAllRead = () => {
    setEvents((prev) => prev.map((e) => ({ ...e, is_read: true })));
    ordersApi.markAllActivityRead(shopId).catch(() => load(shopId));
  };

  const unreadCount = events.filter((e) => !e.is_read).length;
  const visible = filter === 'unread' ? events.filter((e) => !e.is_read) : events;

  // Group by day (Today / Yesterday / date), newest first, like the Apify console's lists
  const groups: { label: string; items: ActivityEvent[] }[] = [];
  for (const e of visible) {
    const label = dayLabel(e.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e); else groups.push({ label, items: [e] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Orders, payments and stock activity from your store.{' '}
            {unreadCount > 0 ? `${unreadCount} unread.` : 'You’re all caught up.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllRead}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted">
            <CheckCheck className="h-4 w-4 text-muted-foreground" /> Mark all as read
          </button>
        )}
      </div>

      {/* Underlined tabs, Apify-style */}
      <div className="flex gap-6 border-b border-border text-sm">
        {(['all', 'unread'] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`-mb-px border-b-2 pb-2.5 font-medium capitalize transition ${
              filter === f ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-foreground">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border px-4 py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-16 text-center">
          <Bell className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Order, payment and stock activity will show up here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label} className="space-y-2">
              <h2 className="text-xs font-medium text-muted-foreground">{g.label}</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {g.items.map((e) => {
                  const meta = ACTIVITY_EVENT_META[e.event_type] ?? DEFAULT_ACTIVITY_EVENT_META;
                  const Icon = meta.icon;
                  return (
                    <li key={e.id}>
                      <button type="button" onClick={() => !e.is_read && markRead(e.id)}
                        className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-muted/40">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm ${e.is_read ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>{e.title}</span>
                          {e.description && <span className="block truncate font-mono text-xs text-muted-foreground">{e.description}</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{activityTimeAgo(e.created_at)}</span>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${e.is_read ? 'bg-transparent' : 'bg-indigo-500'}`} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {events.length >= PAGE_LIMIT && (
        <p className="text-xs text-muted-foreground">Showing your {PAGE_LIMIT} most recent notifications.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Order details live on the <Link href="/dashboard/orders" className="font-medium text-foreground underline-offset-2 hover:underline">Orders page</Link>.
      </p>
    </div>
  );
}

function dayLabel(iso: string | null): string {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
