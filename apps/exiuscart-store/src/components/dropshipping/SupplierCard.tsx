'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle2, Loader2, ExternalLink, Package, Lock, ToggleLeft, ToggleRight, Eye, EyeOff,
  Boxes, ShoppingBag, Shirt, Palette, Printer, Globe, Truck, Clock3, MapPin,
} from 'lucide-react';
import { dropshipApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';

// Update these when you have affiliate signup links
export const SIGNUP_LINKS: Record<string, string> = {
  cj:         'https://www.cjdropshipping.com/register.html?token=bce7840c-d60b-46e7-b39c-872e1572796c',  // affiliate — 2% of referred sellers' CJ revenue for 1yr
  hypersku:   'https://www.hypersku.com/register',
  eprolo:     'https://eprolo.com/',
  aliexpress: 'https://developers.aliexpress.com/',
  // 1688 has no direct foreign-facing signup of its own — points at the
  // marketplace itself as an informational link, not a real API-key
  // signup flow, same scaffolding-first treatment as AliExpress got
  // before its own App Key/Secret existed.
  '1688':     'https://www.1688.com/',
  printful:   'https://www.printful.com/dashboard/register',
  printify:   'https://printify.com/app/register',
  gelato:     'https://www.gelato.com/sign-up',
};

// "Open X" for an already-connected supplier must land on the real logged-in
// dashboard, not the signup page above — a signup/register URL 404s or loops
// once the seller already has an account (this is what Printful's
// dashboard/register link did after connecting).
export const DASHBOARD_LINKS: Record<string, string> = {
  cj:         'https://cjdropshipping.com/my-product',
  hypersku:   'https://www.hypersku.com/',
  eprolo:     'https://eprolo.com/app/home.html',
  aliexpress: 'https://developers.aliexpress.com/',
  '1688':     'https://www.1688.com/',
  printful:   'https://www.printful.com/dashboard',
  printify:   'https://printify.com/app/store',
  gelato:     'https://www.gelato.com/dashboard',
};

// Per-brand accent so the supplier grid reads at a glance instead of every
// card looking identical. CJ uses its real logo full-bleed (own background
// baked in); HyperSKU uses a cropped icon-only mark (its source file is a
// wide wordmark, cropped down to just the peak symbol) centered on our own
// tint, same treatment as AliExpress's lucide-icon fallback.
export const SUPPLIER_STYLE: Record<string, { icon: React.ElementType; color: string; bg: string; logo?: string; logoFit?: 'cover' | 'contain' }> = {
  cj:         { icon: Package,     color: 'text-orange-500', bg: 'bg-orange-500/10', logo: '/dropshipping/cj_logo.png',       logoFit: 'cover'   },
  hypersku:   { icon: Boxes,       color: 'text-teal-500',   bg: 'bg-teal-500/10',   logo: '/dropshipping/hypersku_icon.png', logoFit: 'contain' },
  eprolo:     { icon: Truck,       color: 'text-sky-500',    bg: 'bg-sky-500/10'   },
  aliexpress: { icon: ShoppingBag, color: 'text-red-500',    bg: 'bg-red-500/10'   },
  '1688':     { icon: Globe,       color: 'text-orange-600', bg: 'bg-orange-600/10' },
  printful:   { icon: Shirt,       color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  printify:   { icon: Palette,     color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10' },
  gelato:     { icon: Printer,     color: 'text-amber-500',  bg: 'bg-amber-500/10' },
};

// Genuinely-true, publicly-known facts about each platform (its home base,
// approximate catalog size, typical processing time, and where it ships) —
// informational copy, same spirit as the hand-written `description` field
// each supplier already carries. Deliberately NOT per-shop numbers — once a
// supplier is actually connected, the card shows the shop's real
// products/orders count (from /dropship/stats) instead of this.
export const SUPPLIER_META: Record<string, { country: string; categoryLabel: string; catalogSize: string; processingTime: string; shipsTo: string }> = {
  cj:         { country: 'China',   categoryLabel: 'Dropshipping & Fulfillment', catalogSize: '500,000+',   processingTime: '3–7 days',  shipsTo: 'US · UK · EU · Global' },
  hypersku:   { country: 'China',   categoryLabel: 'Dropshipping & Fulfillment', catalogSize: '1,000,000+', processingTime: '3–7 days',  shipsTo: 'US · UAE · Asia-Pacific' },
  eprolo:     { country: 'China',   categoryLabel: 'Dropshipping & Fulfillment', catalogSize: '100,000+',   processingTime: '3–7 days',  shipsTo: 'Global' },
  aliexpress: { country: 'China',   categoryLabel: 'Marketplace Supplier',       catalogSize: 'Millions',   processingTime: '7–15 days', shipsTo: 'Global' },
  '1688':     { country: 'China',   categoryLabel: 'Wholesale / Sourcing',       catalogSize: 'Millions',   processingTime: '7–15 days', shipsTo: 'Global (via freight forwarder)' },
  printful:   { country: 'USA/EU',  categoryLabel: 'Print-on-Demand',            catalogSize: '300+',       processingTime: '2–5 days',  shipsTo: 'US · EU · Global' },
  printify:   { country: 'Global',  categoryLabel: 'Print-on-Demand',            catalogSize: '900+',       processingTime: '2–7 days',  shipsTo: 'Global' },
  gelato:     { country: 'Global',  categoryLabel: 'Print-on-Demand',            catalogSize: '100+',       processingTime: '2–5 days',  shipsTo: 'Global (local printing)' },
};

export interface Supplier {
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

// ── HyperSKU Connect Modal ────────────────────────────────────────────────────
// Username+password, not a single API key — HyperSKU's "rapid integration"
// mode needs both, plus API access enabled on the seller's own account by
// their HyperSKU Account Manager first.

function HyperSKUConnectModal({ shopId, onConnected, onClose }: {
  shopId: string; onConnected: () => void; onClose: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await dropshipApi.connectHyperSKU(shopId, username, password);
      onConnected();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Connection failed. Check your username and password.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect HyperSKU</DialogTitle>
          <DialogDescription>Sign in with your HyperSKU account</DialogDescription>
        </DialogHeader>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
          )}
          <div>
            <Label className="mb-1.5 block">Username / Email *</Label>
            <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div>
            <Label className="mb-1.5 block">Password *</Label>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="Your HyperSKU password" className="pr-10" />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">
            HyperSKU needs API access enabled on your account first — ask your HyperSKU Account Manager to turn this on if connecting fails.
          </p>
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting...' : 'Connect HyperSKU'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have a HyperSKU account?{' '}
            <a href={SIGNUP_LINKS.hypersku} target="_blank" rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80">
              Create one free →
            </a>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── API Key Modal (Printify, Gelato, 1688, EPROLO) ──

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
//
// Redesigned to match the reference's structure (rounded avatar, category/
// country line, bordered stat block, ships-to row, two-button footer)
// while keeping every real behavior exactly as it was: connect (per-
// supplier modal or AliExpress OAuth redirect), disconnect, auto-fulfill
// toggle, plan-lock. Rating stars from the reference were dropped — no
// review/rating system exists anywhere in this codebase, so showing one
// would be fabricated; "✓ Verified" is used instead, tied to the real
// `connected` state.

export interface SupplierCardStat { products: number; orders: number }

export default function SupplierCard({ supplier, shopId, plan, onRefresh, stat }: {
  supplier: Supplier; shopId: string; plan: string; onRefresh: () => void; stat?: SupplierCardStat;
}) {
  const confirm = useConfirm();
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
    if (!(await confirm({ title: `Disconnect ${supplier.name}?`, description: 'Pending orders will not be affected.', variant: 'destructive' }))) return;
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
  const meta = SUPPLIER_META[supplier.supplier_type];
  const SupplierIcon = style.icon;
  const initials = supplier.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <Card className={
        supplier.locked ? 'opacity-60' :
        supplier.connected ? 'border-green-500/30 bg-green-500/[0.04]' :
        ''
      }>
        <CardContent className="p-5 flex flex-col gap-4">
          {/* Header: avatar + name + badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${
                supplier.locked ? 'bg-muted' : style.logo ? '' : 'bg-gradient-to-br from-slate-800 to-slate-600'
              }`}>
                {style.logo && !supplier.locked ? (
                  <Image src={style.logo} alt={supplier.name} width={44} height={44}
                    className={style.logoFit === 'contain' ? 'w-2/3 h-2/3 object-contain' : 'w-full h-full object-cover'} />
                ) : supplier.locked ? (
                  <SupplierIcon className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <span className="text-xs font-bold text-white">{initials}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-foreground text-sm truncate">{supplier.name}</p>
                  {supplier.connected && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                </div>
                {meta && <p className="text-[11px] text-muted-foreground truncate">{meta.country} · {meta.categoryLabel}</p>}
              </div>
            </div>
            <Badge variant={supplier.locked ? 'muted' : supplier.connected ? 'success' : 'default'} className="shrink-0">
              {supplier.locked ? 'Premium only' : supplier.connected ? 'Connected' : 'Available'}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">{supplier.description}</p>

          {/* Stat block — real per-shop counts once connected, informational catalog facts otherwise */}
          {meta && (
            <div className="grid grid-cols-2 gap-3 border-y border-border py-3.5">
              <div>
                <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                  <Package className="w-3 h-3" /> {supplier.connected ? 'Your products' : 'Catalog'}
                </div>
                <p className="mt-0.5 text-xs font-bold text-foreground">
                  {supplier.connected && stat ? stat.products.toLocaleString() : meta.catalogSize}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                  <Clock3 className="w-3 h-3" /> Processing
                </div>
                <p className="mt-0.5 text-xs font-bold text-foreground">{meta.processingTime}</p>
              </div>
            </div>
          )}

          {meta && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" /> Ships to {meta.shipsTo}
            </div>
          )}

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
              <Button asChild className="flex-1">
                <a href={DASHBOARD_LINKS[supplier.supplier_type] ?? supplier.signup_url} target="_blank" rel="noopener noreferrer">
                  Open {supplier.name} <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={disconnect} disabled={disconnecting} className="text-destructive hover:text-destructive">
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
      {showModal && supplier.supplier_type === 'hypersku' && (
        <HyperSKUConnectModal shopId={shopId}
          onConnected={() => { setShowModal(false); onRefresh(); }}
          onClose={() => setShowModal(false)} />
      )}
      {showModal && !['cj', 'printful', 'hypersku'].includes(supplier.supplier_type) && (
        <ApiKeyModal supplier={supplier} shopId={shopId}
          onConnected={() => { setShowModal(false); onRefresh(); }}
          onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
