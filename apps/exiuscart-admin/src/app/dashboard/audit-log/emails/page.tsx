'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  Mail, RefreshCw, Loader2, Search, ChevronRight, ChevronDown, CheckCircle2, Circle, AlertTriangle, ShieldAlert, X, Globe, Ban, Store,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

type Tab = 'overview' | 'emails' | 'domains' | 'dnm';

interface Health { sent: number; delivered: number; bounced: number; hard_bounced: number; complained: number; blocked: number; bounce_rate: number; complaint_rate: number }
interface Overview {
  days: number;
  ses: { api_configured: boolean; region: string; configuration_set: string | null; topic_locked: boolean; last_report_at: string | null };
  totals: Health & { failed: number; suppressed: number; all: number };
  limits: { bounce: number; complaint: number; min_sample: number };
  per_day: { date: string; sent: number; bounced: number; complained: number }[];
  domains: { total: number; verified: number; pending: number; failed: number; suspended: number };
  paused_shops: number; suppressed_total: number;
  top_problem_shops: { shop_id: number; name: string | null; bounced: number; complained: number }[];
}
interface Ev {
  id: number; created_at: string | null; updated_at: string | null; status: string; category: string; kind: string | null; shop_id: number | null; shop_name: string | null;
  from_address: string | null; from_domain: string | null; recipient: string | null; subject: string | null;
  bounce_type: string | null; bounce_subtype: string | null; detail: string | null; via_webhook: boolean;
}
interface Dom {
  id: number; shop_id: number; shop_name: string; shop_email: string | null; domain: string; from_address: string; status: string; dkim_status: string | null;
  verified_at: string | null; last_checked_at: string | null; suspended_reason: string | null; suspended_by: string | null; marketing_paused: boolean; health: Health;
}
interface Sup { id: number; email: string; reason: string; shop_id: number | null; detail: string | null; created_at: string | null }

const utc = (iso: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + 'Z');
const fmt = (iso: string | null) => (iso ? utc(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '—');
function ago(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - utc(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

const STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: 'Sent', cls: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  delivered: { label: 'Delivered', cls: 'bg-green-500/10 text-green-700 border-green-500/20' },
  delayed: { label: 'Delayed', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  bounced: { label: 'Bounced', cls: 'bg-red-500/10 text-red-700 border-red-500/20' },
  complained: { label: 'Spam report', cls: 'bg-red-500/10 text-red-700 border-red-500/20' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/10 text-red-700 border-red-500/20' },
  failed: { label: 'Failed to send', cls: 'bg-red-500/10 text-red-700 border-red-500/20' },
  blocked: { label: 'Blocked (paused)', cls: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
  suppressed: { label: 'Not mailed', cls: 'bg-gray-500/10 text-gray-700 border-gray-500/20' },
  skipped: { label: 'Skipped', cls: 'bg-gray-500/10 text-gray-700 border-gray-500/20' },
};
const DOM_STATUS: Record<string, string> = {
  verified: 'bg-green-500/10 text-green-700 border-green-500/20', pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  failed: 'bg-red-500/10 text-red-700 border-red-500/20', suspended: 'bg-red-500/10 text-red-700 border-red-500/20',
};

function Chip({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}
function errText(e: any): string { const d = e?.response?.data?.detail; return typeof d === 'string' ? d : d?.message ?? 'Something went wrong.'; }

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({ onOpenShop }: { onOpenShop: (id: number) => void }) {
  const [days, setDays] = useState(7);
  const [o, setO] = useState<Overview | null>(null);
  const [err, setErr] = useState('');
  const [help, setHelp] = useState(false);
  useEffect(() => { setO(null); adminApi.emailOverview(days).then((r) => setO(r.data)).catch(() => setErr('Could not load the overview.')); }, [days]);
  if (err) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{err}</div>;
  if (!o) return <div className="py-16 text-center text-gray-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading…</div>;

  const t = o.totals;
  const max = Math.max(1, ...o.per_day.map((d) => d.sent));
  const setup = [
    { ok: o.ses.api_configured, label: 'AWS API keys added', hint: 'SES_API_ACCESS_KEY_ID and SES_API_SECRET_ACCESS_KEY on the server. Needed for sellers to register domains.' },
    { ok: !!o.ses.configuration_set, label: 'Configuration set named', hint: 'SES_CONFIGURATION_SET. Every email is tagged with it so Amazon sends back delivery reports.' },
    { ok: !!o.ses.last_report_at, label: o.ses.last_report_at ? `Delivery reports arriving (last ${ago(o.ses.last_report_at)})` : 'Delivery reports arriving', hint: 'No report has reached the server yet. Bounces and complaints will not show until the SNS subscription is set up.' },
    { ok: o.ses.topic_locked, label: 'Reports locked to your SNS topic', hint: 'SES_SNS_TOPIC_ARN. Optional but recommended: only messages from your own topic are accepted.' },
  ];
  const card = (k: string, v: string, s: string, warn = false) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{k}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${warn ? 'text-red-600' : 'text-gray-900'}`}>{v}</p>
      <p className="text-[11px] text-gray-500">{s}</p>
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><ShieldAlert className="h-4 w-4 text-[#6B3FD9]" /> Amazon SES connection</p>
          <button onClick={() => setHelp((v) => !v)} className="text-xs font-medium text-[#6B3FD9] hover:underline">{help ? 'Hide setup steps' : 'How to set this up'}</button>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {setup.map((s) => (
            <li key={s.label} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
              {s.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />}
              <div><p className="text-sm font-medium text-gray-900">{s.label}</p>{!s.ok && <p className="text-xs text-gray-500">{s.hint}</p>}</div>
            </li>
          ))}
        </ul>
        {help && (
          <ol className="mt-4 list-decimal space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 pl-8 text-sm text-gray-700">
            <li>In AWS (region <strong>{o.ses.region}</strong>): create an IAM user with SES v2 permissions to create, read and delete email identities. Add its keys to the server as <code className="rounded bg-white px-1">SES_API_ACCESS_KEY_ID</code> and <code className="rounded bg-white px-1">SES_API_SECRET_ACCESS_KEY</code> (and <code className="rounded bg-white px-1">SES_REGION</code>).</li>
            <li>SES → Configuration sets: create one (for example <em>exiuscart-events</em>) and set it as <code className="rounded bg-white px-1">SES_CONFIGURATION_SET</code>.</li>
            <li>Add an event destination to that set: type <strong>SNS</strong>, events <strong>Send, Delivery, Bounce, Complaint, Reject, Delivery delay</strong>. Create a new SNS topic for it.</li>
            <li>In SNS, create an <strong>HTTPS subscription</strong> on that topic to <code className="rounded bg-white px-1">https://&lt;your API host&gt;/api/v1/webhooks/ses</code>. It confirms itself. Then set <code className="rounded bg-white px-1">SES_SNS_TOPIC_ARN</code> to the topic&apos;s ARN.</li>
            <li>Restart the backend. Send yourself an email: within a minute it should show as Delivered here.</li>
          </ol>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Last {days} day{days !== 1 ? 's' : ''}</p>
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
          {[1, 7, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`rounded-md px-3 py-1 text-xs font-medium ${days === d ? 'bg-[#6B3FD9] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{d === 1 ? '24 hours' : `${d} days`}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {card('Emails sent', t.sent.toString(), `${t.all} logged in total`)}
        {card('Delivered', t.delivered.toString(), t.sent ? `${pct(t.delivered / t.sent, 0)} confirmed` : '—')}
        {card('Hard bounces', t.hard_bounced.toString(), `${pct(t.bounce_rate)} (limit ${pct(o.limits.bounce, 0)})`, t.bounce_rate >= o.limits.bounce * 0.6 && t.hard_bounced > 0)}
        {card('Spam reports', t.complained.toString(), `${pct(t.complaint_rate, 2)} (limit ${pct(o.limits.complaint)})`, t.complained > 0 && t.complaint_rate >= o.limits.complaint * 0.6)}
        {card('Not mailed', (t.blocked).toString(), 'suppressed or paused')}
        {card('Failed to send', t.failed.toString(), 'could not reach Amazon', t.failed > 0)}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-gray-900">Emails per day</p>
        {o.per_day.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">No emails in this period yet.</p> : (
          <div className="flex h-40 items-end gap-1.5">
            {o.per_day.map((d) => (
              <div key={d.date} className="group flex flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.sent} sent, ${d.bounced} bounced, ${d.complained} spam reports`}>
                <div className="flex w-full max-w-[36px] flex-col justify-end overflow-hidden rounded-t bg-[#6B3FD9]/25" style={{ height: `${Math.max(4, (d.sent / max) * 130)}px` }}>
                  {(d.bounced + d.complained) > 0 && <div className="bg-red-500" style={{ height: `${Math.min(100, ((d.bounced + d.complained) / Math.max(d.sent, 1)) * 100)}%` }} />}
                </div>
                <span className="text-[9px] text-gray-400">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-gray-500">Purple: emails sent. Red: the share that bounced or were reported as spam.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><Globe className="h-4 w-4 text-[#6B3FD9]" /> Custom domains</p>
          <div className="flex flex-wrap gap-2">
            <Chip cls={DOM_STATUS.verified}>{o.domains.verified} verified</Chip>
            <Chip cls={DOM_STATUS.pending}>{o.domains.pending} pending</Chip>
            <Chip cls={DOM_STATUS.failed}>{o.domains.failed} failed</Chip>
            <Chip cls={DOM_STATUS.suspended}>{o.domains.suspended} paused</Chip>
          </div>
          <p className="mt-3 text-xs text-gray-500">{o.paused_shops} store{o.paused_shops !== 1 ? 's' : ''} with marketing paused · {o.suppressed_total} address{o.suppressed_total !== 1 ? 'es' : ''} on the do-not-mail list</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><AlertTriangle className="h-4 w-4 text-amber-500" /> Stores with the most problems</p>
          {o.top_problem_shops.length === 0 ? <p className="py-3 text-sm text-gray-500">No bounces or spam reports in this period.</p> : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {o.top_problem_shops.map((s) => (
                  <tr key={s.shop_id}>
                    <td className="py-2 font-medium text-gray-900">{s.name ?? `Store #${s.shop_id}`}</td>
                    <td className="py-2 text-xs text-gray-500">{s.bounced} bounced · {s.complained} spam</td>
                    <td className="py-2 text-right"><button onClick={() => onOpenShop(s.shop_id)} className="text-xs font-medium text-[#6B3FD9] hover:underline">View emails</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Emails ────────────────────────────────────────────────────────────────────
function EmailsTab({ shop, clearShop }: { shop: number | null; clearShop: () => void }) {
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [problems, setProblems] = useState(false);
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [next, setNext] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback((reset: boolean, cursor?: number | null) => {
    setLoading(true); setErr('');
    adminApi.emailEvents({ status: status || undefined, category: category || undefined, shop_id: shop ?? undefined, problems: problems || undefined, q: q || undefined, before_id: reset ? undefined : cursor ?? undefined, limit: 50 })
      .then((r) => { setRows((p) => (reset ? r.data.events : [...p, ...r.data.events])); setMore(!!r.data.has_more); setNext(r.data.next_before_id ?? null); })
      .catch(() => setErr('Could not load emails.')).finally(() => setLoading(false));
  }, [status, category, shop, problems, q]);
  useEffect(() => { load(true); }, [load]);

  const sel = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#6B3FD9] focus:outline-none';
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={sel}>
          <option value="">All mail</option><option value="shop">On behalf of stores</option><option value="system">ExiusCart system mail</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={problems} onChange={(e) => setProblems(e.target.checked)} className="h-4 w-4 accent-[#6B3FD9]" /> Problems only</label>
        {shop !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#6B3FD9]/30 bg-[#6B3FD9]/10 px-3 py-1.5 text-xs font-medium text-[#5A2EC9]">
            <Store className="h-3 w-3" /> Store #{shop}
            <button onClick={clearShop} aria-label="Show all stores" className="rounded-full hover:bg-[#6B3FD9]/20"><X className="h-3 w-3" /></button>
          </span>
        )}
        <div className="flex min-w-[220px] max-w-sm flex-1 items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setQ(input.trim()); }} placeholder="Search recipient, subject or sender…" className={`${sel} flex-1`} />
          <button onClick={() => setQ(input.trim())} className="rounded-lg bg-[#6B3FD9] p-2 text-white hover:bg-[#5A2EC9]"><Search className="h-4 w-4" /></button>
        </div>
        <button onClick={() => load(true)} disabled={loading} className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>
      {err && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{err}</div>}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <tr><th className="w-8 py-2.5 pl-4 pr-1" /><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">When</th><th className="px-3 py-2.5">From</th><th className="px-3 py-2.5">To</th><th className="px-3 py-2.5">Subject</th><th className="px-3 py-2.5">Store</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-500">No emails found.</td></tr>
              : rows.map((e) => {
                const st = STATUS[e.status] ?? { label: e.status, cls: 'bg-gray-500/10 text-gray-700 border-gray-500/20' };
                const isOpen = open === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr onClick={() => setOpen(isOpen ? null : e.id)} className="cursor-pointer transition hover:bg-gray-50">
                      <td className="py-2 pl-4 pr-1 text-gray-400">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      <td className="whitespace-nowrap px-3 py-2"><Chip cls={st.cls}>{st.label}{e.bounce_type === 'Permanent' ? ' (permanent)' : e.bounce_type === 'Transient' ? ' (temporary)' : ''}</Chip></td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs"><span className="font-medium text-gray-900">{fmt(e.created_at)}</span><span className="ml-1.5 text-gray-400">· {ago(e.created_at)}</span></td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">{e.from_address}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-900">{e.recipient}</td>
                      <td className="max-w-[260px] truncate px-3 py-2 text-xs text-gray-700" title={e.subject ?? undefined}>{e.subject}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">{e.shop_name ?? (e.category === 'system' ? <span className="text-gray-400">ExiusCart</span> : '—')}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50"><td colSpan={7} className="px-6 py-4">
                        <dl className="grid max-w-4xl gap-x-8 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          {[['Event ID', String(e.id)], ['Kind', e.kind ?? '—'], ['Sender domain', e.from_domain ?? '—'], ['Last updated', fmt(e.updated_at ?? e.created_at)],
                            ['Bounce', e.bounce_type ? `${e.bounce_type}${e.bounce_subtype ? ' / ' + e.bounce_subtype : ''}` : '—'], ['Report from Amazon', e.via_webhook ? 'Received' : 'Not yet']].map(([k, v]) => (
                            <div key={k}><dt className="text-[10px] uppercase tracking-wider text-gray-500">{k}</dt><dd className="mt-0.5 break-all text-gray-900">{v}</dd></div>
                          ))}
                          <div className="sm:col-span-2 lg:col-span-4"><dt className="text-[10px] uppercase tracking-wider text-gray-500">Detail</dt><dd className="mt-0.5 break-words text-gray-900">{e.detail ?? '—'}</dd></div>
                        </dl>
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {more && !loading && <div className="border-t border-gray-100 p-4 text-center"><button onClick={() => load(false, next)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Load more</button></div>}
      </div>
    </div>
  );
}

// ── Domains ───────────────────────────────────────────────────────────────────
function DomainsTab({ onOpenShop }: { onOpenShop: (id: number) => void }) {
  const [rows, setRows] = useState<Dom[] | null>(null);
  const [paused, setPaused] = useState<{ shop_id: number; name: string; reason: string | null; source: string | null; since: string | null }[]>([]);
  const [busy, setBusy] = useState<string>('');
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    adminApi.emailDomains().then((r) => setRows(r.data.domains)).catch(() => setErr('Could not load domains.'));
    adminApi.emailPaused().then((r) => setPaused(r.data.shops)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (key: string, fn: () => Promise<unknown>) => { setBusy(key); setErr(''); try { await fn(); load(); } catch (e) { setErr(errText(e)); } finally { setBusy(''); } };
  if (!rows) return <div className="py-16 text-center text-gray-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading…</div>;
  const btn = 'rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50';
  return (
    <div className="space-y-6">
      {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{err}</div>}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <tr><th className="px-4 py-2.5">Store</th><th className="px-3 py-2.5">Sending address</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Sent (7d)</th><th className="px-3 py-2.5 text-right">Bounced</th><th className="px-3 py-2.5 text-right">Spam</th><th className="px-3 py-2.5">Marketing</th><th className="px-3 py-2.5 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-14 text-center text-gray-500">No seller has registered a domain yet.</td></tr> : rows.map((d) => (
                <tr key={d.id} className="align-middle">
                  <td className="px-4 py-2"><button onClick={() => onOpenShop(d.shop_id)} className="text-left font-medium text-gray-900 hover:text-[#6B3FD9]">{d.shop_name}</button><p className="text-[11px] text-gray-500">{d.shop_email ?? ''}</p></td>
                  <td className="px-3 py-2 text-xs text-gray-900">{d.from_address}</td>
                  <td className="px-3 py-2"><Chip cls={DOM_STATUS[d.status] ?? ''}>{d.status === 'suspended' ? `Paused by ${d.suspended_by}` : d.status.charAt(0).toUpperCase() + d.status.slice(1)}</Chip>{d.suspended_reason && <p className="mt-0.5 max-w-[220px] truncate text-[10px] text-gray-500" title={d.suspended_reason}>{d.suspended_reason}</p>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.health.sent}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${d.health.hard_bounced ? 'text-red-600' : ''}`}>{d.health.hard_bounced} <span className="text-[11px] text-gray-400">({pct(d.health.bounce_rate)})</span></td>
                  <td className={`px-3 py-2 text-right tabular-nums ${d.health.complained ? 'text-red-600' : ''}`}>{d.health.complained}</td>
                  <td className="px-3 py-2">{d.marketing_paused ? <Chip cls="bg-orange-500/10 text-orange-700 border-orange-500/20"><Ban className="h-3 w-3" /> Paused</Chip> : <span className="text-xs text-gray-500">Active</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1.5">
                      {d.status === 'suspended' ? <button className={btn} disabled={busy === `r${d.id}`} onClick={() => act(`r${d.id}`, () => adminApi.emailResumeDomain(d.id))}>Resume domain</button>
                        : <button className={btn} disabled={busy === `s${d.id}`} onClick={() => act(`s${d.id}`, () => adminApi.emailSuspendDomain(d.id))}>Suspend domain</button>}
                      {d.marketing_paused ? <button className={btn} disabled={busy === `m${d.id}`} onClick={() => act(`m${d.id}`, () => adminApi.emailResumeShop(d.shop_id))}>Resume marketing</button>
                        : <button className={btn} disabled={busy === `p${d.id}`} onClick={() => act(`p${d.id}`, () => adminApi.emailPauseShop(d.shop_id))}>Pause marketing</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><Ban className="h-4 w-4 text-orange-500" /> Stores with marketing email paused</p>
        {paused.length === 0 ? <p className="text-sm text-gray-500">None. Stores are paused automatically when 5% of their emails bounce or 0.5% are reported as spam.</p> : (
          <ul className="divide-y divide-gray-100">
            {paused.map((p) => (
              <li key={p.shop_id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-medium text-gray-900">{p.name}</span>
                <Chip cls="bg-gray-500/10 text-gray-700 border-gray-500/20">{p.source === 'auto' ? 'Automatic' : 'By admin'}</Chip>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-500" title={p.reason ?? undefined}>{p.reason}</span>
                <span className="text-xs text-gray-400">{ago(p.since)}</span>
                <button className={btn} onClick={() => act(`x${p.shop_id}`, () => adminApi.emailResumeShop(p.shop_id))}>Resume</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Do-not-mail list ──────────────────────────────────────────────────────────
function DoNotMailTab() {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Sup[] | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => { adminApi.emailSuppressions(q).then((r) => setRows(r.data.suppressions)).catch(() => setErr('Could not load the list.')); }, [q]);
  useEffect(() => { load(); }, [load]);
  const remove = async (s: Sup) => { if (!window.confirm(`Remove ${s.email} from the do-not-mail list? They will be emailed again.`)) return; try { await adminApi.emailRemoveSuppression(s.id); load(); } catch (e) { setErr(errText(e)); } };
  return (
    <div>
      <div className="mb-4 flex max-w-md items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setQ(input.trim()); }} placeholder="Search an email address…" className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#6B3FD9] focus:outline-none" />
        <button onClick={() => setQ(input.trim())} className="rounded-lg bg-[#6B3FD9] p-2 text-white hover:bg-[#5A2EC9]"><Search className="h-4 w-4" /></button>
      </div>
      <p className="mb-3 text-xs text-gray-500">Addresses that bounced permanently or reported us as spam. We never email them again (except sign-in codes and password links) so our sending reputation stays clean.</p>
      {err && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{err}</div>}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500"><tr><th className="px-4 py-2.5">Address</th><th className="px-3 py-2.5">Why</th><th className="px-3 py-2.5">Detail</th><th className="px-3 py-2.5">Added</th><th className="px-3 py-2.5 text-right" /></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {!rows ? <tr><td colSpan={5} className="px-4 py-14 text-center text-gray-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-14 text-center text-gray-500">No addresses on the list.</td></tr>
            : rows.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 text-gray-900">{s.email}</td>
                <td className="px-3 py-2"><Chip cls={s.reason === 'complaint' ? 'bg-red-500/10 text-red-700 border-red-500/20' : 'bg-amber-500/10 text-amber-700 border-amber-500/20'}>{s.reason === 'complaint' ? 'Reported as spam' : s.reason === 'bounce' ? 'Address does not exist' : 'By admin'}</Chip></td>
                <td className="max-w-[280px] truncate px-3 py-2 text-xs text-gray-500" title={s.detail ?? undefined}>{s.detail ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{fmt(s.created_at)}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => remove(s)} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100">Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmailMonitorPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [shop, setShop] = useState<number | null>(null);
  const openShop = (id: number) => { setShop(id); setTab('emails'); };
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' }, { id: 'emails', label: 'Emails' }, { id: 'domains', label: 'Domains' }, { id: 'dnm', label: 'Do-not-mail list' },
  ];
  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Mail className="h-6 w-6 text-[#6B3FD9]" /> Email Monitor</h1>
        <p className="mt-0.5 text-sm text-gray-500">Every email ExiusCart sends, what happened to it, sellers&apos; custom domains, and bounce and spam-report protection.</p>
      </div>
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === t.id ? 'border-[#6B3FD9] text-[#6B3FD9]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab onOpenShop={openShop} />}
      {tab === 'emails' && <EmailsTab shop={shop} clearShop={() => setShop(null)} />}
      {tab === 'domains' && <DomainsTab onOpenShop={openShop} />}
      {tab === 'dnm' && <DoNotMailTab />}
    </div>
  );
}
