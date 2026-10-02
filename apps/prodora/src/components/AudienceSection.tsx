'use client';

// "Who to target" on a Prodora product page: an AI suggestion built on the
// product's real market data (Google Trends regions, TikTok, marketplaces),
// always labelled as a suggestion. Growth/Scale, like Competition.

import { useEffect, useState } from 'react';
import { Lock, Loader2, Target, Sparkles, Copy, Check } from 'lucide-react';
import { shoppingApi, AudienceResponse } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 max-w-full [contain:inline-size] bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
      <h2 className="text-xl font-semibold text-[#111827] mb-1 flex items-center gap-2"><Target className="w-5 h-5 text-[#2563EB]" /> Who to target</h2>
      <p className="mb-4 text-xs text-[#6B7280]">Use this to set up Facebook, Instagram and TikTok ads.</p>
      {children}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return <div className="flex flex-wrap gap-1.5">{items.map((x) => <Badge key={x} variant="outline" className="font-normal">{x}</Badge>)}</div>;
}

export default function AudienceSection({ productId }: { productId: number }) {
  const [data, setData] = useState<AudienceResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null); setFailed(false);
    shoppingApi.getAudience(productId).then((d) => { if (!cancelled) setData(d); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [productId]);

  if (failed) return null;
  if (!data) return <Shell><div className="flex items-center justify-center gap-2 py-8 text-sm text-[#6B7280]"><Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" /> Working out the best audience…</div></Shell>;

  if (data.locked) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#E5E7EB] p-6 text-center">
          <Lock className="w-6 h-6 text-[#2563EB]" />
          <p className="text-sm font-semibold text-[#111827]">Age, interests, countries and the best ad platforms for this product</p>
          <p className="max-w-sm text-xs text-[#6B7280]">Included with the Growth and Scale plans.</p>
          <a href="https://exiuscart.com/pricing" target="_blank" rel="noopener noreferrer" className="mt-1 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-[#1E4FC2]">See plans</a>
        </div>
      </Shell>
    );
  }
  const a = data.audience;
  if (!a) return <Shell><p className="text-sm text-[#6B7280]">Not available for this product yet.</p></Shell>;

  const copyInterests = () => { navigator.clipboard?.writeText(a.interests.join(', ')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); };

  return (
    <Shell>
      <p className="text-sm text-[#111827]">{a.summary}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-50 p-3"><p className="text-[11px] text-[#6B7280]">Age</p><p className="text-sm font-bold">{a.age_range ?? '—'}</p></div>
        <div className="rounded-lg bg-gray-50 p-3"><p className="text-[11px] text-[#6B7280]">Gender</p><p className="text-sm font-bold capitalize">{a.gender ?? '—'}</p></div>
        <div className="rounded-lg bg-blue-50 p-3"><p className="text-[11px] text-[#6B7280]">Start with</p><p className="text-sm font-bold text-[#2563EB]">{a.platforms[0]?.name ?? '—'}</p></div>
      </div>

      {a.personas.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {a.personas.map((p) => (
            <div key={p.name} className="rounded-xl border border-[#E5E7EB] p-3">
              <p className="text-sm font-semibold text-[#111827]">{p.name}</p>
              <p className="mt-1 text-xs text-[#374151]">{p.who}</p>
              <p className="mt-1 text-xs text-[#6B7280]"><span className="font-medium">Buys because:</span> {p.why_they_buy}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#111827]">Interests to target</h3>
            <button type="button" onClick={copyInterests} className="flex items-center gap-1 text-xs text-[#2563EB] hover:underline">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <Chips items={a.interests} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[#111827]">Countries to start with</h3>
          <Chips items={a.countries} />
          {a.search_regions.length > 0 && <p className="mt-2 text-xs text-[#6B7280]">Google searches come most from: {a.search_regions.join(', ')} (real data).</p>}
        </div>
      </div>

      {a.platforms.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-[#111827]">Best ad platforms</h3>
          <ul className="space-y-1.5">{a.platforms.map((p, i) => <li key={p.name} className="text-sm text-[#374151]"><span className="font-semibold text-[#111827]">{i + 1}. {p.name}</span> — {p.why}</li>)}</ul>
        </div>
      )}

      {a.ad_angles.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-[#111827]">Ad hooks for the first 3 seconds</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[#374151]">{a.ad_angles.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}

      {a.hashtags.length > 0 && <div className="mt-5"><h3 className="mb-2 text-sm font-semibold text-[#111827]">Hashtags</h3><Chips items={a.hashtags} /></div>}

      <p className="mt-5 flex items-start gap-1.5 text-xs text-[#9CA3AF]">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
        AI suggestion based on {a.based_on.join(', ').replace('google_trends', 'Google Trends').replace('tiktok', 'TikTok').replace('marketplaces', 'Amazon/eBay listings')}. Test it with a small budget first.
      </p>
    </Shell>
  );
}
