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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      <div className="inline-flex rounded-lg bg-muted/50 p-0.5 text-xs font-medium">
        {(['all', 'unread'] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 capitalize transition ${
              filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {f}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-xs text-muted-foreground">Order, payment and stock activity will show up here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((e) => {
              const meta = ACTIVITY_EVENT_META[e.event_type] ?? DEFAULT_ACTIVITY_EVENT_META;
              const Icon = meta.icon;
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => !e.is_read && markRead(e.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-muted/40 ${e.is_read ? 'opacity-60' : ''}`}>
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.className}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{e.title}</span>
                      {e.description && <span className="block text-xs text-muted-foreground">{e.description}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                      {!e.is_read && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
                      {activityTimeAgo(e.created_at)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {events.length >= PAGE_LIMIT && (
        <p className="text-center text-xs text-muted-foreground">Showing your {PAGE_LIMIT} most recent notifications.</p>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Order details live on the <Link href="/dashboard/orders" className="text-indigo-600 hover:underline dark:text-indigo-400">Orders page</Link>.
      </p>
    </div>
  );
}
