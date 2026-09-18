'use client';

import { useEffect, useState } from 'react';
import { Search, Loader2, AlertCircle, Megaphone } from 'lucide-react';
import { adIntelligenceApi, subscriptionApi } from '@/lib/api';
import AdResultCard, { MetaAd } from '@/components/ads/AdResultCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import MarketingHubLockScreen from '@/components/marketing/MarketingHubLockScreen';

const COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'LK', label: 'Sri Lanka' },
  { code: 'IN', label: 'India' },
];

function shopIdFromStorage() { return typeof window !== 'undefined' ? localStorage.getItem('shop_id') || '1' : '1'; }

// Real running ads pulled live from Meta's public Ad Library — lets a
// seller check whether a product or niche is already being advertised
// before committing time/money to it. Same shared backend core
// (app/core/meta_ad_library.py) the inline "Meta Ad Library" panel on the
// Products and Import pages already uses — this is that same capability
// promoted to its own dedicated research page under Marketing, not a
// second implementation of it.
export default function AdsPage() {
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [locked, setLocked] = useState(false);
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('US');
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') || '1' : '1';
    subscriptionApi.getCurrent(shopId)
      .then((r) => setLocked(r.data?.plan?.plan_type === 'thedersi_free_forever'))
      .catch(() => {})
      .finally(() => setCheckingPlan(false));
  }, []);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setHasSearched(true);
    try {
      const r = await adIntelligenceApi.searchMetaAds(shopIdFromStorage(), query.trim(), country);
      setAds(r.data?.ads ?? []);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(detail?.message ?? detail ?? 'Could not search the Meta Ad Library right now.');
      setAds([]);
    } finally { setLoading(false); }
  };

  if (checkingPlan) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }
  if (locked) {
    return <MarketingHubLockScreen title="Ad Research" description="Available on TheDersi Lite, Pro, and Official." />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ads</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search Meta's public Ad Library for real, currently-running ads — see who's advertising a product or niche before you commit to it.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
            placeholder="Search by product or brand name…"
            className="pl-9"
          />
        </div>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={search} disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {!loading && !error && ads.length === 0 && !hasSearched && (
        <Card className="border-dashed">
          <CardContent className="py-20 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Megaphone className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Research before you sell</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
              Type a product or brand name above to see real ads currently running for it on Facebook and Instagram — a quick signal for whether something's actually worth listing.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && ads.length === 0 && hasSearched && (
        <p className="text-sm text-muted-foreground text-center py-12">No ads found for "{query}" in this country. Try a different keyword or market.</p>
      )}

      {ads.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => <AdResultCard key={ad.id} ad={ad} />)}
        </div>
      )}
    </div>
  );
}
