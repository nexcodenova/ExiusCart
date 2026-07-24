'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, X, Loader2, ExternalLink, Package, Lock, ToggleLeft, ToggleRight, Eye, EyeOff, Zap, Boxes, Layers, ArrowRight } from 'lucide-react';
import { dropshipApi, channelsApi } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

// Update these when you have affiliate signup links
const SIGNUP_LINKS: Record<string, string> = {
  cj:       'https://www.cjdropshipping.com/register.html?token=bce7840c-d60b-46e7-b39c-872e1572796c',  // affiliate — 2% of referred sellers' CJ revenue for 1yr
  zendrop:  'https://app.zendrop.com/signup',
  hypersku: 'https://www.hypersku.com/register',
  wiio:     'https://wiio.com/register',
};

// Per-brand accent so the supplier grid reads at a glance instead of every
// card looking identical. CJ/Zendrop use their real logo full-bleed (own
// background baked in); HyperSKU uses a cropped icon-only mark (its source
// file is a wide wordmark, cropped down to just the peak symbol) centered
// on our own tint, same treatment as Wiio's lucide-icon fallback.
const SUPPLIER_STYLE: Record<string, { icon: React.ElementType; color: string; bg: string; logo?: string; logoFit?: 'cover' | 'contain' }> = {
  cj:       { icon: Package, color: 'text-orange-500', bg: 'bg-orange-500/10', logo: '/dropshipping/cj_logo.png',       logoFit: 'cover'   },
  zendrop:  { icon: Zap,     color: 'text-violet-500', bg: 'bg-violet-500/10', logo: '/dropshipping/zendrop_logo.png', logoFit: 'cover'   },
  hypersku: { icon: Boxes,   color: 'text-teal-500',   bg: 'bg-teal-500/10',   logo: '/dropshipping/hypersku_icon.png', logoFit: 'contain' },
  wiio:     { icon: Layers,  color: 'text-rose-500',   bg: 'bg-rose-500/10'   },
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
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await dropshipApi.connectCJ(shopId, { api_key: apiKey });
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
            <p className="font-semibold text-foreground">Connect CJ Dropshipping</p>
            <p className="text-xs text-muted-foreground mt-0.5">Paste your CJ API key</p>
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
            <label className="text-sm text-muted-foreground mb-1.5 block">CJ API Key *</label>
            <div className="relative">
              <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
                placeholder="CJUserNum@api@..."
                className="w-full px-3 py-2.5 pr-10 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
              <button type="button" onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}>
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">
            CJ requires an API key, not your account password. Generate one at{' '}
            <a href="https://www.cjdropshipping.com/my.html#/authorize/API" target="_blank" rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80">
              My CJ → API management
            </a>{' '}
            → Add API → Type: &quot;API Key&quot;. It&apos;s encrypted and stored securely, and never shown again after saving.
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
  const [showApiKey, setShowApiKey] = useState(false);
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
            <div className="relative">
              <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
                placeholder="Paste your API key here"
                className="w-full px-3 py-2.5 pr-10 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
              <button type="button" onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}>
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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

  const style = SUPPLIER_STYLE[supplier.supplier_type] ?? { icon: Package, color: 'text-primary', bg: 'bg-muted' };
  const SupplierIcon = style.icon;

  return (
    <>
      <div className={`bg-card border rounded-xl p-5 flex flex-col gap-4 transition ${
        supplier.locked ? 'opacity-60 border-border' :
        supplier.connected ? 'border-green-500/30 bg-green-500/5' :
        'border-border'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
            supplier.locked ? 'bg-muted' : style.logo && style.logoFit === 'cover' ? '' : style.bg
          }`}>
            {style.logo && !supplier.locked ? (
              <Image src={style.logo} alt={supplier.name} width={40} height={40}
                className={style.logoFit === 'contain' ? 'w-2/3 h-2/3 object-contain' : 'w-full h-full object-cover'} />
            ) : (
              <SupplierIcon className={`w-5 h-5 ${supplier.locked ? 'text-muted-foreground' : style.color}`} />
            )}
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DropshippingPage() {
  const [shopId, setShopId] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [plan, setPlan] = useState('');
  const [hasTheDersi, setHasTheDersi] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    setLoading(true);
    Promise.all([
      dropshipApi.getConnections(shopId),
      channelsApi.getConnections(shopId),
    ])
      .then(([supRes, connRes]) => {
        setSuppliers(supRes.data?.suppliers ?? []);
        setPlan(supRes.data?.plan ?? '');
        setHasTheDersi((connRes.data ?? []).some((c: any) => c.channel_type === 'thedersi'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const connectedCount = suppliers.filter((s) => s.connected).length;
  // Detected via an active TheDersi connection, not plan_type — TheDersi's
  // Growth/Premium tier maps to plan='starter', same as a direct customer,
  // so a plan-string check alone would miss those sellers.
  const isTheDersiUser = hasTheDersi;

  // While the plan is still loading, show only a spinner — never flash the
  // supplier cards / "How it works" before we know if the user is a TheDersi seller.
  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  // TheDersi sellers don't get dropshipping — their fulfilment is handled by TheDersi
  if (isTheDersiUser) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect a supplier. ExiusCart forwards orders to them — they pack and ship directly to your customer.
          </p>
        </div>

        <div className="border border-border rounded-2xl bg-card p-8 sm:p-10 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Dropshipping is for direct ExiusCart sellers</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Your store is managed by <strong className="text-foreground">TheDersi</strong>, and your orders are fulfilled through TheDersi&apos;s own logistics. Dropshipping suppliers like CJ, Zendrop, HyperSKU &amp; Wiio are only available to sellers on a direct ExiusCart plan (Starter or Premium).
          </p>
          <Link href="/dashboard/channels"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            Back to Channels
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Suppliers</h1>
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
            <span>Go to <strong className="text-foreground">Import Products</strong> and click <strong className="text-foreground">Import</strong> on anything you want to sell — ExiusCart creates the listing automatically</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
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

          {/* Point to the dedicated Import Products page once a supplier is connected */}
          {suppliers.some((s) => s.supplier_type === 'cj' && s.connected) && (
            <Link href="/dashboard/dropshipping/import"
              className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition group">
              <div>
                <p className="text-sm font-semibold text-foreground">Import Products from CJ</p>
                <p className="text-xs text-muted-foreground mt-0.5">Search CJ&apos;s catalog and add products to your store with one click.</p>
              </div>
              <ArrowRight className="w-4 h-4 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </>
      )}
    </div>
  );
}
