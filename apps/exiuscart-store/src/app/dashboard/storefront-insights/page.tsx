'use client';

import { useState, useEffect } from 'react';
import {
  Search, ExternalLink, Loader2, AlertCircle, Eye, EyeOff, X,
  Sparkles, TrendingUp, RefreshCw,
} from 'lucide-react';
import { storefrontInsightsApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface FunnelRow {
  product_id: number;
  name: string;
  views: number;
  add_to_cart: number;
  orders: number;
  view_to_cart_rate: number | null;
  cart_to_order_rate: number | null;
}

interface SearchTermRow {
  query: string;
  search_count: number;
  matching_products: number;
}

// ── Connect Microsoft Clarity ─────────────────────────────────────────────────

function ClarityConnectModal({ shopId, onClose, onConnected }: {
  shopId: string; onClose: () => void; onConnected: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await storefrontInsightsApi.connectClarity(shopId, projectId.trim(), apiToken.trim());
      onConnected();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not save these credentials.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <p className="font-semibold text-foreground">Connect Microsoft Clarity</p>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Project ID *</label>
            <input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)} required
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Data Export API Token *</label>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} value={apiToken} onChange={(e) => setApiToken(e.target.value)} required
                className="w-full px-3 py-2.5 pr-10 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              <button type="button" onClick={() => setShowToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">
            Free at <span className="font-medium text-foreground">clarity.microsoft.com</span> — create a project for your storefront, then find both under Settings → Data Export.
          </p>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting…' : 'Connect Clarity'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function StorefrontInsightsPage() {
  const [shopId, setShopId] = useState('');

  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [loadingFunnel, setLoadingFunnel] = useState(true);

  const [terms, setTerms] = useState<SearchTermRow[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(true);

  const [clarityConnected, setClarityConnected] = useState<boolean | null>(null);
  const [showClarityModal, setShowClarityModal] = useState(false);
  const [claritySummary, setClaritySummary] = useState<any>(null);
  const [clarityError, setClarityError] = useState('');
  const [loadingClarity, setLoadingClarity] = useState(false);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    setLoadingFunnel(true);
    storefrontInsightsApi.funnel(shopId)
      .then((r) => setFunnel(r.data?.products ?? []))
      .catch(() => {})
      .finally(() => setLoadingFunnel(false));

    setLoadingTerms(true);
    storefrontInsightsApi.searchTerms(shopId)
      .then((r) => setTerms(r.data?.terms ?? []))
      .catch(() => {})
      .finally(() => setLoadingTerms(false));

    storefrontInsightsApi.clarityStatus(shopId)
      .then((r) => setClarityConnected(!!r.data?.connected))
      .catch(() => setClarityConnected(false));
  }, [shopId]);

  const loadClaritySummary = () => {
    setLoadingClarity(true); setClarityError('');
    storefrontInsightsApi.claritySummary(shopId)
      .then((r) => setClaritySummary(r.data))
      .catch((e) => setClarityError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Could not load Clarity data.'))
      .finally(() => setLoadingClarity(false));
  };

  useEffect(() => {
    if (clarityConnected) loadClaritySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clarityConnected]);

  // Search terms with real volume but little/no matching product content —
  // the actual "add this to your description" signal.
  const contentGaps = terms.filter((t) => t.search_count >= 2 && t.matching_products <= 1);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Storefront Insights</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Who's browsing, what they search for, and what's actually converting — Custom Website storefront only.
        </p>
      </div>

      {/* Microsoft Clarity */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" /> Microsoft Clarity
          </h2>
          {clarityConnected && (
            <button onClick={loadClaritySummary} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-4">Free heatmaps, session recordings & funnel drop-off — Microsoft's own tool, not ExiusCart's.</p>

        {clarityConnected === false && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/50 rounded-xl px-4 py-3.5">
            <p className="text-sm text-muted-foreground">Not connected yet — free, no traffic limits.</p>
            <div className="flex items-center gap-2 shrink-0">
              <a href="https://clarity.microsoft.com/" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition">
                Sign up free <ExternalLink className="w-3 h-3" />
              </a>
              <button onClick={() => setShowClarityModal(true)}
                className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition">
                Connect
              </button>
            </div>
          </div>
        )}

        {clarityConnected && (
          <div className="space-y-3">
            {loadingClarity && (
              <div className="flex items-center gap-2 text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Loading…</span></div>
            )}
            {clarityError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" /> {clarityError}
              </div>
            )}
            {claritySummary && !loadingClarity && (
              <>
                <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-48">{JSON.stringify(claritySummary.raw, null, 2)}</pre>
                <a href={claritySummary.clarity_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                  View full heatmaps & recordings on Clarity <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content gaps → AI SEO Tools */}
      {contentGaps.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
          <h2 className="font-semibold text-foreground flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" /> Description gaps found
          </h2>
          <p className="text-xs text-muted-foreground mb-4">People are searching for these on your storefront, but few or no products match by name.</p>
          <div className="space-y-2">
            {contentGaps.map((t) => (
              <div key={t.query} className="flex items-center justify-between bg-card border border-border rounded-lg px-3.5 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">&ldquo;{t.query}&rdquo;</p>
                  <p className="text-xs text-muted-foreground">{t.search_count} searches · {t.matching_products} matching product{t.matching_products === 1 ? '' : 's'}</p>
                </div>
                <a href="/dashboard/ai-seo" className="text-xs text-primary font-medium hover:underline shrink-0">Fix with AI SEO →</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product funnel */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-semibold text-foreground flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-muted-foreground" /> Product funnel
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Last 30 days · views → add to cart → orders</p>
        {loadingFunnel ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2"><Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Loading…</span></div>
        ) : funnel.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">No tracked activity yet — this fills in once your storefront starts sending view/cart events.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium text-right">Views</th>
                  <th className="pb-2 font-medium text-right">Added to cart</th>
                  <th className="pb-2 font-medium text-right">Orders</th>
                  <th className="pb-2 font-medium text-right">View → Cart</th>
                  <th className="pb-2 font-medium text-right">Cart → Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {funnel.map((row) => (
                  <tr key={row.product_id}>
                    <td className="py-2.5 text-foreground font-medium">{row.name}</td>
                    <td className="py-2.5 text-right tabular-nums text-foreground">{row.views}</td>
                    <td className="py-2.5 text-right tabular-nums text-foreground">{row.add_to_cart}</td>
                    <td className="py-2.5 text-right tabular-nums text-foreground">{row.orders}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{row.view_to_cart_rate != null ? `${row.view_to_cart_rate}%` : '—'}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{row.cart_to_order_rate != null ? `${row.cart_to_order_rate}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Search terms */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-semibold text-foreground flex items-center gap-2 mb-1">
          <Search className="w-4 h-4 text-muted-foreground" /> What people search for on your storefront
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Last 30 days</p>
        {loadingTerms ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2"><Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Loading…</span></div>
        ) : terms.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">No searches tracked yet.</div>
        ) : (
          <div className="space-y-1.5">
            {terms.map((t) => (
              <div key={t.query} className="flex items-center justify-between text-sm py-1">
                <span className="text-foreground">{t.query}</span>
                <span className="text-muted-foreground tabular-nums">{t.search_count} search{t.search_count === 1 ? '' : 'es'} · {t.matching_products} match{t.matching_products === 1 ? '' : 'es'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showClarityModal && (
        <ClarityConnectModal
          shopId={shopId}
          onClose={() => setShowClarityModal(false)}
          onConnected={() => { setShowClarityModal(false); setClarityConnected(true); }}
        />
      )}
    </div>
  );
}
