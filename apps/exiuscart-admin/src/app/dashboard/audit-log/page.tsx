'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ScrollText, Search, ChevronDown, ChevronRight, Loader2,
  LogIn, LogOut, UserPlus, ShieldAlert, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface TimelineBucket { time: string; count: number }

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

// Same visual language as StatusChip/PlanChip elsewhere in the admin —
// each event type gets a distinct color + icon so the list scans quickly,
// the way the Google Cloud Logs Explorer view this mirrors does with
// severity colors.
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
};

function eventStyle(type: string) {
  return EVENT_STYLES[type] ?? { label: type, color: 'bg-gray-500/10 text-gray-700 border-gray-500/20', icon: ScrollText };
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

// A small flag rendered from the 2-letter country code without any extra
// asset/library — matches the fi-<cc> convention already used for
// CountryFlag elsewhere, but this admin app doesn't have flag-icons
// installed, so this is a lightweight standalone equivalent.
function CountryTag({ code }: { code: string | null }) {
  if (!code) return <span className="text-gray-400">—</span>;
  const flag = code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  return <span title={code}>{flag} {code}</span>;
}

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);

  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [timelineDays, setTimelineDays] = useState(7);

  const load = useCallback((reset: boolean) => {
    const setter = reset ? setLoading : setLoadingMore;
    setter(true);
    setError('');
    adminApi.auditLog({
      event_type: filterType || undefined,
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
  }, [filterType, search, nextBeforeId]);

  useEffect(() => { load(true); }, [filterType, search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { adminApi.auditLogEventTypes().then((r) => setEventTypes(r.data?.event_types ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    adminApi.auditLogTimeline({ event_type: filterType || undefined, q: search || undefined, days: timelineDays })
      .then((r) => setTimeline(r.data?.buckets ?? []))
      .catch(() => setTimeline([]));
  }, [filterType, search, timelineDays]);

  const runSearch = () => setSearch(searchInput.trim());

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-[#6B3FD9]" /> Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Every signup, login, and staff action across the platform — with IP and country.</p>
        </div>
        <button onClick={() => load(true)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Timeline</p>
          <div className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setTimelineDays(d)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  timelineDays === d ? 'bg-[#6B3FD9] text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-[140px]">
          {timeline.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">No events in this range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="time"
                  tickFormatter={(v) => format(new Date(v), timelineDays > 2 ? 'MMM d' : 'HH:mm')}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy HH:mm')}
                  formatter={(value: number) => [value, 'events']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="count" fill="#6B3FD9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-[#6B3FD9] focus:outline-none">
          <option value="">All event types</option>
          {eventTypes.map((t) => <option key={t} value={t}>{eventStyle(t).label}</option>)}
        </select>
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
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
                </td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-500">No events found.</td></tr>
              ) : events.map((ev) => {
                const style = eventStyle(ev.event_type);
                const Icon = style.icon;
                const isOpen = expanded === ev.id;
                return (
                  <Fragment key={ev.id}>
                    <tr onClick={() => setExpanded(isOpen ? null : ev.id)}
                      className="hover:bg-gray-50 cursor-pointer transition">
                      <td className="px-4 py-3 text-gray-400">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${style.color}`}>
                          <Icon className="w-3 h-3" /> {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{fmtTime(ev.created_at)}</td>
                      <td className="px-4 py-3 text-gray-900">{ev.actor_email ?? <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-3"><CountryTag code={ev.country} /></td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{ev.ip_address ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{ev.description ?? '—'}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-gray-600 max-w-3xl">
                            <p><span className="text-gray-400">Event ID:</span> {ev.id}</p>
                            <p><span className="text-gray-400">Actor user ID:</span> {ev.actor_user_id ?? '—'}</p>
                            <p><span className="text-gray-400">Actor name:</span> {ev.actor_name ?? '—'}</p>
                            <p><span className="text-gray-400">Shop ID:</span> {ev.shop_id ?? '—'}</p>
                            <p className="sm:col-span-2 break-all"><span className="text-gray-400">User agent:</span> {ev.user_agent ?? '—'}</p>
                            {ev.extra && (
                              <p className="sm:col-span-2"><span className="text-gray-400">Extra:</span> <code className="text-[11px]">{JSON.stringify(ev.extra)}</code></p>
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
