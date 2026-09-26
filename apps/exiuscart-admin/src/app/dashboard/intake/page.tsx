'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Inbox, Loader2, X, Search, CheckCircle2, AlertTriangle, Send, Settings2, RefreshCw, Trash2, RotateCcw, Sparkles, Link2, Package, ExternalLink,
} from 'lucide-react';
import { adminApi, intakeApi } from '@/lib/api';
import { useAdminAccess } from '@/components/access-provider';

type Status = 'queued' | 'importing' | 'analyzing' | 'ready' | 'failed' | 'approved' | 'rejected' | 'published';
interface Item {
  id: number; status: Status; error: string | null; source_url: string; supplier: string;
  verdict: 'TEST' | 'WATCH' | 'AVOID' | null; confidence: string | null; margin_pct: number | null; competitor_count: number | null; reject_reason: string | null;
  product: { id: number; code: string | null; name: string; image_url: string | null; price: number; cost_price: number | null; shipping_cost: number | null; supplier_name: string | null } | null;
}
interface Summary {
  counts: Record<Status, number>; processing: number; ready_verdicts: { TEST: number; WATCH: number; AVOID: number; none: number };
  published_today: number; daily_limit: number; remaining_today: number;
  settings: { daily_publish_limit: number; publish_hour_utc: number; auto_publish_enabled: boolean; auto_analyze: boolean };
}
interface CjHit { pid: string; name: string; image: string; cost_price: number; category: string }
interface LinkResult { link: string; status: string; reason?: string }

const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `$${n.toFixed(2)}`);
const errText = (e: any, fb: string) => (typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : fb);

const TABS: { key: string; label: string; statuses?: Status[] }[] = [
  { key: 'ready', label: 'Ready to review' },
  { key: 'approved', label: 'Approved' },
  { key: 'processing', label: 'Importing', statuses: ['queued', 'importing', 'analyzing'] },
  { key: 'failed', label: 'Failed' },
  { key: 'published', label: 'Published' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];
const VERDICT_STYLE = { TEST: 'bg-green-100 text-green-800', WATCH: 'bg-amber-100 text-amber-800', AVOID: 'bg-gray-200 text-gray-700' };
const VERDICT_LABEL = { TEST: 'Test', WATCH: 'Watch', AVOID: 'Avoid' };
const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#6B3FD9] focus:outline-none focus:ring-2 focus:ring-[#6B3FD9]/20';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default function IntakePage() {
  const { can } = useAdminAccess();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState('ready');
  const [verdict, setVerdict] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [addTab, setAddTab] = useState<'links' | 'cj'>('links');
  const [links, setLinks] = useState('');
  const [linkResults, setLinkResults] = useState<{ counts: Record<string, number>; results: LinkResult[] } | null>(null);
  const [cjQuery, setCjQuery] = useState('');
  const [cjHits, setCjHits] = useState<CjHit[]>([]);
  const [cjPicked, setCjPicked] = useState<Set<string>>(new Set());
  const [cjBusy, setCjBusy] = useState(false);
  const [cjError, setCjError] = useState('');

  const [rejectFor, setRejectFor] = useState<number[] | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form, setForm] = useState({ daily_publish_limit: 100, publish_hour_utc: 6, auto_publish_enabled: false, auto_analyze: true });
  const [formError, setFormError] = useState('');
  const reqId = useRef(0);

  const flash = (t: string) => { setNotice(t); setTimeout(() => setNotice(''), 4000); };

  const loadSummary = useCallback(async () => { try { setSummary((await intakeApi.summary()).data); } catch { /* keep the last one */ } }, []);

  const loadItems = useCallback(async (quiet = false) => {
    const id = ++reqId.current;
    if (!quiet) setLoading(true);
    try {
      const t = TABS.find((x) => x.key === tab)!;
      const statuses = t.statuses ?? (tab === 'all' ? [undefined as any] : [tab as Status]);
      const results = await Promise.all(statuses.map((s: Status | undefined) => intakeApi.items({ status: s, verdict: verdict || undefined, q: q.trim() || undefined, limit: 50 })));
      if (id !== reqId.current) return;
      setItems(results.flatMap((r) => r.data.items));
      setTotal(results.reduce((n, r) => n + r.data.total, 0));
      setError('');
    } catch (e: any) { if (id === reqId.current) setError(errText(e, 'Could not load the queue.')); } finally { if (id === reqId.current) setLoading(false); }
  }, [tab, verdict, q]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { const h = setTimeout(() => { loadItems(); setSelected(new Set()); }, q ? 300 : 0); return () => clearTimeout(h); }, [loadItems, q]);

  // While anything is still importing, keep the numbers moving.
  const processing = summary?.processing ?? 0;
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => { loadSummary(); loadItems(true); }, 5000);
    return () => clearInterval(t);
  }, [processing, loadSummary, loadItems]);

  const refreshAll = async () => { await Promise.all([loadSummary(), loadItems(true)]); };

  const submitLinks = async () => {
    setBusy('links'); setError(''); setLinkResults(null);
    try {
      const r = await intakeApi.addLinks(links);
      setLinkResults({ counts: r.data.counts, results: r.data.results });
      if (r.data.counts.queued) { setLinks(''); flash(`${r.data.counts.queued} product${r.data.counts.queued === 1 ? '' : 's'} added. They are being imported now.`); setTab('processing'); }
      await refreshAll();
    } catch (e: any) { setError(errText(e, 'Could not add those links.')); } finally { setBusy(null); }
  };

  const searchCj = async (trending = false) => {
    setCjBusy(true); setCjError(''); setCjPicked(new Set());
    try {
      const r = trending ? await adminApi.cjTrending() : await adminApi.cjSearch(cjQuery.trim());
      setCjHits(r.data.products ?? []);
    } catch (e: any) { setCjError(errText(e, 'CJ search failed. Check that CJ is connected under Add Products.')); setCjHits([]); } finally { setCjBusy(false); }
  };

  const addCj = async () => {
    setBusy('cj');
    try {
      const r = await intakeApi.addCjPids([...cjPicked]);
      const c = r.data.counts;
      flash(`${c.queued} added${c.duplicate ? `, ${c.duplicate} already known` : ''}.`);
      setCjPicked(new Set()); setTab('processing'); await refreshAll();
    } catch (e: any) { setCjError(errText(e, 'Could not add those.')); } finally { setBusy(null); }
  };

  const act = async (ids: number[], action: 'approve' | 'reject' | 'retry' | 'delete', reason?: string) => {
    setBusy(action);
    try {
      const r = await intakeApi.bulk(ids, action, reason);
      const done = r.data.done.length, skipped = r.data.skipped.length;
      const word = { approve: 'approved', reject: 'rejected', retry: 'sent to retry', delete: 'cleared' }[action];
      flash(`${done} ${word}${skipped ? `, ${skipped} skipped: ${r.data.skipped[0].reason}` : ''}`);
      setSelected(new Set()); await refreshAll();
    } catch (e: any) { setError(errText(e, 'That did not work.')); } finally { setBusy(null); }
  };

  const publish = async (count?: number) => {
    setBusy('publish');
    try { const r = await intakeApi.publishNow(count); flash(`${r.data.published} published.`); await refreshAll(); }
    catch (e: any) { setError(errText(e, 'Could not publish.')); } finally { setBusy(null); }
  };

  const openSettings = () => { if (summary) setForm(summary.settings); setFormError(''); setSettingsOpen(true); };
  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy('settings'); setFormError('');
    try { await intakeApi.updateSettings(form); setSettingsOpen(false); flash('Schedule saved.'); await loadSummary(); }
    catch (err: any) { setFormError(errText(err, 'Could not save.')); } finally { setBusy(null); }
  };

  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...selected];
  const selItems = items.filter((i) => selected.has(i.id));
  const canReview = can('prodora.review'); const canAdd = can('prodora.add'); const canPublish = can('prodora.publish'); const canAnalyze = can('prodora.analyze');
  const c = summary?.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Inbox className="h-6 w-6 text-[#6B3FD9]" /> Product Intake</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Paste supplier links. Each one is imported hidden, checked against real competitor prices, and waits here for a decision. Only approved products are published, on your daily schedule.</p>
        </div>
        <div className="flex gap-2">
          {canPublish && <button type="button" onClick={openSettings} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><Settings2 className="h-4 w-4" /> Schedule</button>}
          {canPublish && (
            <button type="button" onClick={() => publish()} disabled={busy === 'publish' || !c || c.approved === 0}
              title={c && c.approved === 0 ? 'Nothing approved yet' : `Publishes up to the ${summary?.remaining_today ?? 0} left of today's limit`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6B3FD9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5A2EC9] disabled:cursor-not-allowed disabled:opacity-50">
              {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish now
            </button>
          )}
        </div>
      </div>

      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">{notice}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      {summary && c && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Importing</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">{summary.processing}{summary.processing > 0 && <Loader2 className="h-4 w-4 animate-spin text-[#6B3FD9]" />}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ready to review</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{c.ready}</p>
            <p className="mt-0.5 text-xs text-gray-500">{summary.ready_verdicts.TEST} test · {summary.ready_verdicts.WATCH} watch · {summary.ready_verdicts.AVOID} avoid</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Approved</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{c.approved}</p>
            <p className="mt-0.5 text-xs text-gray-500">waiting to publish</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Published today</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{summary.published_today}<span className="text-base font-medium text-gray-400"> / {summary.daily_limit}</span></p>
            <p className="mt-0.5 text-xs text-gray-500">{summary.settings.auto_publish_enabled ? `auto at ${String(summary.settings.publish_hour_utc).padStart(2, '0')}:00 UTC` : 'auto-publish is off'}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Failed</p>
            <p className={`mt-1 text-2xl font-bold ${c.failed ? 'text-red-600' : 'text-gray-900'}`}>{c.failed}</p>
          </div>
        </div>
      )}

      {canAdd && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex gap-1 border-b border-gray-200">
            {([['links', 'Paste links', Link2], ['cj', 'Find on CJ', Search]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => setAddTab(k)}
                className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${addTab === k ? 'border-[#6B3FD9] text-[#6B3FD9]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {addTab === 'links' ? (
            <div>
              <label htmlFor="links" className="mb-1 block text-sm font-medium text-gray-700">Product links, one per line</label>
              <textarea id="links" rows={5} value={links} onChange={(e) => setLinks(e.target.value)} className={`${inputCls} font-mono text-xs`}
                placeholder={'https://www.aliexpress.com/item/1005001234567890.html\nhttps://cjdropshipping.com/product-detail.html?pid=…'} />
              <p className="mt-1 text-xs text-gray-500">AliExpress and CJ links are imported. Alibaba and 1688 links are recognised but can not be imported automatically yet.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={submitLinks} disabled={!links.trim() || busy === 'links'} className="inline-flex items-center gap-2 rounded-lg bg-[#6B3FD9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5A2EC9] disabled:opacity-50">
                  {busy === 'links' && <Loader2 className="h-4 w-4 animate-spin" />} Add to queue
                </button>
                {linkResults && (
                  <span className="text-sm text-gray-600">
                    {linkResults.counts.queued} added
                    {linkResults.counts.duplicate ? ` · ${linkResults.counts.duplicate} already known` : ''}
                    {linkResults.counts.unsupported ? ` · ${linkResults.counts.unsupported} not supported` : ''}
                    {linkResults.counts.invalid ? ` · ${linkResults.counts.invalid} not readable` : ''}
                  </span>
                )}
              </div>
              {linkResults && linkResults.results.some((r) => r.status !== 'queued') && (
                <ul className="mt-3 space-y-1 rounded-lg bg-gray-50 p-3 text-xs">
                  {linkResults.results.filter((r) => r.status !== 'queued').map((r, i) => (
                    <li key={i} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /><span className="min-w-0 break-all"><span className="text-gray-500">{r.link}</span> <span className="text-gray-800">{r.reason}</span></span></li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input aria-label="Search CJ" value={cjQuery} onChange={(e) => setCjQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cjQuery.trim() && searchCj()}
                    placeholder="Search CJ, e.g. pet water fountain" className={`${inputCls} pl-9`} />
                </div>
                <button type="button" onClick={() => searchCj()} disabled={!cjQuery.trim() || cjBusy} className="rounded-lg border border-[#6B3FD9] px-4 py-2 text-sm font-semibold text-[#6B3FD9] hover:bg-[#6B3FD9]/5 disabled:opacity-50">Search</button>
                <button type="button" onClick={() => searchCj(true)} disabled={cjBusy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Trending on CJ</button>
              </div>
              {cjError && <p className="mt-2 text-sm text-red-600">{cjError}</p>}
              {cjBusy && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#6B3FD9]" /></div>}
              {cjHits.length > 0 && (
                <>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {cjHits.map((h) => (
                      <label key={h.pid} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 ${cjPicked.has(h.pid) ? 'border-[#6B3FD9] bg-[#6B3FD9]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={cjPicked.has(h.pid)} onChange={() => setCjPicked((s) => { const n = new Set(s); if (n.has(h.pid)) n.delete(h.pid); else n.add(h.pid); return n; })} className="h-4 w-4 accent-[#6B3FD9]" />
                        {h.image ? <img src={h.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-gray-100"><Package className="h-5 w-5 text-gray-400" /></div>}
                        <span className="min-w-0"><span className="block truncate text-sm text-gray-900">{h.name}</span><span className="text-xs text-gray-500">cost {money(h.cost_price)}</span></span>
                      </label>
                    ))}
                  </div>
                  <button type="button" onClick={addCj} disabled={cjPicked.size === 0 || busy === 'cj'} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#6B3FD9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5A2EC9] disabled:opacity-50">
                    {busy === 'cj' && <Loader2 className="h-4 w-4 animate-spin" />} Add {cjPicked.size || ''} to queue
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 pt-2">
          {TABS.map((t) => {
            const n = !c ? null : t.statuses ? t.statuses.reduce((s, k) => s + c[k], 0) : t.key === 'all' ? Object.values(c).reduce((a, b) => a + b, 0) : c[t.key as Status];
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? 'border-[#6B3FD9] text-[#6B3FD9]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                {t.label}{n !== null && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{n}</span>}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 pb-2">
            <select aria-label="Verdict filter" value={verdict} onChange={(e) => setVerdict(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700">
              <option value="">All verdicts</option><option value="TEST">Test</option><option value="WATCH">Watch</option><option value="AVOID">Avoid</option><option value="none">Not analysed</option>
            </select>
            <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input aria-label="Search the queue" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-36 rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-sm focus:border-[#6B3FD9] focus:outline-none" /></div>
            <button type="button" onClick={refreshAll} aria-label="Refresh" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><RefreshCw className="h-4 w-4" /></button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#6B3FD9]/20 bg-[#6B3FD9]/5 px-4 py-2 text-sm">
            <span className="font-medium text-gray-800">{selected.size} selected</span>
            {canReview && selItems.some((i) => i.status === 'ready') && <button type="button" onClick={() => act(ids, 'approve')} disabled={!!busy} className="rounded-lg bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700 disabled:opacity-50">Approve</button>}
            {canReview && selItems.some((i) => !['published', 'importing', 'analyzing'].includes(i.status)) && <button type="button" onClick={() => { setRejectReason(''); setRejectFor(ids); }} disabled={!!busy} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>}
            {canAdd && selItems.some((i) => i.status === 'failed') && <button type="button" onClick={() => act(ids, 'retry')} disabled={!!busy} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Retry</button>}
            {canReview && selItems.some((i) => ['failed', 'rejected'].includes(i.status)) && <button type="button" onClick={() => act(ids, 'delete')} disabled={!!busy} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Clear</button>}
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs font-medium text-gray-500 hover:underline">Clear selection</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-10 px-4 py-2.5"><input type="checkbox" aria-label="Select all" className="h-4 w-4 accent-[#6B3FD9]" checked={items.length > 0 && selected.size === items.length} onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} /></th>
                <th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5 text-right">Cost + shipping</th><th className="px-4 py-2.5">Verdict</th>
                <th className="px-4 py-2.5 text-right">Margin</th><th className="px-4 py-2.5 text-right">Competitors</th><th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#6B3FD9]" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">{tab === 'ready' ? 'Nothing waiting for review. Paste some links above.' : 'Nothing here.'}</td></tr>
              ) : items.map((it) => (
                <tr key={it.id} className={selected.has(it.id) ? 'bg-[#6B3FD9]/5' : ''}>
                  <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${it.product?.name ?? it.id}`} className="h-4 w-4 accent-[#6B3FD9]" checked={selected.has(it.id)} onChange={() => toggle(it.id)} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {it.product?.image_url ? <img src={it.product.image_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100"><Package className="h-5 w-5 text-gray-400" /></div>}
                      <div className="min-w-0">
                        <p className="max-w-[300px] truncate font-medium text-gray-900">{it.product?.name ?? (it.status === 'rejected' ? 'Rejected' : 'Importing…')}</p>
                        <p className="truncate text-xs text-gray-500">{it.product?.code ? `${it.product.code} · ` : ''}{it.supplier === 'cj' ? 'CJ Dropshipping' : 'AliExpress'}
                          <a href={it.source_url} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex text-[#6B3FD9]" aria-label="Open supplier page"><ExternalLink className="h-3 w-3" /></a></p>
                        {it.status === 'failed' && it.error && <p className="mt-0.5 max-w-[320px] text-xs text-red-600">{it.error}</p>}
                        {it.status === 'rejected' && it.reject_reason && <p className="mt-0.5 text-xs text-gray-500">Reason: {it.reject_reason}</p>}
                        {it.status === 'ready' && !it.verdict && it.error && <p className="mt-0.5 max-w-[320px] text-xs text-amber-700">{it.error}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {it.product ? <>{money(it.product.cost_price)} <span className="text-gray-400">+</span> {it.product.shipping_cost === null ? <span className="text-amber-700" title="Shipping is not known yet">?</span> : money(it.product.shipping_cost)}</> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {['queued', 'importing', 'analyzing'].includes(it.status) ? <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />{it.status === 'queued' ? 'Waiting' : it.status === 'importing' ? 'Importing' : 'Checking prices'}</span>
                      : it.verdict ? <span className={`rounded px-2 py-0.5 text-xs font-bold ${VERDICT_STYLE[it.verdict]}`}>{VERDICT_LABEL[it.verdict]}<span className="ml-1 font-medium opacity-70">{it.confidence}</span></span>
                      : <span className="text-xs text-gray-400">Not analysed</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{it.margin_pct !== null && it.margin_pct !== undefined ? `${it.margin_pct.toFixed(0)}%` : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{it.competitor_count ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {it.status === 'ready' && canReview && <button type="button" onClick={() => act([it.id], 'approve')} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>}
                      {['ready', 'approved', 'failed'].includes(it.status) && canReview && <button type="button" onClick={() => { setRejectReason(''); setRejectFor([it.id]); }} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Reject</button>}
                      {it.status === 'failed' && canAdd && <button type="button" onClick={() => act([it.id], 'retry')} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"><RotateCcw className="h-3.5 w-3.5" /> Retry</button>}
                      {it.product && ['ready', 'approved', 'published'].includes(it.status) && <Link href={`/dashboard/intelligence?product=${it.product.id}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"><Sparkles className="h-3.5 w-3.5" /> Analysis</Link>}
                      {['failed', 'rejected'].includes(it.status) && canReview && <button type="button" onClick={() => act([it.id], 'delete')} aria-label="Clear" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && total > items.length && <p className="border-t border-gray-100 px-4 py-2.5 text-center text-xs text-gray-500">Showing the first {items.length} of {total}. Use the filters to narrow the list.</p>}
      </div>

      {rejectFor && (
        <Modal title={`Reject ${rejectFor.length} product${rejectFor.length === 1 ? '' : 's'}?`} onClose={() => setRejectFor(null)}>
          <p className="mb-3 text-sm text-gray-600">Rejected products are removed from the catalogue drafts. You can still see the record under Rejected.</p>
          <label htmlFor="reason" className="mb-1 block text-sm font-medium text-gray-700">Reason <span className="font-normal text-gray-400">(optional)</span></label>
          <input id="reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} className={inputCls} placeholder="e.g. Low quality photos" autoFocus />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setRejectFor(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
            <button type="button" onClick={() => { const list = rejectFor; setRejectFor(null); act(list, 'reject', rejectReason.trim() || undefined); }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Reject</button>
          </div>
        </Modal>
      )}

      {settingsOpen && (
        <Modal title="Publishing schedule" onClose={() => setSettingsOpen(false)}>
          <form onSubmit={saveSettings} className="space-y-4">
            <div>
              <label htmlFor="limit" className="mb-1 block text-sm font-medium text-gray-700">Products to publish per day</label>
              <input id="limit" type="number" min={0} max={1000} value={form.daily_publish_limit} onChange={(e) => setForm({ ...form, daily_publish_limit: Number(e.target.value) })} className={inputCls} />
              <p className="mt-1 text-xs text-gray-500">Best verdicts go first. Products you approve beyond the limit wait for the next day.</p>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#6B3FD9]" checked={form.auto_publish_enabled} onChange={(e) => setForm({ ...form, auto_publish_enabled: e.target.checked })} />
              <span><span className="block text-sm font-medium text-gray-800">Publish automatically every day</span><span className="block text-xs text-gray-500">Off means products publish only when someone presses Publish now.</span></span>
            </label>
            {form.auto_publish_enabled && (
              <div>
                <label htmlFor="hour" className="mb-1 block text-sm font-medium text-gray-700">Publish from (UTC hour)</label>
                <select id="hour" value={form.publish_hour_utc} onChange={(e) => setForm({ ...form, publish_hour_utc: Number(e.target.value) })} className={inputCls}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00 UTC</option>)}
                </select>
              </div>
            )}
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#6B3FD9]" checked={form.auto_analyze} onChange={(e) => setForm({ ...form, auto_analyze: e.target.checked })} />
              <span><span className="block text-sm font-medium text-gray-800">Check competitor prices automatically</span><span className="block text-xs text-gray-500">Free eBay check on every new product. Paid Amazon and Walmart lookups are never automatic.</span></span>
            </label>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSettingsOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={busy === 'settings'} className="inline-flex items-center gap-2 rounded-lg bg-[#6B3FD9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5A2EC9] disabled:opacity-60">{busy === 'settings' && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
