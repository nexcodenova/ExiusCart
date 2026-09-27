'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Search, Sparkles } from 'lucide-react';
import { aiApi, prodoraAuth, type AiSearchResponse } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import PageIntro from '@/components/PageIntro';
import AiProductCard from '@/components/AiProductCard';

const EXAMPLES = ['Pet products under $30', 'Kitchen gadgets with at least 40% margin', 'Home decor under $25', 'Baby products between $10 and $30'];

function errText(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object' && typeof (d as { message?: unknown }).message === 'string') return (d as { message: string }).message;
  return fallback;
}

function AiSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<AiSearchResponse | null>(null);
  const [asked, setAsked] = useState('');

  useEffect(() => { if (!prodoraAuth.hasAccess()) router.replace('/'); }, [router]);

  const run = async (text: string) => {
    const query = text.trim();
    if (query.length < 2 || busy) return;
    setBusy(true); setError(''); setAsked(query);
    try { setData(await aiApi.search(query)); }
    catch (e) { setError(errText(e, 'The search did not work. Try again in a moment.')); }
    finally { setBusy(false); }
  };

  const locked = data && data.locked;
  const found = data && !data.locked ? data : null;

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <Sidebar />
      <main className="app-main pt-12">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 pb-10 pt-3 sm:px-6">
          <PageIntro title="Prodora AI" subtitle="Ask for products in plain words. Every result has real scores, and you can launch one in a click." />

          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <label htmlFor="ai-q" className="sr-only">What products do you want?</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2563EB]" />
                <input
                  id="ai-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} disabled={busy}
                  placeholder="Find me products for US pet owners under $30"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
              <button type="submit" disabled={busy || q.trim().length < 2}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-6 text-sm font-bold text-white transition hover:bg-[#1E4FC2] disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Searching…</> : <><Search className="h-4 w-4" /> Find products</>}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => { setQ(ex); run(ex); }} disabled={busy}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-[#2563EB]/40 hover:bg-blue-50 hover:text-[#2563EB] disabled:opacity-50">{ex}</button>
              ))}
            </div>
          </form>

          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

          {locked && (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-sm">
              <Lock className="mx-auto h-7 w-7 text-[#2563EB]" />
              <p className="mt-2 text-base font-bold text-[#111827]">Prodora AI is included with the Growth and Scale plans</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">Ask for products in plain words and get real scores, margins and a clear verdict for each, then launch one in a click.</p>
              <a href="https://exiuscart.com/pricing" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1E4FC2]">See plans</a>
            </div>
          )}

          {found && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p className="text-gray-600">
                  <span className="font-semibold text-[#111827]">{found.total} product{found.total === 1 ? '' : 's'}</span> for &ldquo;{asked}&rdquo;
                  {found.checked_count > 0 && <> · {found.checked_count} with a market check</>}
                </p>
                <p className="text-xs text-gray-400">{found.searches_left} searches left today</p>
              </div>
              <div className="flex flex-wrap items-center gap-2" aria-label="What we understood">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Understood</span>
                {found.understood.map((u) => <span key={u} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">{u}</span>)}
              </div>
              {found.results.length === 0 ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center">
                  <p className="text-base font-bold text-gray-800">Nothing matches that yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">Try a broader word, a higher price, or a lower margin. New products are added every day.</p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {found.results.map((c) => <AiProductCard key={c.id} card={c} />)}
                </div>
              )}
            </>
          )}

          {!data && !error && !busy && (
            <p className="text-center text-sm text-gray-400">Try one of the examples above, or ask in your own words.</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AiPage() {
  return <Suspense fallback={null}><AiSearch /></Suspense>;
}
