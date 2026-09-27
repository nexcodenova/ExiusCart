'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2, Package, Rocket } from 'lucide-react';
import { aiApi, type AiCard, type AiLaunchResult, type AiScore } from '@/lib/api';
import LoadingImage from '@/components/LoadingImage';

const STORE = 'https://store.exiuscart.com';
const usd = (n: number | null | undefined) => (n == null ? '-' : '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));

// Test candidate is guidance from real prices, not a promise of sales (same wording as the Competition section).
const VERDICT = {
  TEST: 'bg-green-600 text-white', WATCH: 'bg-amber-500 text-white', AVOID: 'bg-gray-500 text-white',
} as const;
const SATURATION = { Low: 'bg-green-100 text-green-800', Medium: 'bg-amber-100 text-amber-800', High: 'bg-red-100 text-red-800' } as const;

function errText(e: unknown, fallback: string): { text: string; productId?: number } {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof d === 'string') return { text: d };
  if (d && typeof d === 'object') {
    const o = d as { message?: string; product_id?: number };
    return { text: o.message ?? fallback, productId: o.product_id };
  }
  return { text: fallback };
}

// One score tile. A score we could not measure says so and never shows a number.
function Tile({ label, s, text, sub }: { label: string; s: AiScore; text?: string; sub?: string }) {
  const on = s.measured && s.value != null;
  return (
    <div className="rounded-lg bg-gray-50 p-2.5" title={on ? (s.source ?? '') : (s.why ?? 'Not measured')}>
      <p className="truncate text-[11px] font-medium text-gray-500">{label}</p>
      {on ? (
        <>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">{text ?? `${s.value}/100`}</p>
          {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
          <div className="mt-1.5 h-1 rounded-full bg-gray-200"><div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${s.value}%` }} /></div>
        </>
      ) : (
        <p className="mt-0.5 text-xs font-medium text-gray-400">Not measured</p>
      )}
    </div>
  );
}

export default function AiProductCard({ card }: { card: AiCard }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<AiLaunchResult | null>(null);
  const [error, setError] = useState<{ text: string; productId?: number } | null>(null);
  const sc = card.scores;

  const launch = async () => {
    setBusy(true); setError(null);
    try { setDone(await aiApi.launch(card.id)); }
    catch (e) { setError(errText(e, 'Could not launch this product. Try again in a moment.')); }
    finally { setBusy(false); }
  };

  return (
    <article className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        <Link href={`/product/${card.id}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-gray-50 sm:h-28 sm:w-28">
          {card.image_url
            ? <LoadingImage src={card.image_url} alt={card.name} loading="lazy" className="object-cover" sizes="112px" />
            : <span className="flex h-full w-full items-center justify-center"><Package className="h-8 w-8 text-gray-300" /></span>}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2563EB]">Product</p>
              <Link href={`/product/${card.id}`} className="line-clamp-2 text-base font-bold leading-snug text-[#111827] hover:text-[#2563EB]">{card.name}</Link>
              <p className="mt-0.5 truncate text-xs text-gray-500">{[card.category, card.supplier].filter(Boolean).join(' · ')}</p>
            </div>
            {card.overall != null && (
              <div className="text-right" title={`Blends the ${card.measured} of ${card.of} scores we could measure`}>
                <p className="text-2xl font-extrabold leading-none tabular-nums text-[#111827]">{card.overall}<span className="text-xs font-semibold text-gray-400">/100</span></p>
                <p className="mt-0.5 text-[10px] text-gray-400">{card.measured} of {card.of} measured</p>
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {card.verdict_label && card.verdict
              ? <span className={`rounded px-2 py-0.5 text-xs font-bold ${VERDICT[card.verdict]}`}>{card.verdict_label}</span>
              : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Not checked yet</span>}
            {card.saturation && <span className={`rounded px-2 py-0.5 text-xs font-semibold ${SATURATION[card.saturation]}`}>Saturation: {card.saturation}</span>}
            {card.stale && <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Prices may have changed</span>}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-blue-50 p-2"><dt className="text-[11px] text-gray-500">Estimated selling</dt><dd className="font-bold text-[#2563EB]">{usd(card.selling_price)}</dd></div>
        <div className="rounded-lg bg-gray-50 p-2"><dt className="text-[11px] text-gray-500">Supplier cost</dt><dd className="font-bold text-[#111827]">{usd(card.supplier_cost)}</dd></div>
        <div className="rounded-lg bg-gray-50 p-2"><dt className="text-[11px] text-gray-500">Est. margin</dt><dd className="font-bold text-[#111827]">{sc.margin.pct != null ? `${Math.round(sc.margin.pct)}%` : '-'}</dd></div>
      </dl>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile label="Demand" s={sc.demand} />
        <Tile label="Competition" sub="higher = more crowded" s={sc.competition} />
        <Tile label="Content potential" s={sc.content} />
        <Tile label="Shipping" s={sc.shipping} text={sc.shipping.out_of_10 != null ? `${sc.shipping.out_of_10}/10` : undefined} />
        <Tile label="Supplier reliability" s={sc.supplier} />
        <Tile label="TikTok potential" s={sc.tiktok} />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-gray-700"><span className="font-semibold text-[#111827]">Why:</span> {card.why}</p>
      <p className="mt-1 text-[11px] text-gray-400">Every number comes from real data. Anything we cannot measure yet says Not measured. This is guidance, not a promise of sales.</p>

      {done ? (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-green-900"><CheckCircle2 className="h-4 w-4" /> Draft ready in your store at {usd(done.price)}</p>
          <p className="mt-1 text-xs text-green-900/80">
            {done.ai_written ? 'Claude wrote the title and description. Read them before you publish.' : 'The supplier text was kept. You can edit it in your store.'}
            {done.below_target ? ' This price is under your target margin.' : ''}
            {!done.supplier_connected ? ' Connect your supplier in the store so orders go out automatically.' : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={`${STORE}${done.edit_path}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-bold text-white hover:bg-[#1E4FC2]">Review and publish</a>
            <a href={`${STORE}${done.coach_path}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-semibold text-green-900 hover:bg-green-100">See the price check</a>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button" onClick={launch} disabled={busy || !card.can_launch}
            title={card.can_launch ? '' : 'This product has not had its market check yet. We check new products every day.'}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1E4FC2] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing your listing…</> : <><Rocket className="h-4 w-4" /> Launch with ExiusCart</>}
          </button>
          <Link href={`/product/${card.id}`} className="rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Details</Link>
          {!card.can_launch && <span className="text-xs text-gray-400">Not checked yet</span>}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error.text}{error.productId ? <> <a className="font-semibold underline" href={`${STORE}/dashboard/products?edit=${error.productId}`} target="_blank" rel="noopener noreferrer">Open it</a></> : null}</span>
        </p>
      )}
    </article>
  );
}
