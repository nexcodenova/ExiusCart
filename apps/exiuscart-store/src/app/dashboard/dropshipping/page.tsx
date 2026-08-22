'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, ExternalLink, Package, Lock, ToggleLeft, ToggleRight, Eye, EyeOff, Zap, Boxes, Layers, ShoppingBag, Shirt, Palette, Printer } from 'lucide-react';
import { dropshipApi, channelsApi } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

// Update these when you have affiliate signup links
const SIGNUP_LINKS: Record<string, string> = {
  cj:         'https://www.cjdropshipping.com/register.html?token=bce7840c-d60b-46e7-b39c-872e1572796c',  // affiliate — 2% of referred sellers' CJ revenue for 1yr
  zendrop:    'https://app.zendrop.com/signup',
  hypersku:   'https://www.hypersku.com/register',
  wiio:       'https://wiio.com/register',
  aliexpress: 'https://developers.aliexpress.com/',
  printful:   'https://www.printful.com/dashboard/register',
  printify:   'https://printify.com/app/register',
  gelato:     'https://www.gelato.com/sign-up',
};

// "Open X" for an already-connected supplier must land on the real logged-in
// dashboard, not the signup page above — a signup/register URL 404s or loops
// once the seller already has an account (this is what Printful's
// dashboard/register link did after connecting).
const DASHBOARD_LINKS: Record<string, string> = {
  cj:         'https://cjdropshipping.com/my-product',
  zendrop:    'https://app.zendrop.com/',
  hypersku:   'https://www.hypersku.com/',
  wiio:       'https://wiio.com/',
  aliexpress: 'https://developers.aliexpress.com/',
  printful:   'https://www.printful.com/dashboard',
  printify:   'https://printify.com/app/store',
  gelato:     'https://www.gelato.com/dashboard',
};

// Per-brand accent so the supplier grid reads at a glance instead of every
// card looking identical. CJ/Zendrop use their real logo full-bleed (own
// background baked in); HyperSKU uses a cropped icon-only mark (its source
// file is a wide wordmark, cropped down to just the peak symbol) centered
// on our own tint, same treatment as Wiio/AliExpress's lucide-icon fallback.
const SUPPLIER_STYLE: Record<string, { icon: React.ElementType; color: string; bg: string; logo?: string; logoFit?: 'cover' | 'contain' }> = {
  cj:         { icon: Package,     color: 'text-orange-500', bg: 'bg-orange-500/10', logo: '/dropshipping/cj_logo.png',       logoFit: 'cover'   },
  zendrop:    { icon: Zap,         color: 'text-violet-500', bg: 'bg-violet-500/10', logo: '/dropshipping/zendrop_logo.png', logoFit: 'cover'   },
  hypersku:   { icon: Boxes,       color: 'text-teal-500',   bg: 'bg-teal-500/10',   logo: '/dropshipping/hypersku_icon.png', logoFit: 'contain' },
  wiio:       { icon: Layers,      color: 'text-rose-500',   bg: 'bg-rose-500/10'   },
  aliexpress: { icon: ShoppingBag, color: 'text-red-500',    bg: 'bg-red-500/10'   },
  printful:   { icon: Shirt,       color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  printify:   { icon: Palette,     color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10' },
  gelato:     { icon: Printer,     color: 'text-amber-500',  bg: 'bg-amber-500/10' },
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
  category: 'dropship' | 'pod';
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect CJ Dropshipping</DialogTitle>
          <DialogDescription>Paste your CJ API key</DialogDescription>
        </DialogHeader>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
          )}
          <div>
            <Label className="mb-1.5 block">CJ API Key *</Label>
            <div className="relative">
              <Input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
                placeholder="CJUserNum@api@..." className="pr-10" />
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
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting...' : 'Connect CJ Dropshipping'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have a CJ account?{' '}
            <a href={SIGNUP_LINKS.cj} target="_blank" rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80">
              Create one free →
            </a>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Printful Connect Modal ────────────────────────────────────────────────────

function PrintfulConnectModal({ shopId, onConnected, onClose }: {
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
      await dropshipApi.connectPrintful(shopId, { api_key: apiKey });
      onConnected();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Connection failed. Check your API token.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Printful</DialogTitle>
          <DialogDescription>Paste your Printful Private API Token</DialogDescription>
        </DialogHeader>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
          )}
          <div>
            <Label className="mb-1.5 block">Printful API Token *</Label>
            <div className="relative">
              <Input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
                placeholder="Paste your token" className="pr-10" />
              <button type="button" onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showApiKey ? 'Hide API token' : 'Show API token'}>
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">
            Generate a Private Token from your Printful account under Settings → Stores → API. It&apos;s verified against your real store on connect, then encrypted and stored securely.
          </p>
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting...' : 'Connect Printful'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have a Printful account?{' '}
            <a href={SIGNUP_LINKS.printful} target="_blank" rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80">
              Create one free →
            </a>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── API Key Modal (Zendrop, HyperSKU, Wiio, AliExpress, Printify, Gelato) ──

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {supplier.name}</DialogTitle>
          <DialogDescription>Paste your {supplier.name} API key</DialogDescription>
        </DialogHeader>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
          )}
          <div>
            <Label className="mb-1.5 block">{supplier.name} API Key *</Label>
            <div className="relative">
              <Input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
                placeholder="Paste your API key here" className="pr-10" />
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
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting...' : `Connect ${supplier.name}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have a {supplier.name} account?{' '}
            <a href={SIGNUP_LINKS[supplier.supplier_type] ?? supplier.signup_url} target="_blank" rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80">
              Sign up →
            </a>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Supplier Card ─────────────────────────────────────────────────────────────

function SupplierCard({ supplier, shopId, plan, onRefresh }: {
  supplier: Supplier; shopId: string; plan: string; onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [connectingAliexpress, setConnectingAliexpress] = useState(false);
  const [aliexpressError, setAliexpressError] = useState('');

  // AliExpress is real OAuth2 (one shared ExiusCart app, the seller
  // authorizes their own AliExpress account) — no form/modal, just a
  // redirect, same shape as eBay's Connect button.
  const connectAliexpress = async () => {
    setConnectingAliexpress(true); setAliexpressError('');
    try {
      const res = await dropshipApi.aliexpressAuthorize(shopId);
      window.location.href = res.data.authorize_url;
    } catch (e: any) {
      setAliexpressError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Could not start AliExpress connection. Try again.');
      setConnectingAliexpress(false);
    }
  };

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
      <Card className={
        supplier.locked ? 'opacity-60' :
        supplier.connected ? 'border-green-500/30 bg-green-500/5' :
        ''
      }>
        <CardContent className="p-5 flex flex-col gap-4">
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
            <Badge variant={supplier.locked ? 'muted' : supplier.connected ? 'success' : 'default'}>
              {supplier.locked ? 'Premium only' : supplier.connected ? 'Connected' : 'Available'}
            </Badge>
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
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/billing">
                <Lock className="w-3.5 h-3.5" /> Upgrade to Premium
              </Link>
            </Button>
          ) : supplier.connected ? (
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={DASHBOARD_LINKS[supplier.supplier_type] ?? supplier.signup_url} target="_blank" rel="noopener noreferrer">
                  Open {supplier.name} <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
              <Button variant="destructive" size="sm" onClick={disconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Disconnect'}
              </Button>
            </div>
          ) : supplier.supplier_type === 'aliexpress' ? (
            <div className="space-y-1.5">
              <Button className="w-full" onClick={connectAliexpress} disabled={connectingAliexpress}>
                {connectingAliexpress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {connectingAliexpress ? 'Redirecting…' : `Connect ${supplier.name}`}
              </Button>
              {aliexpressError && <p className="text-xs text-destructive">{aliexpressError}</p>}
            </div>
          ) : (
            <Button className="w-full" onClick={() => setShowModal(true)}>
              Connect {supplier.name}
            </Button>
          )}
        </CardContent>
      </Card>

      {showModal && supplier.supplier_type === 'cj' && (
        <CJConnectModal shopId={shopId}
          onConnected={() => { setShowModal(false); onRefresh(); }}
          onClose={() => setShowModal(false)} />
      )}
      {showModal && supplier.supplier_type === 'printful' && (
        <PrintfulConnectModal shopId={shopId}
          onConnected={() => { setShowModal(false); onRefresh(); }}
          onClose={() => setShowModal(false)} />
      )}
      {showModal && supplier.supplier_type !== 'cj' && supplier.supplier_type !== 'printful' && (
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
            Connect a dropshipping or print-on-demand supplier. ExiusCart forwards orders to them automatically.
          </p>
        </div>

        <Card className="rounded-2xl p-8 sm:p-10 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Dropshipping is for direct ExiusCart sellers</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Your store is managed by <strong className="text-foreground">TheDersi</strong>, and your orders are fulfilled through TheDersi&apos;s own logistics. Dropshipping and print-on-demand suppliers like CJ, Zendrop, AliExpress, Printful &amp; Gelato are only available to sellers on a direct ExiusCart plan (Starter or Premium).
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/channels">Back to Channels</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Suppliers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect a dropshipping or print-on-demand supplier. ExiusCart forwards orders to them automatically.
        </p>
      </div>

      {/* How it works */}
      <Card className="bg-muted/40 rounded-xl">
        <CardContent className="px-5 py-4 space-y-2">
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
        </CardContent>
      </Card>

      {/* Starter banner */}
      {!loading && plan === 'starter' && (
        <Card className="bg-muted/60 rounded-xl">
          <CardContent className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">CJ Dropshipping is included in your Starter plan</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Premium to unlock Zendrop, HyperSKU, Wiio, AliExpress, Printful, Printify, Gelato, and auto-fulfill.</p>
            </div>
            <Button asChild size="sm" className="shrink-0 whitespace-nowrap">
              <Link href="/dashboard/billing">Upgrade to Premium</Link>
            </Button>
          </CardContent>
        </Card>
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

          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Dropshipping</p>
            <p className="text-xs text-muted-foreground mb-3">Ready-made products — supplier picks, packs and ships from their own stock.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              {suppliers.filter((s) => s.category === 'dropship').map((s) => (
                <SupplierCard key={s.supplier_type} supplier={s} shopId={shopId} plan={plan} onRefresh={load} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Print-on-Demand</p>
            <p className="text-xs text-muted-foreground mb-3">Custom hoodies, tees, mugs & more — design once, the provider prints and ships each order automatically. No inventory to hold.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              {suppliers.filter((s) => s.category === 'pod').map((s) => (
                <SupplierCard key={s.supplier_type} supplier={s} shopId={shopId} plan={plan} onRefresh={load} />
              ))}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
