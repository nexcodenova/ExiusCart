'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import {
  ScrollText, Search, ChevronDown, ChevronRight, Loader2,
  LogIn, LogOut, UserPlus, ShieldAlert, ShieldCheck, RefreshCw,
  Monitor, Smartphone, Store, Pencil, X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface AuditEvent {
  id: number;
  event_type: string;
  actor_user_id: number | null;
  actor_email: string | null;
  actor_name: string | null;
  shop_id: number | null;
  ip_address: string | null;
  country: string | null;
  user_agent: string | null;
  description: string | null;
  extra: Record<string, unknown> | null;
  created_at: string;
}

// Each event type gets a distinct color + icon so the list scans quickly,
// the way a Logs Explorer's severity colors do.
const EVENT_STYLES: Record<string, { label: string; color: string; icon: typeof LogIn }> = {
  signup: { label: 'Signup', color: 'bg-green-500/10 text-green-700 border-green-500/20', icon: UserPlus },
  social_signup: { label: 'Social Signup', color: 'bg-green-500/10 text-green-700 border-green-500/20', icon: UserPlus },
  login: { label: 'Login', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20', icon: LogIn },
  social_login: { label: 'Social Login', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20', icon: LogIn },
  admin_login: { label: 'Admin Login', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20', icon: ShieldCheck },
  login_failed: { label: 'Login Failed', color: 'bg-red-500/10 text-red-700 border-red-500/20', icon: ShieldAlert },
  staff_invited: { label: 'Staff Invited', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20', icon: UserPlus },
  staff_accepted: { label: 'Staff Joined', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20', icon: UserPlus },
  staff_removed: { label: 'Staff Removed', color: 'bg-gray-500/10 text-gray-700 border-gray-500/20', icon: LogOut },
  staff_role_changed: { label: 'Staff Role Changed', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20', icon: ShieldCheck },
  shop_action: { label: 'Store Action', color: 'bg-teal-500/10 text-teal-700 border-teal-500/20', icon: Pencil },
  staff_suspended: { label: 'Staff Paused', color: 'bg-gray-500/10 text-gray-700 border-gray-500/20', icon: LogOut },
  staff_reactivated: { label: 'Staff Reactivated', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20', icon: UserPlus },
  role_created: { label: 'Role Created', color: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20', icon: ShieldCheck },
  role_updated: { label: 'Role Updated', color: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20', icon: ShieldCheck },
  role_deleted: { label: 'Role Deleted', color: 'bg-gray-500/10 text-gray-700 border-gray-500/20', icon: LogOut },
};

function eventStyle(type: string) {
  return EVENT_STYLES[type] ?? { label: type, color: 'bg-gray-500/10 text-gray-700 border-gray-500/20', icon: ScrollText };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Deliberately small, dependency-free UA parsing — enough to tell an admin
// "Chrome on Windows" vs "Safari on iPhone" at a glance, not a full
// device-detection library. Order matters: Edge/Opera/Chrome all contain
// "Chrome", and iOS/Android UAs contain "Safari"/"Linux".
function parseUserAgent(ua: string | null): { browser: string; os: string; mobile: boolean } {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', mobile: false };
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' :
    /python-requests|curl|httpx|axios|node/i.test(ua) ? 'Script' : 'Other';
  const os =
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : 'Other';
  return { browser, os, mobile: /Mobile|iPhone|Android/.test(ua) };
}

// Bundled via the `flag-icons` package (its CSS is imported once in the root
// layout) - a real flag image, not a unicode flag emoji, which Windows
// browsers render as plain letters ("AE") instead of a flag.
function CountryCell({ code }: { code: string | null }) {
  if (!code || code.length !== 2) return <span className="text-gray-400">—</span>;
  let name = code.toUpperCase();
  try { name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? name; } catch { /* keep code */ }
  return (
    <span className="inline-flex items-center gap-2" title={name}>
      <span className={`fi fi-${code.toLowerCase()} inline-block h-4 w-[22px] shrink-0 rounded-sm shadow-sm`} role="img" aria-label={name} />
      <span className="text-gray-700">{name}</span>
    </span>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <div className="text-xs text-gray-700 mt-0.5 break-all">{children}</div>
    </div>
  );
}

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const [filterType, setFilterType] = useState('');
  const [shopFilter, setShopFilter] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);

  // Arrive pre-filtered from a store's panel: /dashboard/audit-log?shop=17&type=shop_action
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const shop = Number(q.get('shop'));
    if (shop > 0) setShopFilter(shop);
    if (q.get('type')) setFilterType(q.get('type') as string);
    setReady(true);
  }, []);

  const clearShop = () => {
    setShopFilter(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const load = useCallback((reset: boolean) => {
    const setter = reset ? setLoading : setLoadingMore;
    setter(true);
    setError('');
    adminApi.auditLog({
      event_type: filterType || undefined,
      shop_id: shopFilter ?? undefined,
      q: search || undefined,
      before_id: reset ? undefined : nextBeforeId ?? undefined,
      limit: 50,
    })
      .then((r) => {
        const data = r.data?.events ?? [];
        setEvents((prev) => (reset ? data : [...prev, ...data]));
        setHasMore(!!r.data?.has_more);
        setNextBeforeId(r.data?.next_before_id ?? null);
      })
      .catch(() => setError('Could not load the audit log.'))
      .finally(() => setter(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, shopFilter, search, nextBeforeId]);

  useEffect(() => { if (ready) load(true); }, [ready, filterType, shopFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { adminApi.auditLogEventTypes().then((r) => setEventTypes(r.data?.event_types ?? [])).catch(() => {}); }, []);

  const runSearch = () => setSearch(searchInput.trim());

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-[#6B3FD9]" /> Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Every signup, login, and staff action across the platform, with IP, country, and device.</p>
        </div>
        <button onClick={() => load(true)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-[#6B3FD9] focus:outline-none">
          <option value="">All event types</option>
          {eventTypes.map((t) => <option key={t} value={t}>{eventStyle(t).label}</option>)}
        </select>
        {shopFilter !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#6B3FD9]/30 bg-[#6B3FD9]/10 px-3 py-1.5 text-xs font-medium text-[#5A2EC9]">
            <Store className="h-3 w-3" /> Store #{shopFilter}
            <button onClick={clearShop} aria-label="Show all stores" className="rounded-full hover:bg-[#6B3FD9]/20"><X className="h-3 w-3" /></button>
          </span>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            placeholder="Search by email or description…"
            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#6B3FD9] focus:outline-none" />
          <button onClick={runSearch} className="p-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white rounded-lg">
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="pl-4 pr-1 py-2.5 w-8"></th>
                <th className="px-3 py-2.5">Event</th>
                <th className="px-3 py-2.5">When</th>
                <th className="px-3 py-2.5">Actor</th>
                <th className="px-3 py-2.5">Store</th>
                <th className="px-3 py-2.5">Location</th>
                <th className="px-3 py-2.5">Device</th>
                <th className="px-3 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
                </td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-500">No events found.</td></tr>
              ) : events.map((ev) => {
                const style = eventStyle(ev.event_type);
                const Icon = style.icon;
                const isOpen = expanded === ev.id;
                const ua = parseUserAgent(ev.user_agent);
                const DeviceIcon = ua.mobile ? Smartphone : Monitor;
                return (
                  <Fragment key={ev.id}>
                    <tr onClick={() => setExpanded(isOpen ? null : ev.id)}
                      className="hover:bg-gray-50 cursor-pointer transition">
                      <td className="pl-4 pr-1 py-2 text-gray-400">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${style.color}`}>
                          <Icon className="w-3 h-3" /> {style.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        <span className="text-gray-900 font-medium">{fmtDate(ev.created_at)}</span>
                        <span className="text-gray-500 font-mono ml-1.5">{fmtClock(ev.created_at)}</span>
                        <span className="text-gray-400 ml-1.5">· {timeAgo(ev.created_at)}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        <span className="text-gray-900 font-medium">{ev.actor_name || '—'}</span>
                        <span className="text-gray-500 ml-1.5">{ev.actor_email ?? ''}</span>
                        {ev.extra && (ev.extra as Record<string, unknown>).as ? (
                          <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-gray-600">
                            {String((ev.extra as Record<string, unknown>).as)}
                            {(ev.extra as Record<string, unknown>).role ? ` · ${String((ev.extra as Record<string, unknown>).role)}` : ''}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {ev.shop_id != null ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-700 bg-gray-100 rounded px-1.5 py-0.5">
                            <Store className="w-3 h-3 text-gray-500" /> #{ev.shop_id}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        <CountryCell code={ev.country} />
                        <span className="text-gray-400 font-mono ml-2">{ev.ip_address ?? ''}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                        <span className="inline-flex items-center gap-1.5">
                          <DeviceIcon className="w-3.5 h-3.5 text-gray-400" /> {ua.browser}
                          <span className="text-gray-400">· {ua.os}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs max-w-[240px] truncate" title={ev.description ?? undefined}>{ev.description ?? '—'}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-3 max-w-5xl">
                            <Detail label="Event ID">{ev.id}</Detail>
                            <Detail label="Exact time">{new Date(ev.created_at).toISOString()}</Detail>
                            <Detail label="Country code">{ev.country ?? '—'}</Detail>
                            <Detail label="IP address">{ev.ip_address ?? '—'}</Detail>
                            <Detail label="Actor user ID">{ev.actor_user_id ?? '—'}</Detail>
                            <Detail label="Shop ID">{ev.shop_id ?? '—'}</Detail>
                            <div className="sm:col-span-2"><Detail label="User agent">{ev.user_agent ?? '—'}</Detail></div>
                            {ev.extra && (
                              <div className="sm:col-span-2 lg:col-span-4">
                                <Detail label="Extra"><code className="text-[11px]">{JSON.stringify(ev.extra)}</code></Detail>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasMore && !loading && (
          <div className="p-4 border-t border-gray-200 text-center">
            <button onClick={() => load(false)} disabled={loadingMore}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60 inline-flex items-center gap-2">
              {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />} Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
