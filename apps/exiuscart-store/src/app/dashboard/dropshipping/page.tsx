'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, X, Loader2, ExternalLink, Package, Lock, ToggleLeft, ToggleRight, Search, ShoppingBag, ChevronRight, AlertCircle } from 'lucide-react';
import { dropshipApi } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

// Update these when you have affiliate signup links
const SIGNUP_LINKS: Record<string, string> = {
  cj:       'https://app.cjdropshipping.com/register.html',
  zendrop:  'https://app.zendrop.com/signup',
  hypersku: 'https://www.hypersku.com/register',
  wiio:     'https://wiio.com/register',
};

interface Supplier {
  supplier_type: string;
  name: string;
  description: string;
  signup_url: string;
  plan_required: string;
  connected: boolean;
  auto_fulfill_enabled: boolean;
  locked: boolean;
}

// ── CJ Connect Modal ──────────────────────────────────────────────────────────

function CJConnectModal({ shopId, onConnected, onClose }: {
  shopId: string; onConnected: () => void; onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await dropshipApi.connectCJ(shopId, { email, password });
      onConnected();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Connection failed. Check your email and password.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="font-semibold text-foreground">Connect CJ Dropshipping</p>
            <p className="text-xs text-muted-foreground mt-0.5">Enter your CJ account credentials</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
          )}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">CJ Account Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="your@email.com"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">CJ Account Password *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              placeholder="Your CJ password"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">
            Your credentials are encrypted and stored securely. They are never shown again after saving.
          </p>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting...' : 'Connect CJ Dropshipping'}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have a CJ account?{' '}
            <a href={SIGNUP_LINKS.cj} target="_blank" rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80">
              Create one free →
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

// ── API Key Modal (Zendrop, HyperSKU, Wiio) ───────────────────────────────────

function ApiKeyModal({ supplier, shopId, onConnected, onClose }: {
  supplier: Supplier; shopId: string; onConnected: () => void; onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await dropshipApi.connectApiKey(shopId, { supplier_type: supplier.supplier_type, api_key: apiKey });
      onConnected();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Connection failed. Check your API key.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="font-semibold text-foreground">Connect {supplier.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Paste your {supplier.name} API key</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
          )}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">{supplier.name} API Key *</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
              placeholder="Paste your API key here"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
            Find your API key in your {supplier.name} dashboard under Settings → API or Developer.
          </p>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting...' : `Connect ${supplier.name}`}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have a {supplier.name} account?{' '}
            <a href={SIGNUP_LINKS[supplier.supplier_type] ?? supplier.signup_url} target="_blank" rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80">
              Sign up →
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

// ── Supplier Card ─────────────────────────────────────────────────────────────

function SupplierCard({ supplier, shopId, plan, onRefresh }: {
  supplier: Supplier; shopId: string; plan: string; onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);

  const disconnect = async () => {
    if (!confirm(`Disconnect ${supplier.name}? Pending orders will not be affected.`)) return;
    setDisconnecting(true);
    try {
      await dropshipApi.disconnect(shopId, supplier.supplier_type);
      onRefresh();
    } finally { setDisconnecting(false); }
  };

  const toggleAuto = async () => {
    setTogglingAuto(true);
    try {
      await dropshipApi.toggleAutoFulfill(shopId, !supplier.auto_fulfill_enabled);
      onRefresh();
    } finally { setTogglingAuto(false); }
  };

  return (
    <>
      <div className={`bg-card border rounded-xl p-5 flex flex-col gap-4 transition ${
        supplier.locked ? 'opacity-60 border-border' :
        supplier.connected ? 'border-green-500/30 bg-green-500/5' :
        'border-border'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
            supplier.locked ? 'bg-muted text-muted-foreground' :
            supplier.connected ? 'bg-green-500/10 text-green-500' :
            'bg-primary/10 text-primary'
          }`}>
            {supplier.locked ? 'Premium only' : supplier.connected ? 'Connected' : 'Available'}
          </span>
        </div>

        <div className="flex-1">
          <p className="font-semibold text-foreground text-sm">{supplier.name}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{supplier.description}</p>
        </div>

        {/* Auto-fulfill toggle — Premium + connected only */}
        {supplier.connected && plan === 'premium' && (
          <div className="flex items-center justify-between py-3 px-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs font-medium text-foreground">Auto-fulfill orders</p>
              <p className="text-xs text-muted-foreground">Send new orders to {supplier.name} automatically</p>
            </div>
            <button onClick={toggleAuto} disabled={togglingAuto} className="text-primary transition shrink-0">
              {togglingAuto ? <Loader2 className="w-5 h-5 animate-spin" /> :
                supplier.auto_fulfill_enabled
                  ? <ToggleRight className="w-8 h-8" />
                  : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              }
            </button>
          </div>
        )}

        {/* Action buttons */}
        {supplier.locked ? (
          <Link href="/dashboard/billing"
            className="w-full py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition text-muted-foreground text-center flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Upgrade to Premium
          </Link>
        ) : supplier.connected ? (
          <div className="flex gap-2">
            <a href={SIGNUP_LINKS[supplier.supplier_type] ?? supplier.signup_url} target="_blank" rel="noopener noreferrer"
              className="flex-1 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted transition text-muted-foreground text-center flex items-center justify-center gap-1">
              Open {supplier.name} <ExternalLink className="w-3 h-3" />
            </a>
            <button onClick={disconnect} disabled={disconnecting}
              className="px-3 py-2 text-xs font-medium border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 transition flex items-center gap-1.5">
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Disconnect'}
            </button>
          </div>
        ) : (
          <button onClick={() => setShowModal(true)}
            className="w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
            Connect {supplier.name}
          </button>
        )}
      </div>

      {showModal && supplier.supplier_type === 'cj' && (
        <CJConnectModal shopId={shopId}
          onConnected={() => { setShowModal(false); onRefresh(); }}
          onClose={() => setShowModal(false)} />
      )}
      {showModal && supplier.supplier_type !== 'cj' && (
        <ApiKeyModal supplier={supplier} shopId={shopId}
          onConnected={() => { setShowModal(false); onRefresh(); }}
          onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

// ── CJ Browse & Import ────────────────────────────────────────────────────────

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

function CJImportModal({ shopId, product, onClose, onImported }: {
  shopId: string;
  product: CJProduct;
  onClose: () => void;
  onImported: (productId: number, name: string) => void;
}) {
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
        setSellingPrice(String(Math.round(d.cost_price * 2 * 100) / 100));
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
                <span className="text-muted-foreground">CJ Cost Price</span>
                <span className="font-semibold text-foreground">${(detail?.cost_price ?? product.cost_price).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="sell-price" className="text-muted-foreground">Your Selling Price</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-xs">$</span>
                  <input id="sell-price" type="number" step="0.01" min="0" value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-24 px-2 py-1 bg-background border border-border rounded-lg text-sm text-right font-semibold outline-none focus:ring-2 focus:ring-primary text-foreground" />
                </div>
              </div>
              {sellingPrice && detail && parseFloat(sellingPrice) > (detail.cost_price ?? 0) && (
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

function CJBrowseSection({ shopId }: { shopId: string }) {
  const [query, setQuery] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [products, setProducts] = useState<CJProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [importTarget, setImportTarget] = useState<CJProduct | null>(null);
  const [importedId, setImportedId] = useState<{ id: number; name: string } | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Browse CJ Products</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Search millions of products from CJ and import directly to your store with one click.</p>
      </div>

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

      {/* Results */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p) => (
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

      {!loading && query && products.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">No products found for &ldquo;{query}&rdquo;. Try a different keyword.</div>
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

      {importTarget && (
        <CJImportModal
          shopId={shopId}
          product={importTarget}
          onClose={() => setImportTarget(null)}
          onImported={(id, name) => { setImportedId({ id, name }); setImportTarget(null); }}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DropshippingPage() {
  const [shopId, setShopId] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    setLoading(true);
    dropshipApi.getConnections(shopId)
      .then((r) => { setSuppliers(r.data?.suppliers ?? []); setPlan(r.data?.plan ?? ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const connectedCount = suppliers.filter((s) => s.connected).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dropshipping Suppliers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect a supplier. ExiusCart forwards orders to them — they pack and ship directly to your customer.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-muted/40 border border-border rounded-xl px-5 py-4 space-y-2">
        <p className="text-sm font-medium text-foreground">How it works</p>
        <div className="grid sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
            <span>Connect a supplier below</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
            <span>Search CJ products below and click <strong className="text-foreground">Import</strong> — ExiusCart creates the listing automatically</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[10px]">3</span>
            <span>Order comes in → click <strong className="text-foreground">Fulfill</strong> on the order (or auto-fulfill on Premium)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[10px]">4</span>
            <span>Supplier ships to customer — tracking appears here automatically</span>
          </div>
        </div>
      </div>

      {/* Starter banner */}
      {!loading && plan === 'starter' && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border bg-muted/60 border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">CJ Dropshipping is included in your Starter plan</p>
            <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Premium to unlock Zendrop, HyperSKU, Wiio, and auto-fulfill.</p>
          </div>
          <Link href="/dashboard/billing"
            className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition whitespace-nowrap">
            Upgrade to Premium
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : (
        <>
          {connectedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-500 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {connectedCount} supplier{connectedCount > 1 ? 's' : ''} connected
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {suppliers.map((s) => (
              <SupplierCard key={s.supplier_type} supplier={s} shopId={shopId} plan={plan} onRefresh={load} />
            ))}
          </div>

          {connectedCount > 0 && (
            <div className="border border-border rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Supplier Orders</p>
                <p className="text-xs text-muted-foreground mt-0.5">Track all orders sent to suppliers — status, tracking numbers, costs.</p>
              </div>
              <Link href="/dashboard/dropshipping/orders"
                className="text-sm text-primary font-medium hover:underline whitespace-nowrap">
                View supplier orders →
              </Link>
            </div>
          )}

          {/* CJ Browse & Import — only when CJ is connected */}
          {suppliers.some((s) => s.supplier_type === 'cj' && s.connected) && (
            <>
              <div className="border-t border-border" />
              <CJBrowseSection shopId={shopId} />
            </>
          )}
        </>
      )}
    </div>
  );
}
