'use client';

// Product Insights for one store product: quick research links (Google Trends,
// Amazon, eBay, TikTok, Meta Ad Library) and, on Growth/Scale, the Prodora market
// check (for products imported from Prodora) and "Who to target".
// Used on the Product Insights page (AI Commerce) and inside the product editor.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, Lock, Sparkles, Target, TrendingUp, Copy, Check, Music2, Store, Megaphone } from 'lucide-react';
import { insightsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { aiErrorText } from './AiCopyStudio';

type Audience = {
  summary: string; age_range: string | null; gender: string | null; personas: { name: string; who: string; why_they_buy: string }[];
  interests: string[]; countries: string[]; search_regions: string[]; platforms: { name: string; why: string }[];
  ad_angles: string[]; hashtags: string[]; based_on: string[]; generated_at: string;
};

const DIRECTION: Record<string, string> = { rising: 'Rising', falling: 'Falling', steady: 'Steady', low_interest: 'Very low interest' };
const money = (n: number | null | undefined) => (n == null ? '—' : `$${n.toFixed(2)}`);

function LinkButton({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="justify-start">
      <a href={href} target="_blank" rel="noopener noreferrer"><Icon className="h-4 w-4" /> {label} <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" /></a>
    </Button>
  );
}

export default function ProductInsightsPanel({ shopId, productId, compact = false }: { shopId: string; productId: number | string; compact?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [making, setMaking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shopId || !productId) return;
    setData(null); setError('');
    insightsApi.get(shopId, productId).then((r) => setData(r.data)).catch((e) => setError(aiErrorText(e, 'Could not load insights.')));
  }, [shopId, productId]);

  const makeAudience = async () => {
    setMaking(true); setError('');
    try {
      const r = await insightsApi.makeAudience(shopId, productId);
      setData((d: any) => ({ ...d, audience: r.data.audience }));
    } catch (e: any) { setError(aiErrorText(e, 'Could not work out the audience right now.')); } finally { setMaking(false); }
  };

  if (error && !data) return <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>;
  if (!data) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading insights…</div>;

  const a = data.analysis;
  const aud: Audience | null = data.audience;
  const links = data.links;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Research &ldquo;{data.keyword}&rdquo;</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <LinkButton href={links.google_trends} icon={TrendingUp} label="Google Trends" />
          <LinkButton href={links.amazon} icon={Store} label="Amazon" />
          <LinkButton href={links.ebay} icon={Store} label="eBay" />
          <LinkButton href={links.tiktok} icon={Music2} label="TikTok" />
          <LinkButton href={links.meta_ads} icon={Megaphone} label="Meta Ads" />
        </div>
      </div>

      {data.locked ? (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">Market check and &ldquo;Who to target&rdquo; are part of Growth and Scale.</p>
            <p className="text-muted-foreground">Competitor prices, Google demand, TikTok views and the audience to show your ads to. <Link href="/dashboard/billing" className="font-medium text-primary hover:underline">Upgrade</Link></p>
          </div>
        </div>
      ) : (
        <>
          {data.from_prodora && !a && <p className="text-sm text-muted-foreground">Imported from Prodora. Its market check hasn&apos;t been run yet.</p>}
          {a && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Market check <span className="text-xs font-normal text-muted-foreground">from Prodora{a.stale ? ' (may be out of date)' : ''}</span></CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {a.headline && <p className="text-foreground">{a.headline}</p>}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[11px] text-muted-foreground">Competitors</p><p className="font-semibold">{a.competitor_count}</p></div>
                  <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[11px] text-muted-foreground">Market median</p><p className="font-semibold">{money(a.price?.market?.median)}</p></div>
                  <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[11px] text-muted-foreground">Suggested price</p><p className="font-semibold">{money(a.price?.low)} – {money(a.price?.high)}</p></div>
                  <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[11px] text-muted-foreground">Google demand</p><p className="font-semibold">{a.demand ? DIRECTION[a.demand.direction] ?? '—' : '—'}</p></div>
                </div>
                {a.demand?.summary && <p className="text-muted-foreground"><TrendingUp className="mr-1 inline h-3.5 w-3.5" /> {a.demand.summary}</p>}
                {a.tiktok && <p className="text-muted-foreground"><Music2 className="mr-1 inline h-3.5 w-3.5" /> {a.tiktok.summary}</p>}
                {!compact && a.competitors?.length > 0 && (
                  <ul className="space-y-1">
                    {a.competitors.slice(0, 6).map((c: any, i: number) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate"><Badge variant="muted" className="mr-2 capitalize">{c.marketplace}</Badge>{c.title}</span>
                        {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-medium text-primary hover:underline">{money(c.price)}</a> : <span className="shrink-0">{money(c.price)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Who to target</CardTitle>
              <Button variant="ghost" size="sm" onClick={makeAudience} disabled={making}>
                {making ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {aud ? 'Refresh' : 'Work it out'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {error && <p className="text-amber-700 dark:text-amber-400">{error}</p>}
              {!aud ? <p className="text-muted-foreground">Get the age, interests, countries, ad platforms and hooks for this product&apos;s ads.</p> : (
                <>
                  <p className="text-foreground">{aud.summary}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[11px] text-muted-foreground">Age</p><p className="font-semibold">{aud.age_range ?? '—'}</p></div>
                    <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[11px] text-muted-foreground">Gender</p><p className="font-semibold capitalize">{aud.gender ?? '—'}</p></div>
                    <div className="rounded-lg bg-primary/10 p-2.5"><p className="text-[11px] text-muted-foreground">Start with</p><p className="font-semibold text-primary">{aud.platforms[0]?.name ?? '—'}</p></div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between"><p className="font-medium">Interests</p>
                      <button type="button" className="flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={() => navigator.clipboard?.writeText(aud.interests.join(', ')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">{aud.interests.map((x) => <Badge key={x} variant="outline" className="font-normal">{x}</Badge>)}</div>
                  </div>
                  <div><p className="mb-1.5 font-medium">Countries</p><div className="flex flex-wrap gap-1.5">{aud.countries.map((x) => <Badge key={x} variant="outline" className="font-normal">{x}</Badge>)}</div>
                    {aud.search_regions?.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Google searches come most from {aud.search_regions.join(', ')} (real data).</p>}</div>
                  {!compact && (
                    <>
                      {aud.personas.length > 0 && <div className="grid gap-2 md:grid-cols-3">{aud.personas.map((p) => (
                        <div key={p.name} className="rounded-lg border border-border p-3"><p className="font-medium">{p.name}</p><p className="mt-1 text-xs text-muted-foreground">{p.who}</p><p className="mt-1 text-xs text-muted-foreground"><b>Buys because:</b> {p.why_they_buy}</p></div>
                      ))}</div>}
                      {aud.platforms.length > 0 && <ul className="space-y-1">{aud.platforms.map((p, i) => <li key={p.name}><b>{i + 1}. {p.name}</b> — <span className="text-muted-foreground">{p.why}</span></li>)}</ul>}
                      {aud.ad_angles.length > 0 && <div><p className="mb-1 font-medium">Ad hooks</p><ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{aud.ad_angles.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                      {aud.hashtags.length > 0 && <div className="flex flex-wrap gap-1.5">{aud.hashtags.map((x) => <Badge key={x} variant="muted" className="font-normal">{x}</Badge>)}</div>}
                    </>
                  )}
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Sparkles className="mt-0.5 h-3 w-3 shrink-0" /> AI suggestion based on {aud.based_on.join(', ').replace('google_trends', 'Google Trends').replace('tiktok', 'TikTok').replace('marketplaces', 'Amazon/eBay listings')}. Test with a small budget first.</p>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
