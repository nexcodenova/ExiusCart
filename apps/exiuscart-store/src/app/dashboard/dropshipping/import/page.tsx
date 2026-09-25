'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, X, Loader2, Package, Lock, Search, ShoppingBag, ChevronRight, AlertCircle, Shirt,
  Megaphone, ExternalLink, Lightbulb, Link2, ClipboardPaste, Info, Zap, Settings2, Tag, Image as ImageIcon,
} from 'lucide-react';
import { dropshipApi, channelsApi, adIntelligenceApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface CJProduct {
  pid: string;
  name: string;
  image: string;
  cost_price: number;
  category: string;
}

interface CJProductDetail {
  pid: string;
  name: string;
  description: string;
  images: string[];
  cost_price: number;
  category: string;
  sku: string;
}

interface PrintfulProduct {
  sync_product_id: number;
  name: string;
  image: string;
  variant_count: number;
}

// ── Printful Import Modal ───────────────────────────────────────────────────
// Simpler than CJ's — these are the seller's own already-designed synced
// products, so there's no foreign "cost price" to show for comparison, and
// no separate detail-preview call: the import endpoint itself fetches full
// sync_variant detail and creates the product in one step.

function PrintfulImportModal({ shopId, product, onClose, onImported }: {
  shopId: string;
  product: PrintfulProduct;
  onClose: () => void;
  onImported: (productId: number, name: string) => void;
}) {
  const { baseSym } = useCurrency();
  const [sellingPrice, setSellingPrice] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    setImporting(true); setError('');
    try {
      const price = parseFloat(sellingPrice) || undefined;
      const r = await dropshipApi.printfulImport(shopId, product.sync_product_id, price);
      onImported(r.data.product_id, r.data.name);
    } catch (e: any) {
      setError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Import failed. Please try again.');
    } finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <p className="font-semibold text-foreground">Import Product</p>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {product.image && (
            <div className="relative w-full aspect-square bg-muted rounded-xl overflow-hidden">
              <Image src={product.image} alt={product.name} fill className="object-contain p-2" unoptimized />
            </div>
          )}

          <div className="space-y-1">
            <p className="font-semibold text-foreground leading-snug">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.variant_count} variant{product.variant_count !== 1 ? 's' : ''}</p>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="pf-sell-price" className="text-muted-foreground">Selling Price ({baseSym})</label>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs">{baseSym}</span>
                <input id="pf-sell-price" type="number" step="0.01" min="0" value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="Use Printful price"
                  className="w-28 px-2 py-1 bg-background border border-border rounded-lg text-sm text-right font-semibold outline-none focus:ring-2 focus:ring-primary text-foreground" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Leave blank to auto-convert this product&apos;s Printful retail price into your store&apos;s currency.</p>
          </div>

          <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5 leading-relaxed">
            ExiusCart will create this as a product in your catalog with its real variants and mockup images. No inventory to manage — Printful prints and ships each order automatically.
          </p>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition">Cancel</button>
            <button onClick={handleImport} disabled={importing}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
              {importing ? 'Importing…' : 'Import to My Products'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Meta Ad Library check ────────────────────────────────────────────────────
// Real running ads pulled live from Meta's public Ad Library — same shared
// backend the admin Prodora curation screen already uses. Here it's just a
// confidence signal before importing, not something to attach anywhere:
// "is this actually being advertised right now, by someone?"

interface MetaAd { id: string; page_name: string; snapshot_url: string; body: string | null }

function MetaAdCheck({ shopId, defaultQuery }: { shopId: string; defaultQuery: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(defaultQuery);
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setHasSearched(true);
    try {
      const r = await adIntelligenceApi.searchMetaAds(shopId, query.trim());
      setAds(r.data?.ads ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Meta Ad Library search failed.');
    } finally { setLoading(false); }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !hasSearched) runSearch();
  };

  return (
    <div>
      <button type="button" onClick={toggle}
        className="w-full flex items-center justify-between text-xs px-3 py-2 border border-border rounded-lg text-muted-foreground hover:bg-muted transition">
        <span className="flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5" /> See real ads for this product</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-2 p-3 bg-muted/50 border border-border rounded-lg space-y-2">
          <div className="flex gap-2">
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
              placeholder="Search by product or brand name…"
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none" />
            <button type="button" onClick={runSearch} disabled={loading}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-60 flex items-center gap-1.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          {error && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {ads.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {ads.map((ad) => (
                <a key={ad.id} href={ad.snapshot_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-background hover:bg-muted border border-border rounded-lg transition">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{ad.page_name || 'Unknown advertiser'}</p>
                    {ad.body && <p className="text-xs text-muted-foreground truncate mt-0.5">{ad.body}</p>}
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>
          )}
          {!loading && !error && ads.length === 0 && hasSearched && (
            <p className="text-xs text-muted-foreground">No running ads found for &ldquo;{query}&rdquo;. Try a shorter or different keyword.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────

function CJImportModal({ shopId, product, onClose, onImported, supplier = 'cj' }: {
  shopId: string;
  product: CJProduct;
  onClose: () => void;
  onImported: (productId: number, name: string) => void;
  supplier?: 'cj' | 'hypersku';
}) {
  const { baseSym, baseCurrency } = useCurrency();
  const [detail, setDetail] = useState<CJProductDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [sellingPrice, setSellingPrice] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [imgIdx, setImgIdx] = useState(0);
  const supplierLabel = supplier === 'hypersku' ? 'HyperSKU' : 'CJ';

  useEffect(() => {
    setLoadingDetail(true);
    const fetchDetail = supplier === 'hypersku' ? dropshipApi.hyperskuProductDetail : dropshipApi.cjProductDetail;
    fetchDetail(shopId, product.pid)
      .then((r) => {
        const d = r.data?.product as CJProductDetail;
        setDetail(d);
        // Not pre-filled with cost*2 anymore — the supplier's cost is always
        // USD, and this store's price is in its own base currency (baseSym),
        // so a client-side "2x" guess would show a raw USD number mislabeled
        // as that currency. Left blank, the backend computes 2x and converts
        // it properly using a real exchange rate.
      })
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [shopId, product.pid, supplier]);

  const handleImport = async () => {
    setImporting(true); setError('');
    try {
      const price = parseFloat(sellingPrice) || undefined;
      const r = supplier === 'hypersku'
        ? await dropshipApi.hyperskuImport(shopId, product.pid, price)
        : await dropshipApi.cjImport(shopId, product.pid, price);
      onImported(r.data.product_id, r.data.name);
    } catch (e: any) {
      setError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Import failed. Please try again.');
    } finally { setImporting(false); }
  };

  const images = detail?.images?.length ? detail.images : (product.image ? [product.image] : []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <p className="font-semibold text-foreground">Import Product</p>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading product details…</span>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Image gallery */}
            {images.length > 0 && (
              <div className="space-y-2">
                <div className="relative w-full aspect-square bg-muted rounded-xl overflow-hidden">
                  <Image src={images[imgIdx]} alt={detail?.name ?? product.name} fill className="object-contain p-2" unoptimized />
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.slice(0, 8).map((img, i) => (
                      <button key={i} onClick={() => setImgIdx(i)}
                        className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition ${i === imgIdx ? 'border-primary' : 'border-border'}`}>
                        <Image src={img} alt="" fill className="object-cover" unoptimized />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Product info */}
            <div className="space-y-1">
              <p className="font-semibold text-foreground leading-snug">{detail?.name ?? product.name}</p>
              {detail?.category && <p className="text-xs text-muted-foreground">{detail.category}</p>}
            </div>

            <MetaAdCheck shopId={shopId} defaultQuery={detail?.name ?? product.name} />

            {/* Pricing */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{supplierLabel} Cost Price (USD)</span>
                <span className="font-semibold text-foreground">${(detail?.cost_price ?? product.cost_price).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="sell-price" className="text-muted-foreground">Your Selling Price ({baseSym})</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-xs">{baseSym}</span>
                  <input id="sell-price" type="number" step="0.01" min="0" value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="2x cost, converted"
                    className="w-32 px-2 py-1 bg-background border border-border rounded-lg text-sm text-right font-semibold outline-none focus:ring-2 focus:ring-primary text-foreground" />
                </div>
              </div>
              {/* Only shown when the store's own currency is USD — CJ's cost
                  and a converted selling price aren't directly comparable
                  otherwise without doing the same conversion here too. */}
              {baseCurrency === 'USD' && sellingPrice && detail && parseFloat(sellingPrice) > (detail.cost_price ?? 0) && (
                <div className="flex items-center justify-between text-xs text-green-500">
                  <span>Your profit per unit</span>
                  <span className="font-semibold">+${(parseFloat(sellingPrice) - (detail.cost_price ?? 0)).toFixed(2)}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5 leading-relaxed">
              ExiusCart will create this as a product in your catalog. You can edit the title, description, and images after importing. The selling price can be changed anytime.
            </p>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition">Cancel</button>
              <button onClick={handleImport} disabled={importing}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                {importing ? 'Importing…' : 'Import to My Products'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── How to import (sidebar) ──────────────────────────────────────────────────
// Genuinely describes each supplier's real import flow — no step here that
// isn't backed by an actual endpoint/behaviour used elsewhere on this page.

const SUPPLIER_LABEL: Record<'cj' | 'printful' | 'aliexpress' | 'hypersku', string> = {
  cj: 'CJ', printful: 'Printful', aliexpress: 'AliExpress', hypersku: 'HyperSKU',
};

const IMPORT_STEPS: Record<'cj' | 'printful' | 'aliexpress' | 'hypersku', { title: string; desc: string }[]> = {
  cj: [
    { title: 'Search the catalog', desc: 'Type a keyword above to search CJ’s live catalog.' },
    { title: 'Review the product', desc: 'Check its real photos, description and USD cost.' },
    { title: 'Set your price', desc: 'Leave it blank to auto-calculate 2x cost, converted to your currency.' },
    { title: 'Import', desc: 'It’s added straight to My Products.' },
    { title: 'Edit anytime', desc: 'Title, images, description and price can all be changed after.' },
  ],
  printful: [
    { title: 'Design on Printful', desc: 'Publish a product on Printful’s own dashboard first.' },
    { title: 'It appears here', desc: 'Synced automatically under “My Printful Products”.' },
    { title: 'Import it', desc: 'Real variants and mockup images come across as-is.' },
    { title: 'Start selling', desc: 'Printful prints and ships each order for you automatically.' },
  ],
  aliexpress: [
    { title: 'Find a product', desc: 'Go to AliExpress and find a product you want to import.' },
    { title: 'Copy the product link', desc: 'Copy the product URL from your browser.' },
    { title: 'Paste the link here', desc: 'Paste it in the box on the left and click “Import to My Products”.' },
    { title: 'Review and edit', desc: 'Check the product details, edit price, description and images if needed.' },
    { title: 'Start selling', desc: 'The product is added to your store, ready to sell.' },
  ],
  hypersku: [
    { title: 'Browse the catalog', desc: 'Browse HyperSKU’s catalog, or check “My HyperSKU Products”.' },
    { title: 'Set your price', desc: 'Leave it blank to auto-calculate 2x cost, converted to your currency.' },
    { title: 'Import', desc: 'It’s added straight to My Products, ready to edit.' },
  ],
};

const IMPORT_PRO_TIP: Record<'cj' | 'printful' | 'aliexpress' | 'hypersku', string> = {
  cj: 'Before you commit, use the “See real ads for this product” check in the import dialog — it pulls real, currently-running ads from Meta’s Ad Library so you can gauge demand first.',
  printful: 'Since you’re selling your own designs, there’s no external cost to compare — just make sure your retail price on Printful’s side already covers their base cost before publishing.',
  aliexpress: 'After importing, use the “See real ads for this product” check that appears below — it pulls real, currently-running ads from Meta’s Ad Library so you can gauge demand.',
  hypersku: 'Before you commit, use the “See real ads for this product” check in the import dialog — it pulls real, currently-running ads from Meta’s Ad Library so you can gauge demand first.',
};

function ImportHelpPanel({ supplier }: { supplier: 'cj' | 'printful' | 'aliexpress' | 'hypersku' }) {
  const steps = IMPORT_STEPS[supplier];
  return (
    <aside className="lg:sticky lg:top-6 space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">How to import from {SUPPLIER_LABEL[supplier]}?</p>
        <ol>
          {steps.map((step, i) => (
            <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 && (
                <span className="absolute left-[13px] top-7 bottom-0 w-px bg-border" aria-hidden="true" />
              )}
              <span className="relative z-10 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="pt-0.5">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
          <Lightbulb className="w-4 h-4 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Pro Tip</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{IMPORT_PRO_TIP[supplier]}</p>
        </div>
      </div>
    </aside>
  );
}

function FeatureChip({ icon: Icon, label, colorClass }: { icon: React.ElementType; label: string; colorClass: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 flex flex-col items-center text-center gap-2">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
  );
}


// ── Shared building blocks ───────────────────────────────────────────────────

type SupplierKey = 'cj' | 'printful' | 'aliexpress' | 'hypersku';

const SUPPLIER_ICON: Record<SupplierKey, React.ElementType> = {
  cj: Package, printful: Shirt, aliexpress: ShoppingBag, hypersku: Package,
};

const POPULAR_SEARCHES = ['Phone case', 'LED lights', 'Yoga mat', 'Wireless earbuds', 'Pet toys', 'Kitchen gadgets', 'Water bottle', 'Car accessories'];

function ProductGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{children}</div>;
}

function ProductGridSkeleton() {
  return (
    <ProductGrid>
      {Array.from({ length: 10 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-8 w-full" />
          </div>
        </Card>
      ))}
    </ProductGrid>
  );
}

function ProductCard({ image, name, fallback: Fallback, cost, costLabel, note, onImport }: {
  image?: string; name: string; fallback: React.ElementType;
  cost?: number; costLabel?: string; note?: string; onImport: () => void;
}) {
  // The import default is 2x cost (see the help panel), so this is the real
  // starting price, not a guess.
  const suggested = cost !== undefined ? cost * 2 : undefined;
  return (
    <Card className="group flex flex-col overflow-hidden transition hover:border-primary/40 hover:shadow-md">
      <div className="relative aspect-square bg-muted">
        {image
          ? <Image src={image} alt={name} fill className="object-cover transition duration-300 group-hover:scale-105" unoptimized />
          : <div className="absolute inset-0 flex items-center justify-center"><Fallback className="h-8 w-8 text-muted-foreground/30" /></div>}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-foreground" title={name}>{name}</p>
        <div className="mt-auto space-y-2.5">
          {cost !== undefined ? (
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{costLabel ?? 'Cost'}</p>
                <p className="text-base font-bold text-foreground">${cost.toFixed(2)}</p>
              </div>
              <Badge variant="success" className="px-2 py-0.5 text-[10px]">Sell ~${suggested!.toFixed(2)}</Badge>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{note}</p>
          )}
          <Button size="sm" className="w-full" onClick={onImport}>Import</Button>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <div className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" /> {children}
    </div>
  );
}

function ImportedBanner({ item }: { item: { id: number; name: string } | null }) {
  if (!item) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
        <p className="truncate text-sm font-medium text-green-600 dark:text-green-400">&ldquo;{item.name}&rdquo; imported successfully</p>
      </div>
      <Link href={`/dashboard/products?edit=${item.id}`} className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
        Edit product <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function TabPills<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
            value === t.id ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ImportProductsPage() {
  const [shopId, setShopId] = useState('');
  const [checking, setChecking] = useState(true);
  const [cjConnected, setCjConnected] = useState(false);
  const [printfulConnected, setPrintfulConnected] = useState(false);
  const [aliexpressConnected, setAliexpressConnected] = useState(false);
  const [hyperskuConnected, setHyperskuConnected] = useState(false);
  const [isTheDersiUser, setIsTheDersiUser] = useState(false);

  // Only relevant once more than one supplier is connected — otherwise the
  // page just shows whichever one is available with no switcher at all.
  const [supplier, setSupplier] = useState<'cj' | 'printful' | 'aliexpress' | 'hypersku'>('cj');

  // HyperSKU has real catalog + "my products" endpoints (see backend), but
  // catalog list has no keyword filter — so this is two flat lists (tab
  // switch, no search box), not CJ's debounced search.
  const [hyperskuTab, setHyperskuTab] = useState<'catalog' | 'my'>('catalog');
  const [hyperskuProducts, setHyperskuProducts] = useState<CJProduct[]>([]);
  const [loadingHypersku, setLoadingHypersku] = useState(false);
  const [hyperskuLoaded, setHyperskuLoaded] = useState(false);
  const [hyperskuError, setHyperskuError] = useState('');
  const [hyperskuMy, setHyperskuMy] = useState<CJProduct[]>([]);
  const [loadingHyperskuMy, setLoadingHyperskuMy] = useState(false);
  const [hyperskuMyLoaded, setHyperskuMyLoaded] = useState(false);
  const [hyperskuMyError, setHyperskuMyError] = useState('');
  const [hyperskuImportTarget, setHyperskuImportTarget] = useState<CJProduct | null>(null);

  const [aliexpressUrl, setAliexpressUrl] = useState('');
  const [aliexpressSellingPrice, setAliexpressSellingPrice] = useState('');
  const [importingAliexpress, setImportingAliexpress] = useState(false);
  const [aliexpressError, setAliexpressError] = useState('');

  const [activeTab, setActiveTab] = useState<'search' | 'my'>('search');
  const [query, setQuery] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [products, setProducts] = useState<CJProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [myProducts, setMyProducts] = useState<CJProduct[]>([]);
  const [loadingMy, setLoadingMy] = useState(false);
  const [myLoaded, setMyLoaded] = useState(false);
  const [myError, setMyError] = useState('');
  const [importTarget, setImportTarget] = useState<CJProduct | null>(null);
  const [importedId, setImportedId] = useState<{ id: number; name: string } | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [printfulProducts, setPrintfulProducts] = useState<PrintfulProduct[]>([]);
  const [loadingPrintful, setLoadingPrintful] = useState(false);
  const [printfulLoaded, setPrintfulLoaded] = useState(false);
  const [printfulImportTarget, setPrintfulImportTarget] = useState<PrintfulProduct | null>(null);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    setChecking(true);
    Promise.all([
      dropshipApi.getConnections(shopId),
      channelsApi.getConnections(shopId),
    ])
      .then(([supRes, connRes]) => {
        const suppliers = supRes.data?.suppliers ?? [];
        const cj = suppliers.some((s: any) => s.supplier_type === 'cj' && s.connected);
        const printful = suppliers.some((s: any) => s.supplier_type === 'printful' && s.connected);
        const aliexpress = suppliers.some((s: any) => s.supplier_type === 'aliexpress' && s.connected);
        const hypersku = suppliers.some((s: any) => s.supplier_type === 'hypersku' && s.connected);
        setCjConnected(cj);
        setPrintfulConnected(printful);
        setAliexpressConnected(aliexpress);
        setHyperskuConnected(hypersku);
        setSupplier(cj ? 'cj' : printful ? 'printful' : aliexpress ? 'aliexpress' : 'hypersku');
        setIsTheDersiUser((connRes.data ?? []).some((c: any) => c.channel_type === 'thedersi'));
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [shopId]);

  useEffect(() => {
    if (supplier !== 'printful' || printfulLoaded || !shopId || !printfulConnected) return;
    setLoadingPrintful(true);
    dropshipApi.printfulMyProducts(shopId)
      .then((r) => setPrintfulProducts(r.data?.products ?? []))
      .catch(() => {})
      .finally(() => { setLoadingPrintful(false); setPrintfulLoaded(true); });
  }, [supplier, printfulLoaded, shopId, printfulConnected]);

  useEffect(() => {
    if (supplier !== 'hypersku' || hyperskuTab !== 'catalog' || hyperskuLoaded || !shopId || !hyperskuConnected) return;
    setLoadingHypersku(true);
    setHyperskuError('');
    dropshipApi.hyperskuSearch(shopId)
      .then((r) => setHyperskuProducts(r.data?.products ?? []))
      .catch((e: any) => setHyperskuError(e?.response?.data?.detail ?? 'Could not load HyperSKU\'s catalog — HyperSKU may be unreachable right now.'))
      .finally(() => { setLoadingHypersku(false); setHyperskuLoaded(true); });
  }, [supplier, hyperskuTab, hyperskuLoaded, shopId, hyperskuConnected]);

  useEffect(() => {
    if (supplier !== 'hypersku' || hyperskuTab !== 'my' || hyperskuMyLoaded || !shopId || !hyperskuConnected) return;
    setLoadingHyperskuMy(true);
    setHyperskuMyError('');
    dropshipApi.hyperskuMyProducts(shopId)
      .then((r) => setHyperskuMy(r.data?.products ?? []))
      .catch((e: any) => setHyperskuMyError(e?.response?.data?.detail ?? 'Could not load your HyperSKU products — HyperSKU may be unreachable right now.'))
      .finally(() => { setLoadingHyperskuMy(false); setHyperskuMyLoaded(true); });
  }, [supplier, hyperskuTab, hyperskuMyLoaded, shopId, hyperskuConnected]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!inputVal.trim()) { setProducts([]); setQuery(''); return; }
    searchTimeout.current = setTimeout(() => setQuery(inputVal.trim()), 500);
  }, [inputVal]);

  useEffect(() => {
    if (!query || !shopId) return;
    setLoading(true);
    setProducts([]);
    setSearchError('');
    dropshipApi.cjSearch(shopId, query)
      .then((r) => setProducts(r.data?.products ?? []))
      .catch((e: any) => setSearchError(e?.response?.data?.detail ?? 'Search failed — CJ may be unreachable right now. Try again in a moment.'))
      .finally(() => setLoading(false));
  }, [query, shopId]);

  useEffect(() => {
    if (activeTab !== 'my' || myLoaded || !shopId) return;
    setLoadingMy(true);
    setMyError('');
    dropshipApi.cjMyProducts(shopId)
      .then((r) => setMyProducts(r.data?.products ?? []))
      .catch((e: any) => setMyError(e?.response?.data?.detail ?? 'Could not load your CJ products — CJ may be unreachable right now.'))
      .finally(() => { setLoadingMy(false); setMyLoaded(true); });
  }, [activeTab, myLoaded, shopId]);

  if (checking) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <ProductGridSkeleton />
      </div>
    );
  }

  if (isTheDersiUser) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Import Products</h1>
          <p className="text-sm text-muted-foreground">Search CJ&apos;s catalog and add products directly to your store</p>
        </div>
        <EmptyState icon={Lock} title="Dropshipping is for direct ExiusCart sellers">
          Your store is managed by <strong className="text-foreground">TheDersi</strong>, and your orders are fulfilled through TheDersi&apos;s own logistics.
          <div className="mt-5"><Button asChild><Link href="/dashboard/channels">Back to Channels</Link></Button></div>
        </EmptyState>
      </div>
    );
  }

  const connectedCount = [cjConnected, printfulConnected, aliexpressConnected, hyperskuConnected].filter(Boolean).length;

  if (connectedCount === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Import Products</h1>
          <p className="text-sm text-muted-foreground">Search a supplier&apos;s catalog and add products directly to your store</p>
        </div>
        <EmptyState icon={Package} title="Connect a supplier first">
          You need an active CJ Dropshipping, Printful, AliExpress, or HyperSKU connection before you can browse and import products.
          <div className="mt-5"><Button asChild><Link href="/dashboard/dropshipping">Go to Suppliers</Link></Button></div>
        </EmptyState>
      </div>
    );
  }

  const suppliers = ([
    cjConnected && 'cj', printfulConnected && 'printful', aliexpressConnected && 'aliexpress', hyperskuConnected && 'hypersku',
  ].filter(Boolean)) as SupplierKey[];
  const SUPPLIER_FULL: Record<SupplierKey, string> = { cj: 'CJ Dropshipping', printful: 'Printful', aliexpress: 'AliExpress', hypersku: 'HyperSKU' };

  const subtitle =
    supplier === 'cj' ? "Search CJ's catalog and import directly to your store with one click"
    : supplier === 'printful' ? 'Bring your already-designed Printful products into your store'
    : supplier === 'hypersku' ? "Browse HyperSKU's catalog and import directly to your store"
    : 'Paste an AliExpress product link and import it directly';

  const cjList = activeTab === 'search' ? products : myProducts;
  const hyperskuList = hyperskuTab === 'catalog' ? hyperskuProducts : hyperskuMy;
  const hyperskuLoading = hyperskuTab === 'catalog' ? loadingHypersku : loadingHyperskuMy;
  const hyperskuErr = hyperskuTab === 'catalog' ? hyperskuError : hyperskuMyError;
  const hyperskuIsLoaded = hyperskuTab === 'catalog' ? hyperskuLoaded : hyperskuMyLoaded;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Import Products</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Badge variant="muted" className="w-fit gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> {connectedCount} supplier{connectedCount !== 1 ? 's' : ''} connected
          </Badge>
        </div>

        {/* One control bar: pick the supplier, pick the list, search */}
        <Card>
          <CardContent className="space-y-4 p-4">
            {suppliers.length > 1 && (
              <div className={`grid gap-2 sm:grid-cols-2 ${suppliers.length === 3 ? 'xl:grid-cols-3' : suppliers.length === 4 ? 'xl:grid-cols-4' : ''}`}>
                {suppliers.map((k) => {
                  const Icon = SUPPLIER_ICON[k];
                  const on = supplier === k;
                  return (
                    <button key={k} onClick={() => setSupplier(k)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm font-medium transition ${
                        on ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary' : 'border-border text-muted-foreground hover:bg-muted'
                      }`}>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-md ${on ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      {SUPPLIER_FULL[k]}
                    </button>
                  );
                })}
              </div>
            )}

            {supplier === 'cj' && (
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <TabPills value={activeTab} onChange={setActiveTab}
                  tabs={[{ id: 'search', label: 'Search catalog' }, { id: 'my', label: 'My CJ products' }]} />
                {activeTab === 'search' ? (
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)}
                      placeholder="Search CJ products, e.g. wireless earbuds, phone case, yoga mat"
                      className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary" />
                    {loading && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                    {!loading && inputVal && (
                      <button onClick={() => setInputVal('')} aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Products you added to &ldquo;My Product&rdquo; on CJ&apos;s own site, already vetted by you</p>
                )}
              </div>
            )}

            {supplier === 'hypersku' && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <TabPills value={hyperskuTab} onChange={setHyperskuTab}
                  tabs={[{ id: 'catalog', label: 'Browse catalog' }, { id: 'my', label: 'My HyperSKU products' }]} />
                <p className="text-xs text-muted-foreground">HyperSKU&apos;s catalog has no keyword search, so these are full lists</p>
              </div>
            )}

            {supplier === 'printful' && (
              <p className="text-xs text-muted-foreground">
                Products you designed on Printful&apos;s own site (Design Lab / Product Templates, then Published), already mocked up and ready to import
              </p>
            )}
          </CardContent>
        </Card>

        {supplier === 'cj' && activeTab === 'search' && inputVal.trim().split(/\s+/).filter(Boolean).length > 4 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>CJ&apos;s search works best with short, simple terms (1 to 3 words) like &ldquo;vacuum cleaner&rdquo;. Long or very specific phrases tend to return unrelated results.</span>
          </div>
        )}

        {supplier !== 'aliexpress' && <ImportedBanner item={importedId} />}

      {supplier === 'aliexpress' && (
        <div className="max-w-2xl space-y-4">
          {importedId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">&ldquo;{importedId.name}&rdquo; imported successfully!</p>
                </div>
                <Link href={`/dashboard/products?edit=${importedId.id}`}
                  className="text-xs text-primary font-medium flex items-center gap-1 hover:underline shrink-0">
                  Edit product <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <MetaAdCheck shopId={shopId} defaultQuery={importedId.name} />
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5 text-red-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">Import from AliExpress</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">Recommended</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Paste any AliExpress product link and import it directly to your store.</p>
              </div>
            </div>

            {/* Product link */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground block">AliExpress product link</label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={aliexpressUrl} onChange={(e) => setAliexpressUrl(e.target.value)}
                    placeholder="https://www.aliexpress.com/item/…"
                    className="w-full pl-9 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <button type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setAliexpressUrl(text.trim());
                    } catch { /* clipboard permission denied — user can still paste manually */ }
                  }}
                  className="px-3 py-2.5 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition flex items-center gap-1.5 shrink-0">
                  <ClipboardPaste className="w-3.5 h-3.5" /> Paste
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-sky-700 dark:text-sky-300 bg-sky-500/10 rounded-lg px-3 py-2.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>You can use any AliExpress product link. We&apos;ll automatically fetch the product title, images, variants, price, description and more.</span>
            </div>

            {/* Selling price */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium text-foreground">Selling price <span className="font-normal text-muted-foreground">(optional)</span></label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Leave blank to auto-calculate: 2x the product&apos;s cost, converted to your store&apos;s currency.</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input type="number" step="0.01" min="0" value={aliexpressSellingPrice} onChange={(e) => setAliexpressSellingPrice(e.target.value)}
                    placeholder="Leave blank to use 2x cost"
                    className="w-full pl-6 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <span className="shrink-0 text-[11px] font-semibold pl-1.5 pr-2.5 py-1.5 rounded-full bg-primary/10 text-primary flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">2x</span>
                  Auto-calculate
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Set your selling price or leave blank to auto-calculate (2x cost, converted to your store&apos;s currency).</p>
            </div>

            {aliexpressError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" /> {aliexpressError}
              </div>
            )}

            <button
              onClick={async () => {
                if (!aliexpressUrl.trim()) return;
                setImportingAliexpress(true); setAliexpressError('');
                try {
                  const price = parseFloat(aliexpressSellingPrice) || undefined;
                  const r = await dropshipApi.aliexpressImport(shopId, aliexpressUrl.trim(), price);
                  setImportedId({ id: r.data.product_id, name: r.data.name });
                  setAliexpressUrl(''); setAliexpressSellingPrice('');
                } catch (e: any) {
                  setAliexpressError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Import failed. Check the link and try again.');
                } finally { setImportingAliexpress(false); }
              }}
              disabled={importingAliexpress || !aliexpressUrl.trim()}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {importingAliexpress ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
              {importingAliexpress ? 'Importing…' : 'Import to My Products'}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="w-3 h-3" /> Safe &amp; secure. We only use the product link to fetch public product information.
            </p>
          </div>

          {/* Feature strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FeatureChip icon={Zap} label="Fast Import" colorClass="bg-green-500/10 text-green-600 dark:text-green-400" />
            <FeatureChip icon={ImageIcon} label="Complete Data" colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400" />
            <FeatureChip icon={Settings2} label="Auto Pricing" colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
            <FeatureChip icon={Tag} label="Start Selling" colorClass="bg-orange-500/10 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
      )}

        {/* ── CJ ── */}
        {supplier === 'cj' && (
          <>
            {activeTab === 'search' && !query && (
              <EmptyState icon={Search} title="Find your next product">
                Type a keyword above to search CJ&apos;s live catalog, or start with a popular search.
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {POPULAR_SEARCHES.map((q) => (
                    <button key={q} onClick={() => setInputVal(q)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5">
                      {q}
                    </button>
                  ))}
                </div>
              </EmptyState>
            )}
            {activeTab === 'search' && searchError && <ErrorLine>{searchError}</ErrorLine>}
            {activeTab === 'my' && myError && <ErrorLine>{myError}</ErrorLine>}
            {((activeTab === 'search' && loading) || (activeTab === 'my' && loadingMy)) && <ProductGridSkeleton />}
            {activeTab === 'search' && !loading && !searchError && query && products.length === 0 && (
              <EmptyState icon={Search} title="No products found">Nothing matched &ldquo;{query}&rdquo;. Try a shorter or different keyword.</EmptyState>
            )}
            {activeTab === 'my' && !loadingMy && myLoaded && !myError && myProducts.length === 0 && (
              <EmptyState icon={Package} title="Nothing here yet">
                On CJ&apos;s site, browse a product and click &ldquo;Add to My Product&rdquo;. It will show up here.
              </EmptyState>
            )}
            {cjList.length > 0 && !(activeTab === 'search' ? loading : loadingMy) && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {cjList.length} product{cjList.length !== 1 ? 's' : ''}{activeTab === 'search' && query ? <> for &ldquo;{query}&rdquo;</> : null}
                </p>
                <ProductGrid>
                  {cjList.map((p) => (
                    <ProductCard key={p.pid} image={p.image} name={p.name} fallback={Package} cost={p.cost_price} costLabel="CJ cost"
                      onImport={() => { setImportTarget(p); setImportedId(null); }} />
                  ))}
                </ProductGrid>
              </div>
            )}
            {importTarget && (
              <CJImportModal shopId={shopId} product={importTarget} onClose={() => setImportTarget(null)}
                onImported={(id, name) => { setImportedId({ id, name }); setImportTarget(null); }} />
            )}
          </>
        )}

        {/* ── HyperSKU ── */}
        {supplier === 'hypersku' && (
          <>
            {hyperskuErr && <ErrorLine>{hyperskuErr}</ErrorLine>}
            {hyperskuLoading && <ProductGridSkeleton />}
            {!hyperskuLoading && hyperskuIsLoaded && !hyperskuErr && hyperskuList.length === 0 && (
              <EmptyState icon={Package} title={hyperskuTab === 'catalog' ? 'Nothing came back' : 'Nothing here yet'}>
                {hyperskuTab === 'catalog' ? 'HyperSKU returned no products right now. Try again shortly.' : 'Add products to your HyperSKU shortlist on their own site first.'}
              </EmptyState>
            )}
            {hyperskuList.length > 0 && !hyperskuLoading && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{hyperskuList.length} product{hyperskuList.length !== 1 ? 's' : ''}</p>
                <ProductGrid>
                  {hyperskuList.map((p) => (
                    <ProductCard key={p.pid} image={p.image} name={p.name} fallback={Package} cost={p.cost_price} costLabel="HyperSKU cost"
                      onImport={() => { setHyperskuImportTarget(p); setImportedId(null); }} />
                  ))}
                </ProductGrid>
              </div>
            )}
            {hyperskuImportTarget && (
              <CJImportModal shopId={shopId} product={hyperskuImportTarget} supplier="hypersku" onClose={() => setHyperskuImportTarget(null)}
                onImported={(id, name) => { setImportedId({ id, name }); setHyperskuImportTarget(null); }} />
            )}
          </>
        )}

        {/* ── Printful ── */}
        {supplier === 'printful' && (
          <>
            {loadingPrintful && <ProductGridSkeleton />}
            {!loadingPrintful && printfulLoaded && printfulProducts.length === 0 && (
              <EmptyState icon={Shirt} title="Nothing here yet">
                Design and publish a product on <a href="https://www.printful.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Printful&apos;s dashboard</a> first. It will show up here.
              </EmptyState>
            )}
            {printfulProducts.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{printfulProducts.length} product{printfulProducts.length !== 1 ? 's' : ''}</p>
                <ProductGrid>
                  {printfulProducts.map((p) => (
                    <ProductCard key={p.sync_product_id} image={p.image} name={p.name} fallback={Shirt}
                      note={`${p.variant_count} variant${p.variant_count !== 1 ? 's' : ''}`}
                      onImport={() => { setPrintfulImportTarget(p); setImportedId(null); }} />
                  ))}
                </ProductGrid>
              </div>
            )}
            {printfulImportTarget && (
              <PrintfulImportModal shopId={shopId} product={printfulImportTarget} onClose={() => setPrintfulImportTarget(null)}
                onImported={(id, name) => { setImportedId({ id, name }); setPrintfulImportTarget(null); }} />
            )}
          </>
        )}
      </div>

      <ImportHelpPanel supplier={supplier} />
    </div>
  );
}
