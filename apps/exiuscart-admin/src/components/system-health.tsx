'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, CircleSlash, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type State = 'ok' | 'warn' | 'down' | 'off';
interface Check {
  key: string;
  name: string;
  group: 'platform' | 'sites' | 'integrations';
  status: State;
  detail: string;
  ms: number | null;
  ssl_days?: number | null;
}
interface Health {
  overall: 'healthy' | 'degraded' | 'down';
  checked_at: string;
  counts: Record<State, number>;
  checks: Check[];
}

const REFRESH_MS = 60_000;

const GROUPS: { id: Check['group']; title: string }[] = [
  { id: 'platform', title: 'Platform' },
  { id: 'sites', title: 'Websites' },
  { id: 'integrations', title: 'Connected services' },
];

const TILE: Record<State, { icon: React.ElementType; ring: string; icon_cls: string }> = {
  ok: { icon: CheckCircle2, ring: 'border-emerald-200 bg-emerald-50/50', icon_cls: 'text-emerald-600' },
  warn: { icon: AlertTriangle, ring: 'border-amber-200 bg-amber-50/60', icon_cls: 'text-amber-600' },
  down: { icon: XCircle, ring: 'border-red-200 bg-red-50/60', icon_cls: 'text-red-600' },
  off: { icon: CircleSlash, ring: 'border-gray-200 bg-gray-50', icon_cls: 'text-gray-400' },
};

const OVERALL = {
  healthy: { label: 'All systems healthy', cls: 'bg-emerald-600', sub: 'Everything that is switched on is working.' },
  degraded: { label: 'Needs attention', cls: 'bg-amber-500', sub: 'Everything is up, but something below needs a look.' },
  down: { label: 'Something is down', cls: 'bg-red-600', sub: 'A core part of ExiusCart is not responding.' },
} as const;

export function SystemHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const res = await adminApi.getHealth(force);
      setHealth(res.data);
      setUnreachable(false);
    } catch {
      // The panel itself could not get an answer: the API is the thing that is down.
      setUnreachable(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const overall = unreachable ? 'down' : health?.overall;
  const head = overall ? OVERALL[overall] : null;

  return (
    <section aria-label="System health" className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-white', head?.cls ?? 'bg-gray-300')}>
            {!head ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
          </span>
          <div>
            <h2 className="font-semibold text-gray-900">
              {unreachable ? 'Cannot reach the API' : head?.label ?? 'Checking systems…'}
            </h2>
            <p className="text-xs text-gray-500">
              {unreachable
                ? 'The admin panel could not get an answer from the backend. Stores may be affected too.'
                : head?.sub ?? 'Running the first check'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {health && !unreachable && (
            <div className="hidden items-center gap-3 text-xs sm:flex">
              <span className="inline-flex items-center gap-1 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />{health.counts.ok} working</span>
              {health.counts.warn > 0 && <span className="inline-flex items-center gap-1 text-amber-700"><span className="h-2 w-2 rounded-full bg-amber-500" />{health.counts.warn} warning</span>}
              {health.counts.down > 0 && <span className="inline-flex items-center gap-1 text-red-700"><span className="h-2 w-2 rounded-full bg-red-500" />{health.counts.down} down</span>}
              {health.counts.off > 0 && <span className="inline-flex items-center gap-1 text-gray-500"><span className="h-2 w-2 rounded-full bg-gray-300" />{health.counts.off} not set up</span>}
            </div>
          )}
          <div className="text-right text-xs text-gray-400">
            {health && <div>Checked {format(new Date(health.checked_at), 'HH:mm:ss')}</div>}
            <div>Refreshes every minute</div>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Check again now"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {health && (
        <div className="space-y-5 p-5">
          {GROUPS.map((g) => {
            const items = health.checks.filter((c) => c.group === g.id);
            if (items.length === 0) return null;
            return (
              <div key={g.id}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{g.title}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {items.map((c) => {
                    const t = TILE[c.status];
                    return (
                      <div key={c.key} className={cn('flex items-start gap-3 rounded-xl border p-3', t.ring)}>
                        <t.icon className={cn('mt-0.5 h-5 w-5 shrink-0', t.icon_cls)} aria-label={c.status} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                            {c.ms !== null && <span className="shrink-0 text-xs tabular-nums text-gray-400">{c.ms} ms</span>}
                          </div>
                          <p className="text-xs text-gray-600">{c.detail}</p>
                          {typeof c.ssl_days === 'number' && c.ssl_days > 0 && (
                            <p className="text-xs text-gray-400">Certificate valid {c.ssl_days} more days</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
