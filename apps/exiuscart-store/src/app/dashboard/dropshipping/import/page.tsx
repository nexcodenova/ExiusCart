'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, X, Loader2, Package, Lock, Search, ShoppingBag, ChevronRight, AlertCircle, Shirt } from 'lucide-react';
import { dropshipApi, channelsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import Link from 'next/link';
import Image from 'next/image';

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

// ── Import Modal ──────────────────────────────────────────────────────────────

function CJImportModal({ shopId, product, onClose, onImported }: {
  shopId: string;
  product: CJProduct;
  onClose: () => void;
  onImported: (productId: number, name: string) => void;
}) {
  const { baseSym, baseCurrency } = useCurrency();
  const [detail, setDetail] = useState<CJProductDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [sellingPrice, setSellingPrice] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    setLoadingDetail(true);
    dropshipApi.cjProductDetail(shopId, product.pid)
      .then((r) => {
        const d = r.data?.product as CJProductDetail;
        setDetail(d);
        // Not pre-filled with cost*2 anymore — CJ's cost is always USD, and
        // this store's price is in its own base currency (baseSym), so a
        // client-side "2x" guess would show a raw USD number mislabeled as
        // that currency. Left blank, the backend computes 2x and converts
        // it properly using a real exchange rate.
      })
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [shopId, product.pid]);

  const handleImport = async () => {
    setImporting(true); setError('');
    try {
      const price = parseFloat(sellingPrice) || undefined;
      const r = await dropshipApi.cjImport(shopId, product.pid, price);
      onImported(r.data.product_id, r.data.name);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Import failed. Please try again.');
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

            {/* Pricing */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">CJ Cost Price (USD)</span>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ImportProductsPage() {
  const [shopId, setShopId] = useState('');
  const [checking, setChecking] = useState(true);
  const [cjConnected, setCjConnected] = useState(false);
  const [printfulConnected, setPrintfulConnected] = useState(false);
  const [aliexpressConnected, setAliexpressConnected] = useState(false);
  const [isTheDersiUser, setIsTheDersiUser] = useState(false);

  // Only relevant once more than one supplier is connected — otherwise the
  // page just shows whichever one is available with no switcher at all.
  const [supplier, setSupplier] = useState<'cj' | 'printful' | 'aliexpress'>('cj');

  const [aliexpressUrl, setAliexpressUrl] = useState('');
  const [aliexpressSellingPrice, setAliexpressSellingPrice] = useState('');
  const [importingAliexpress, setImportingAliexpress] = useState(false);
  const [aliexpressError, setAliexpressError] = useState('');

  const [activeTab, setActiveTab] = useState<'search' | 'my'>('search');
  const [query, setQuery] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [products, setProducts] = useState<CJProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [myProducts, setMyProducts] = useState<CJProduct[]>([]);
  const [loadingMy, setLoadingMy] = useState(false);
  const [myLoaded, setMyLoaded] = useState(false);
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
        setCjConnected(cj);
        setPrintfulConnected(printful);
        setAliexpressConnected(aliexpress);
        setSupplier(cj ? 'cj' : printful ? 'printful' : 'aliexpress');
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
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!inputVal.trim()) { setProducts([]); setQuery(''); return; }
    searchTimeout.current = setTimeout(() => setQuery(inputVal.trim()), 500);
  }, [inputVal]);

  useEffect(() => {
    if (!query || !shopId) return;
    setLoading(true);
    setProducts([]);
    dropshipApi.cjSearch(shopId, query)
      .then((r) => setProducts(r.data?.products ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query, shopId]);

  useEffect(() => {
    if (activeTab !== 'my' || myLoaded || !shopId) return;
    setLoadingMy(true);
    dropshipApi.cjMyProducts(shopId)
      .then((r) => setMyProducts(r.data?.products ?? []))
      .catch(() => {})
      .finally(() => { setLoadingMy(false); setMyLoaded(true); });
  }, [activeTab, myLoaded, shopId]);

  if (checking) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (isTheDersiUser) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import Products</h1>
          <p className="text-sm text-muted-foreground mt-1">Search CJ&apos;s catalog and add products directly to your store.</p>
        </div>
        <div className="border border-border rounded-2xl bg-card p-8 sm:p-10 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Dropshipping is for direct ExiusCart sellers</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Your store is managed by <strong className="text-foreground">TheDersi</strong>, and your orders are fulfilled through TheDersi&apos;s own logistics.
          </p>
          <Link href="/dashboard/channels"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            Back to Channels
          </Link>
        </div>
      </div>
    );
  }

  const connectedCount = [cjConnected, printfulConnected, aliexpressConnected].filter(Boolean).length;

  if (connectedCount === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import Products</h1>
          <p className="text-sm text-muted-foreground mt-1">Search a supplier&apos;s catalog and add products directly to your store.</p>
        </div>
        <div className="border border-border rounded-2xl bg-card p-8 sm:p-10 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-5">
            <Package className="w-7 h-7 text-orange-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Connect a supplier first</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            You need an active CJ Dropshipping, Printful, or AliExpress connection before you can browse and import products.
          </p>
          <Link href="/dashboard/dropshipping"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            Go to Suppliers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Import Products</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {supplier === 'cj' ? "Search CJ's catalog and import directly to your store with one click."
            : supplier === 'printful' ? 'Bring your already-designed Printful products into your store.'
            : 'Paste an AliExpress product link and import it directly.'}
        </p>
      </div>

      {/* Supplier switcher — only shown once there's actually a choice */}
      {connectedCount > 1 && (
        <div className="flex gap-2">
          {cjConnected && (
            <button onClick={() => setSupplier('cj')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition ${
                supplier === 'cj' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
              }`}>
              <Package className="w-3.5 h-3.5" /> CJ Dropshipping
            </button>
          )}
          {printfulConnected && (
            <button onClick={() => setSupplier('printful')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition ${
                supplier === 'printful' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
              }`}>
              <Shirt className="w-3.5 h-3.5" /> Printful
            </button>
          )}
          {aliexpressConnected && (
            <button onClick={() => setSupplier('aliexpress')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition ${
                supplier === 'aliexpress' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
              }`}>
              <ShoppingBag className="w-3.5 h-3.5" /> AliExpress
            </button>
          )}
        </div>
      )}

      {supplier === 'aliexpress' && (
        <div className="max-w-xl space-y-4">
          {importedId && (
            <div className="flex items-center justify-between gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">&ldquo;{importedId.name}&rdquo; imported successfully!</p>
              </div>
              <Link href={`/dashboard/products/${importedId.id}`}
                className="text-xs text-primary font-medium flex items-center gap-1 hover:underline shrink-0">
                Edit product <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">AliExpress product link</label>
            <input type="text" value={aliexpressUrl} onChange={(e) => setAliexpressUrl(e.target.value)}
              placeholder="https://www.aliexpress.com/item/1005001234567890.html"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none" />
            <p className="text-xs text-muted-foreground mt-1.5">
              Find and pick the product on AliExpress&apos;s own site, then paste its link here — everything (images, variants, description) imports automatically.
            </p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Selling price <span className="opacity-60 font-normal">— optional, leave blank to use 2x cost, converted to your store&apos;s currency</span></label>
            <input type="number" step="0.01" min="0" value={aliexpressSellingPrice} onChange={(e) => setAliexpressSellingPrice(e.target.value)}
              className="w-40 px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground" />
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
          </div>
        </div>
      )}

      {supplier !== 'aliexpress' && (supplier === 'printful' ? (
        <>
          <p className="text-xs text-muted-foreground -mt-2">
            Products you&apos;ve designed on Printful&apos;s own site (Design Lab / Product Templates → Published) — already mocked up, ready to import.
          </p>

          {importedId && (
            <div className="flex items-center justify-between gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">&ldquo;{importedId.name}&rdquo; imported successfully!</p>
              </div>
              <Link href={`/dashboard/products/${importedId.id}`}
                className="text-xs text-primary font-medium flex items-center gap-1 hover:underline shrink-0">
                Edit product <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {loadingPrintful && (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading your Printful products…</span>
            </div>
          )}

          {!loadingPrintful && printfulLoaded && printfulProducts.length === 0 && (
            <div className="text-center py-20 text-sm text-muted-foreground max-w-md mx-auto">
              Nothing here yet. Design and publish a product on <a href="https://www.printful.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Printful&apos;s dashboard</a> first — it&apos;ll show up here.
            </div>
          )}

          {printfulProducts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {printfulProducts.map((p) => (
                <div key={p.sync_product_id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-primary/40 transition group">
                  <div className="relative aspect-square bg-muted">
                    {p.image
                      ? <Image src={p.image} alt={p.name} fill className="object-cover group-hover:scale-105 transition duration-300" unoptimized />
                      : <div className="absolute inset-0 flex items-center justify-center"><Shirt className="w-8 h-8 text-muted-foreground/30" /></div>
                    }
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <p className="text-xs text-foreground font-medium line-clamp-2 leading-snug">{p.name}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <p className="text-[10px] text-muted-foreground">{p.variant_count} variant{p.variant_count !== 1 ? 's' : ''}</p>
                      <button onClick={() => { setPrintfulImportTarget(p); setImportedId(null); }}
                        className="text-xs px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium shrink-0">
                        Import
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {printfulImportTarget && (
            <PrintfulImportModal
              shopId={shopId}
              product={printfulImportTarget}
              onClose={() => setPrintfulImportTarget(null)}
              onImported={(id, name) => { setImportedId({ id, name }); setPrintfulImportTarget(null); }}
            />
          )}
        </>
      ) : (
      <>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setActiveTab('search')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === 'search' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
          Search Catalog
        </button>
        <button onClick={() => setActiveTab('my')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === 'my' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
          My CJ Products
        </button>
      </div>

      {activeTab === 'search' && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Search CJ products e.g. wireless earbuds, phone case, yoga mat…"
              className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none"
            />
            {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {inputVal.trim().split(/\s+/).filter(Boolean).length > 4 && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>CJ&apos;s search works best with short, simple terms (1–3 words) like &ldquo;vacuum cleaner&rdquo; — long or very specific phrases tend to return unrelated results.</span>
            </div>
          )}
        </>
      )}

      {activeTab === 'my' && (
        <p className="text-xs text-muted-foreground -mt-2">
          Products you&apos;ve added to &ldquo;My Product&rdquo; on CJ&apos;s own site — already vetted by you, ready to import.
        </p>
      )}

      {/* Import success toast */}
      {importedId && (
        <div className="flex items-center justify-between gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">&ldquo;{importedId.name}&rdquo; imported successfully!</p>
          </div>
          <Link href={`/dashboard/products/${importedId.id}`}
            className="text-xs text-primary font-medium flex items-center gap-1 hover:underline shrink-0">
            Edit product <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Empty state before any search */}
      {activeTab === 'search' && !query && (
        <div className="text-center py-20 text-sm text-muted-foreground">
          Start typing above to search CJ&apos;s catalog.
        </div>
      )}

      {activeTab === 'my' && loadingMy && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading your CJ products…</span>
        </div>
      )}

      {activeTab === 'my' && !loadingMy && myLoaded && myProducts.length === 0 && (
        <div className="text-center py-20 text-sm text-muted-foreground max-w-md mx-auto">
          Nothing here yet. On CJ&apos;s site, browse a product and click &ldquo;Add to My Product&rdquo; — it&apos;ll show up here.
        </div>
      )}

      {/* Results */}
      {(activeTab === 'search' ? products : myProducts).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(activeTab === 'search' ? products : myProducts).map((p) => (
            <div key={p.pid} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-primary/40 transition group">
              <div className="relative aspect-square bg-muted">
                {p.image
                  ? <Image src={p.image} alt={p.name} fill className="object-cover group-hover:scale-105 transition duration-300" unoptimized />
                  : <div className="absolute inset-0 flex items-center justify-center"><Package className="w-8 h-8 text-muted-foreground/30" /></div>
                }
              </div>
              <div className="p-3 flex flex-col gap-2 flex-1">
                <p className="text-xs text-foreground font-medium line-clamp-2 leading-snug">{p.name}</p>
                <div className="flex items-center justify-between mt-auto">
                  <div>
                    <p className="text-[10px] text-muted-foreground">CJ cost</p>
                    <p className="text-sm font-bold text-foreground">${p.cost_price.toFixed(2)}</p>
                  </div>
                  <button onClick={() => { setImportTarget(p); setImportedId(null); }}
                    className="text-xs px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium shrink-0">
                    Import
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'search' && !loading && query && products.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">No products found for &ldquo;{query}&rdquo;. Try a different keyword.</div>
      )}

      {importTarget && (
        <CJImportModal
          shopId={shopId}
          product={importTarget}
          onClose={() => setImportTarget(null)}
          onImported={(id, name) => { setImportedId({ id, name }); setImportTarget(null); }}
        />
      )}
      </>
      ))}
    </div>
  );
}
