'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, LogIn, Pencil, Activity, RefreshCw, ChevronRight, ChevronDown, Monitor, Smartphone,
} from 'lucide-react';
import { teamApi, type TeamMember } from '@/lib/api';
import { parseUserAgent, countryName } from '@/lib/user-agent';
import { CountryFlag } from '@/components/country-flag';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ActivityEvent {
  id: number;
  event_type: string;
  actor_email: string | null;
  actor_name: string | null;
  description: string | null;
  country: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
  acting_as: 'owner' | 'staff' | 'admin' | null;
  role: string | null;
  area: string | null;
}

const KINDS: Record<string, string> = { all: 'All activity', changes: 'Changes only', signins: 'Sign-ins only' };

// The API sends UTC timestamps without a zone suffix; without this the browser reads them as local time.
const utc = (iso: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + 'Z');
const fmtDate = (iso: string) => utc(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtClock = (iso: string) => utc(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - utc(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 break-all text-xs text-foreground">{children}</div>
    </div>
  );
}

function RoleBadge({ e }: { e: ActivityEvent }) {
  if (e.acting_as === 'owner') return <Badge variant="default">Owner</Badge>;
  if (e.acting_as === 'staff') return <Badge variant="muted">{e.role ?? 'Team'}</Badge>;
  if (e.acting_as === 'admin') return <Badge variant="outline">ExiusCart support</Badge>;
  return null;
}

export default function TeamActivityPage() {
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [who, setWho] = useState('all');
  const [kind, setKind] = useState('all');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    if (!shopId) return;
    teamApi.listMembers(shopId).then((r) => setMembers(r.data.members)).catch(() => {});
  }, [shopId]);

  const load = useCallback((reset: boolean, cursor?: number | null) => {
    if (!shopId) return;
    (reset ? setLoading : setLoadingMore)(true);
    setError('');
    teamApi.activity(shopId, {
      actor_email: who === 'all' ? undefined : who,
      kind: kind === 'all' ? undefined : kind,
      before_id: reset ? undefined : cursor ?? undefined,
      limit: 50,
    })
      .then((r) => {
        setEvents((prev) => (reset ? r.data.events : [...prev, ...r.data.events]));
        setHasMore(!!r.data.has_more);
        setNextBeforeId(r.data.next_before_id ?? null);
      })
      .catch(() => setError('Could not load the activity.'))
      .finally(() => (reset ? setLoading(false) : setLoadingMore(false)));
  }, [shopId, who, kind]);

  useEffect(() => { load(true); }, [load]);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/staff" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Team
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Team activity</h1>
          <p className="text-sm text-muted-foreground">Every change made in your store and every sign-in, with who, where and on what device. Only you can see this</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48">
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {members.filter((m) => m.status !== 'invited').map((m) => (
                  <SelectItem key={m.id} value={m.email}>{m.full_name || m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KINDS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" title="Refresh" onClick={() => load(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 py-2.5 pl-4 pr-1" />
                  <th className="px-3 py-2.5">Event</th>
                  <th className="px-3 py-2.5">When</th>
                  <th className="px-3 py-2.5">Who</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Device</th>
                  <th className="px-3 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  [0, 1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={7} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>)
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-foreground">Nothing yet</p>
                      <p className="text-xs text-muted-foreground">Changes and sign-ins will appear here as they happen.</p>
                    </td>
                  </tr>
                ) : events.map((e) => {
                  const isSignIn = e.event_type !== 'shop_action';
                  const open = openId === e.id;
                  const ua = parseUserAgent(e.user_agent);
                  const DeviceIcon = ua.mobile ? Smartphone : Monitor;
                  return (
                    <Fragment key={e.id}>
                      <tr onClick={() => setOpenId(open ? null : e.id)} className="cursor-pointer transition hover:bg-muted/40">
                        <td className="py-2 pl-4 pr-1 text-muted-foreground">
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {isSignIn ? (
                            <Badge variant="muted" className="gap-1"><LogIn className="h-3 w-3" /> Sign-in</Badge>
                          ) : (
                            <Badge variant="default" className="gap-1"><Pencil className="h-3 w-3" /> Change</Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs">
                          {e.created_at && (
                            <>
                              <span className="font-medium text-foreground">{fmtDate(e.created_at)}</span>
                              <span className="ml-1.5 font-mono text-muted-foreground">{fmtClock(e.created_at)}</span>
                              <span className="ml-1.5 text-muted-foreground/70">· {ago(e.created_at)}</span>
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs">
                          <span className="font-medium text-foreground">{e.actor_name || e.actor_email}</span>
                          {e.actor_name && e.actor_email && <span className="ml-1.5 text-muted-foreground">{e.actor_email}</span>}
                          <span className="ml-2 inline-block align-middle"><RoleBadge e={e} /></span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs">
                          {e.country && e.country.length === 2 ? (
                            <span className="inline-flex items-center gap-2">
                              <CountryFlag code={e.country} className="h-4 w-[22px] shadow-sm" />
                              <span className="text-foreground">{countryName(e.country)}</span>
                              {e.ip_address && <span className="font-mono text-muted-foreground">{e.ip_address}</span>}
                            </span>
                          ) : e.ip_address ? (
                            <span className="font-mono text-muted-foreground">{e.ip_address}</span>
                          ) : <span className="text-muted-foreground/60">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-foreground">
                          {e.user_agent ? (
                            <span className="inline-flex items-center gap-1.5">
                              <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground" /> {ua.browser}
                              <span className="text-muted-foreground">· {ua.os}</span>
                            </span>
                          ) : <span className="text-muted-foreground/60">—</span>}
                        </td>
                        <td className="max-w-[260px] truncate px-3 py-2 text-xs text-foreground" title={e.description ?? undefined}>
                          {isSignIn ? 'Signed in' : e.description}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-muted/30">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid max-w-4xl gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                              <Detail label="Exact time">{e.created_at ? utc(e.created_at).toISOString() : '—'}</Detail>
                              <Detail label="Event ID">{e.id}</Detail>
                              <Detail label="Area">{e.area ? <span className="capitalize">{e.area}</span> : '—'}</Detail>
                              <Detail label="Country code">{e.country ?? '—'}</Detail>
                              <Detail label="IP address">{e.ip_address ?? '—'}</Detail>
                              <Detail label="Acting as">{e.acting_as ? <span className="capitalize">{e.acting_as}{e.role ? ` · ${e.role}` : ''}</span> : '—'}</Detail>
                              <div className="sm:col-span-2"><Detail label="User agent">{e.user_agent ?? '—'}</Detail></div>
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
            <div className="border-t border-border p-4 text-center">
              <Button variant="outline" onClick={() => load(false, nextBeforeId)} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
