'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PenLine, RefreshCw, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { scoreboardApi } from '@/lib/api';

interface Metric {
  key: string; label: string; value: number; target: number | null; unit: string; auto: boolean; detail: string;
  state: 'reached' | 'started' | 'not_started' | 'rising' | 'flat' | 'falling' | 'measured' | 'on_target' | 'off_target';
  progress: number | null; stretch?: number; previous?: number;
}
interface Board { generated_at: string; metrics: Metric[]; features: { feature: string; shops: number; uses: number }[]; feature_window_days: number; reached: number }
interface SpendLine { key: string; label: string; uses: number; unit: string; cost: number; detail: string; today: number | null; free: boolean; by_purpose?: Record<string, number> }
interface Spend {
  month: string; estimate_note: string; lines: SpendLine[]; analyses: number; total: number; budget: number; percent: number | null; projected: number; over_budget: boolean;
  paid_limits: { today: number; month: number; daily_limit: number; monthly_limit: number }; daily: { date: string; ai: number; paid: number; total: number }[];
}

const STATE: Record<Metric['state'], { label: string; cls: string }> = {
  reached: { label: 'Reached', cls: 'bg-green-100 text-green-800' }, on_target: { label: 'On target', cls: 'bg-green-100 text-green-800' },
  started: { label: 'Building', cls: 'bg-blue-100 text-blue-800' }, not_started: { label: 'Not started', cls: 'bg-gray-100 text-gray-600' },
  rising: { label: 'Rising', cls: 'bg-green-100 text-green-800' }, flat: { label: 'Flat', cls: 'bg-gray-100 text-gray-700' },
  falling: { label: 'Falling', cls: 'bg-red-100 text-red-800' }, measured: { label: 'Measured', cls: 'bg-blue-100 text-blue-800' },
  off_target: { label: 'Off target', cls: 'bg-red-100 text-red-800' },
};
const MANUAL_KEY: Record<string, string> = { interviews: 'interviews', case_studies: 'case_studies', unvalidated: 'unvalidated_features' };

const usd = (n: number, d = 2) => `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const errText = (e: unknown, fallback: string) => {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof d === 'string' ? d : fallback;
};

function Editor({ metric, onSaved }: { metric: Metric; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(metric.value));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) { setError('Enter a whole number, zero or more.'); return; }
    setBusy(true); setError('');
    try { await scoreboardApi.setManual(MANUAL_KEY[metric.key], n, note); setOpen(false); onSaved(); }
    catch (e) { setError(errText(e, 'Could not save.')); } finally { setBusy(false); }
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B3FD9] hover:underline"><PenLine className="h-3.5 w-3.5" /> Update this number</button>;
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div><label htmlFor={`v-${metric.key}`} className="mb-1 block text-xs font-medium text-gray-600">Number now</label>
          <input id={`v-${metric.key}`} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 w-24 rounded-lg border border-gray-300 px-2 text-sm focus:border-[#6B3FD9] focus:outline-none" /></div>
        <div className="min-w-[10rem] flex-1"><label htmlFor={`n-${metric.key}`} className="mb-1 block text-xs font-medium text-gray-600">Note (optional)</label>
          <input id={`n-${metric.key}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What this number is made of" className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm focus:border-[#6B3FD9] focus:outline-none" /></div>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#6B3FD9] px-3 text-xs font-semibold text-white hover:bg-[#5A2EC9] disabled:opacity-50">{busy && <Loader2 className="h-3 w-3 animate-spin" />} Save</button>
        <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-white">Cancel</button>
      </div>
    </div>
  );
}

function MetricCard({ m, onSaved }: { m: Metric; onSaved: () => void }) {
  const st = STATE[m.state];
  const money = m.unit === 'USD';
  const shown = money ? usd(m.value, 0) : m.value.toLocaleString('en-US');
  const bar = m.state === 'reached' || m.state === 'on_target' ? 'bg-green-500' : m.state === 'off_target' ? 'bg-red-500' : 'bg-[#6B3FD9]';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{m.label}</p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
      </div>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-gray-900">{shown}</span>
        {m.target !== null && <span className="text-sm text-gray-500">{m.state === 'on_target' || m.state === 'off_target' ? `target ${m.target}` : `of ${money ? usd(m.target, 0) : m.target}${m.stretch ? ` (stretch ${usd(m.stretch, 0)})` : ''}`}</span>}
        {m.key === 'repeat' && m.previous !== undefined && (
          <span className="flex items-center gap-1 text-sm text-gray-500">{m.state === 'falling' ? <TrendingDown className="h-4 w-4 text-red-600" /> : <TrendingUp className="h-4 w-4 text-green-600" />} was {m.previous}</span>
        )}
      </p>
      {m.progress !== null && <div className="mt-3 h-1.5 rounded-full bg-gray-100"><div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.round(m.progress * 100)}%` }} /></div>}
      <p className="mt-3 text-xs leading-relaxed text-gray-500">{m.detail}</p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">{m.auto ? 'Counted from real data' : 'Kept by hand'}</p>
      {!m.auto && MANUAL_KEY[m.key] && <Editor metric={m} onSaved={onSaved} />}
    </div>
  );
}

function SpendBars({ daily }: { daily: Spend['daily'] }) {
  const max = Math.max(0.0001, ...daily.map((d) => d.total));
  return (
    <div className="flex h-24 items-end gap-1.5" role="img" aria-label="Estimated spend over the last 14 days">
      {daily.map((d) => (
        <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${usd(d.total, 3)}`}>
          <div className="w-full rounded-t bg-[#6B3FD9]/80" style={{ height: `${Math.max(d.total > 0 ? 6 : 0, (d.total / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function ScoreboardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [spend, setSpend] = useState<Spend | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [b, s] = await Promise.all([scoreboardApi.get(), scoreboardApi.spend()]);
      setBoard(b.data); setSpend(s.data);
    } catch (e) { setError(errText(e, 'Could not load the scoreboard.')); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pct = spend?.percent ?? 0;
  const meter = spend?.over_budget || pct > 100 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900"><Target className="h-6 w-6 text-[#6B3FD9]" /> Scoreboard</h1>
          <p className="text-sm text-gray-500">Are Prodora and ExiusCart actually working? Your targets, counted from real data.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex h-9 items-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </button>
      </div>

      {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {loading && !board ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#6B3FD9]" /></div>
      ) : board && (
        <>
          <p className="flex items-center gap-2 text-sm text-gray-600"><CheckCircle2 className="h-4 w-4 text-green-600" /> <strong className="text-gray-900">{board.reached} of {board.metrics.length}</strong> targets reached</p>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {board.metrics.map((m) => <MetricCard key={m.key} m={m} onSaved={load} />)}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-900">Features customers actually use</h2>
            <p className="mb-3 text-xs text-gray-500">How many shops used each feature in the last {board.feature_window_days} days.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="pb-2 font-semibold">Feature</th><th className="pb-2 text-right font-semibold">Shops</th><th className="pb-2 text-right font-semibold">Uses</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {board.features.map((f) => (
                    <tr key={f.feature}><td className="py-2 text-gray-800">{f.feature}</td><td className="py-2 text-right tabular-nums font-medium text-gray-900">{f.shops}</td><td className="py-2 text-right tabular-nums text-gray-500">{f.uses}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {spend && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Data spend meter <span className="font-normal text-gray-500">{spend.month}</span></h2>
              <p className="text-xs text-gray-500">What running the product intelligence costs against your monthly data budget.</p>
            </div>
            {spend.over_budget && <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"><AlertTriangle className="h-3.5 w-3.5" /> On course to pass the budget</span>}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span><strong className="text-2xl tabular-nums text-gray-900">{usd(spend.total, 2)}</strong> <span className="text-gray-500">of {usd(spend.budget, 2)} budget</span></span>
              <span className="text-gray-500">On course for {usd(spend.projected, 2)} by month end</span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-gray-100"><div className={`h-full rounded-full ${meter}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
            <p className="mt-1 text-xs text-gray-500">{pct}% of the budget used</p>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="pb-2 font-semibold">Service</th><th className="pb-2 text-right font-semibold">This month</th><th className="pb-2 text-right font-semibold">Est. cost</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {spend.lines.map((l) => (
                    <tr key={l.key}>
                      <td className="py-2.5"><p className="text-gray-900">{l.label}</p><p className="text-xs text-gray-500">{l.detail}{l.by_purpose && Object.keys(l.by_purpose).length ? ` · ${Object.entries(l.by_purpose).map(([k, v]) => `${k} ${v}`).join(', ')}` : ''}</p></td>
                      <td className="py-2.5 text-right tabular-nums text-gray-700">{l.uses.toLocaleString('en-US')} {l.unit}</td>
                      <td className="py-2.5 text-right tabular-nums font-medium text-gray-900">{l.free ? <span className="text-green-700">Free</span> : usd(l.cost, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-gray-500">
                Paid lookups today: {spend.paid_limits.today} of {spend.paid_limits.daily_limit} · this month: {spend.paid_limits.month} of {spend.paid_limits.monthly_limit}. {spend.analyses} product checks this month. {spend.estimate_note}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Last 14 days (estimated)</p>
              <SpendBars daily={spend.daily} />
              <div className="mt-1 flex justify-between text-[10px] text-gray-400"><span>{spend.daily[0]?.date.slice(5)}</span><span>{spend.daily[spend.daily.length - 1]?.date.slice(5)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
