'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MailSearch, RefreshCw, Search } from 'lucide-react';
import { emailMonitorApi, type EmailMonitorEvent } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type Overview = Awaited<ReturnType<typeof emailMonitorApi.overview>>['data'];

const utc = (iso: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + 'Z');
const when = (iso: string | null) => (iso ? utc(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// Plain words for what happened to an email, and whether it is a problem the seller should look at.
const STATUS: Record<string, { label: string; tone: 'good' | 'neutral' | 'bad' | 'warn'; hint: string }> = {
  delivered: { label: 'Delivered', tone: 'good', hint: 'Reached the inbox.' },
  sent: { label: 'Sent', tone: 'neutral', hint: 'Handed to the mail service; no delivery report yet.' },
  delayed: { label: 'Delayed', tone: 'warn', hint: 'The receiving server is slow; delivery is still being tried.' },
  bounced: { label: 'Bounced', tone: 'bad', hint: 'The address does not exist or its inbox rejected the message.' },
  complained: { label: 'Marked as spam', tone: 'bad', hint: 'The recipient reported this email as spam.' },
  failed: { label: 'Failed', tone: 'bad', hint: 'The email could not be sent.' },
  rejected: { label: 'Rejected', tone: 'bad', hint: 'The mail service refused to send it.' },
  suppressed: { label: 'Not sent', tone: 'warn', hint: 'Skipped: this address bounced or reported spam before.' },
  blocked: { label: 'Blocked', tone: 'warn', hint: 'Skipped: marketing email for this store is paused.' },
  skipped: { label: 'Skipped', tone: 'neutral', hint: 'Not sent.' },
};
const TONE = {
  good: 'border-transparent bg-green-500/10 text-green-600 dark:text-green-400',
  neutral: 'border-transparent bg-muted text-muted-foreground',
  bad: 'border-transparent bg-red-500/10 text-red-600 dark:text-red-400',
  warn: 'border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400',
} as const;

const FILTERS = [
  { id: 'all', label: 'All email' },
  { id: 'problems', label: 'Problems' },
] as const;

function Stat({ label, value, hint, bad }: { label: string; value: number; hint: string; bad?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${bad && value > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{value.toLocaleString()}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function EmailMonitorPage() {
  const [shopId, setShopId] = useState('');
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState<'all' | 'problems'>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [events, setEvents] = useState<EmailMonitorEvent[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setShopId(localStorage.getItem('shop_id') ?? ''); }, []);
  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 350); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    if (!shopId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [o, e] = await Promise.all([
        emailMonitorApi.overview(shopId, days),
        emailMonitorApi.events(shopId, { problems: filter === 'problems', q: query || undefined, limit: 30 }),
      ]);
      setOverview(o.data);
      setEvents(e.data.events);
      setNext(e.data.has_more ? e.data.next_before_id : null);
    } catch {
      setError('Could not load your email activity. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [shopId, days, filter, query]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!next || !shopId) return;
    setLoadingMore(true);
    try {
      const e = await emailMonitorApi.events(shopId, { problems: filter === 'problems', q: query || undefined, before_id: next, limit: 30 });
      setEvents((prev) => [...prev, ...e.data.events]);
      setNext(e.data.has_more ? e.data.next_before_id : null);
    } catch { /* keep what is shown */ } finally { setLoadingMore(false); }
  };

  const t = overview?.totals;
  const bounceOver = !!t && !!overview && t.sent >= overview.limits.min_sample && t.bounce_rate >= overview.limits.bounce;
  const complaintOver = !!t && !!overview && t.sent >= overview.limits.min_sample && t.complaint_rate >= overview.limits.complaint;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><MailSearch className="h-6 w-6 text-muted-foreground" /> Email Monitor</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every email sent for your store (order updates, invoices, quotes, reminders, campaigns) and what happened to it.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted/50 p-0.5 text-xs font-medium">
            {[7, 30, 90].map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1.5 transition ${days === d ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {d} days
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {overview?.marketing_paused && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-foreground">Marketing email is paused for your store</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {overview.marketing_paused_reason || 'Too many emails bounced or were reported as spam.'} Order and invoice emails still send. Clean your customer list and contact support to turn campaigns back on.
            </p>
          </div>
        </div>
      )}
      {(bounceOver || complaintOver) && !overview?.marketing_paused && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Your email health needs attention.</span>{' '}
            {bounceOver && <>{(t!.bounce_rate * 100).toFixed(1)}% of your emails bounced (keep it under {(overview!.limits.bounce * 100).toFixed(0)}%). </>}
            {complaintOver && <>{(t!.complaint_rate * 100).toFixed(2)}% were reported as spam (keep it under {(overview!.limits.complaint * 100).toFixed(1)}%). </>}
            Remove addresses that bounce and only email people who asked to hear from you.
          </p>
        </div>
      )}

      {loading && !overview ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : t ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Sent" value={t.sent} hint={`last ${overview!.days} days`} />
          <Stat label="Delivered" value={t.delivered} hint="reached the inbox" />
          <Stat label="Bounced" value={t.bounced} hint="address not reachable" bad />
          <Stat label="Marked as spam" value={t.complained} hint="reported by recipients" bad />
          <Stat label="Not sent" value={t.blocked + t.failed} hint="skipped or failed" bad />
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg bg-muted/50 p-0.5 text-xs font-medium">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                  className={`rounded-md px-3 py-1.5 transition ${filter === f.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email address or subject" className="pl-9" />
            </div>
          </div>

          {loading && events.length === 0 ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">{filter === 'problems' ? 'No problems found' : 'No email yet'}</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {filter === 'problems' || query ? 'Nothing matches this view.' : 'Emails your store sends will show up here with what happened to each one.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((e) => {
                const s = STATUS[e.status] ?? { label: e.status, tone: 'neutral' as const, hint: '' };
                return (
                  <li key={e.id} className="flex flex-wrap items-start gap-x-4 gap-y-1.5 py-3">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="truncate text-sm font-medium text-foreground">{e.subject || '(no subject)'}</p>
                      <p className="truncate text-xs text-muted-foreground">To {e.recipient || 'unknown'}</p>
                      {(s.tone === 'bad' || s.tone === 'warn') && (
                        <p className="mt-1 text-xs text-muted-foreground">{s.hint}{e.detail && s.tone === 'bad' ? ` (${e.detail.slice(0, 140)})` : ''}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {e.kind === 'marketing' && <Badge variant="outline">Campaign</Badge>}
                      <Badge className={TONE[s.tone]} title={s.hint}>{s.label}</Badge>
                      <span className="w-28 text-right text-xs tabular-nums text-muted-foreground">{when(e.created_at)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {next && (
            <div className="flex justify-center pt-1">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Show more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
