'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, LogIn, Pencil, Activity } from 'lucide-react';
import { teamApi, type TeamMember } from '@/lib/api';
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
  created_at: string | null;
  acting_as: 'owner' | 'staff' | 'admin' | null;
  role: string | null;
  area: string | null;
}

function ago(iso: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const exact = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '';

export default function TeamActivityPage() {
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [who, setWho] = useState('all');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    teamApi.listMembers(shopId).then((r) => setMembers(r.data.members)).catch(() => {});
  }, [shopId]);

  const load = useCallback((reset: boolean, cursor?: number | null) => {
    if (!shopId) return;
    (reset ? setLoading : setLoadingMore)(true);
    setError('');
    teamApi.activity(shopId, { actor_email: who === 'all' ? undefined : who, before_id: reset ? undefined : cursor ?? undefined, limit: 50 })
      .then((r) => {
        setEvents((prev) => (reset ? r.data.events : [...prev, ...r.data.events]));
        setHasMore(!!r.data.has_more);
        setNextBeforeId(r.data.next_before_id ?? null);
      })
      .catch(() => setError('Could not load the activity.'))
      .finally(() => (reset ? setLoading(false) : setLoadingMore(false)));
  }, [shopId, who]);

  useEffect(() => { load(true); }, [load]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/staff" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Team
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Team activity</h1>
          <p className="text-sm text-muted-foreground">Every change made in your store, and who made it. Only you can see this.</p>
        </div>
        <div className="w-56">
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
      </div>

      {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {loading ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="p-4"><Skeleton className="h-10 w-full" /></div>)
          ) : events.length === 0 ? (
            <div className="p-10 text-center">
              <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Nothing yet</p>
              <p className="text-xs text-muted-foreground">Changes made in your store will appear here as they happen.</p>
            </div>
          ) : (
            events.map((e) => {
              const isLogin = e.event_type !== 'shop_action';
              return (
                <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isLogin ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                    {isLogin ? <LogIn className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-sm font-medium text-foreground">
                      {isLogin ? 'Signed in' : e.description}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.actor_name || e.actor_email}
                      {e.actor_name && e.actor_email ? ` · ${e.actor_email}` : ''}
                    </p>
                  </div>
                  {e.acting_as === 'staff' && <Badge variant="muted">{e.role ?? 'Team'}</Badge>}
                  {e.acting_as === 'owner' && <Badge variant="default">Owner</Badge>}
                  {e.acting_as === 'admin' && <Badge variant="outline">ExiusCart support</Badge>}
                  {e.country && e.country.length === 2 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={e.country}>
                      <CountryFlag code={e.country} className="h-3 w-4" /> {e.country}
                    </span>
                  )}
                  <span className="w-20 text-right text-xs text-muted-foreground" title={exact(e.created_at)}>{ago(e.created_at)}</span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {hasMore && !loading && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => load(false, nextBeforeId)} disabled={loadingMore}>
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </div>
  );
}
