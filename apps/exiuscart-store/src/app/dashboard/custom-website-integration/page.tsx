'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Globe, Loader2, CheckCircle2, FormInput, ArrowRight, CreditCard, Check, Coins, LayoutGrid, ListPlus, Code2, Copy, Wand2,
} from 'lucide-react';
import { channelsApi, paymentGatewayApi, shopApi } from '@/lib/api';
import { CopyBox } from '@/components/channels/CopyBox';

const API_BASE = 'https://api.exiuscart.com/api/v1';

// The only endpoints a Custom Website's own code ever needs to call —
// deliberately not the full `/docs` (which mixes in hundreds of internal
// seller-dashboard endpoints). Curated for the developer building the
// storefront, not the seller configuring ExiusCart.
const STOREFRONT_ENDPOINTS = (slug: string) => [
  { method: 'GET', path: `/public/store/${slug}/categories`, desc: 'Category tree' },
  { method: 'GET', path: `/public/store/${slug}/products`, desc: 'Product list — supports ?category=, ?featured=, ?trending=, ?search=' },
  { method: 'GET', path: `/public/store/${slug}/products/{slug}`, desc: 'Single product detail — includes rating, view count, units sold' },
  { method: 'GET', path: `/public/store/${slug}/products/{slug}/reviews`, desc: 'Approved reviews for one product' },
  { method: 'POST', path: `/public/store/${slug}/checkout`, desc: 'Create an order + get payment params' },
  { method: 'GET', path: `/public/store/${slug}/orders/{order_number}?email=`, desc: 'Guest order lookup' },
  { method: 'POST', path: `/public/store/${slug}/auth/signup`, desc: 'Create a customer account' },
  { method: 'POST', path: `/public/store/${slug}/auth/login`, desc: 'Log in, returns a token' },
  { method: 'GET', path: `/public/store/${slug}/wallet`, desc: 'Balance + history — needs the token from login' },
];

function DeveloperReferenceCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Code2 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">Developer Reference</p>
          <p className="text-xs text-muted-foreground">Hand this to whoever's building your website</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Base API URL</p>
            <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2">
              <code className="text-xs text-foreground flex-1 truncate">{API_BASE}</code>
              <button onClick={() => copy(API_BASE, 'base')} className="shrink-0 text-muted-foreground hover:text-foreground">
                {copied === 'base' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Your shop slug</p>
            <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2">
              <code className="text-xs text-foreground flex-1 truncate">{slug}</code>
              <button onClick={() => copy(slug, 'slug')} className="shrink-0 text-muted-foreground hover:text-foreground">
                {copied === 'slug' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground mb-1">Endpoints your website's code calls — no API key needed for any of these</p>
          {STOREFRONT_ENDPOINTS(slug).map((e) => {
            const full = `${API_BASE}${e.path}`;
            const key = e.method + e.path;
            return (
              <div key={key} className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${e.method === 'GET' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                  {e.method}
                </span>
                <div className="min-w-0 flex-1">
                  <code className="text-xs text-foreground block truncate">{full}</code>
                  <p className="text-[11px] text-muted-foreground truncate">{e.desc}</p>
                </div>
                <button onClick={() => copy(full, key)} className="shrink-0 text-muted-foreground hover:text-foreground">
                  {copied === key ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  webhook_url: string;
}

function QuickLinkCard({ href, icon, iconClass, title, description }: {
  href: string; icon: React.ReactNode; iconClass: string; title: string; description: string;
}) {
  return (
    <a href={href}
      className="flex flex-col gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition group">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
          {icon}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </a>
  );
}

export default function CustomWebsiteIntegrationPage() {
  const [shopId, setShopId] = useState('');
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [gateway, setGateway] = useState<{ configured: boolean; payment_gateway: string | null; merchant_id: string | null; webhook_url: string } | null>(null);
  const [selectedGateway, setSelectedGateway] = useState('payhere');
  const [merchantId, setMerchantId] = useState('');
  const [merchantSecret, setMerchantSecret] = useState('');
  const [savingGateway, setSavingGateway] = useState(false);
  const [gatewayError, setGatewayError] = useState('');
  const [gatewaySaved, setGatewaySaved] = useState(false);
  const [shopSlug, setShopSlug] = useState('');
  const [shopName, setShopName] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    Promise.all([
      channelsApi.getConnections(shopId).then((r) => {
        const conns: ChannelConnection[] = r.data ?? [];
        setConnection(conns.find((c) => c.channel_type === 'custom') ?? null);
      }),
      paymentGatewayApi.get(shopId).then((r) => {
        setGateway(r.data);
        if (r.data?.payment_gateway) setSelectedGateway(r.data.payment_gateway);
      }).catch(() => {}),
      shopApi.getMyShop().then((r) => { setShopSlug(r.data?.slug ?? ''); setShopName(r.data?.name ?? ''); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  // Credentials are stored in the same two generic columns for every
  // gateway (see checkout.py) — what changes is what to call them.
  const GATEWAY_LABELS: Record<string, { name: string; idLabel: string; idPlaceholder: string; secretLabel: string; secretPlaceholder: string }> = {
    payhere: { name: 'PayHere', idLabel: 'Merchant ID', idPlaceholder: 'Your PayHere Merchant ID', secretLabel: 'Merchant Secret', secretPlaceholder: 'Your PayHere Merchant Secret' },
    stripe: { name: 'Stripe', idLabel: 'Secret Key', idPlaceholder: 'sk_live_...', secretLabel: 'Webhook Signing Secret', secretPlaceholder: 'whsec_...' },
    paypal: { name: 'PayPal', idLabel: 'Client ID', idPlaceholder: 'Your PayPal Client ID', secretLabel: 'Client Secret', secretPlaceholder: 'Your PayPal Client Secret' },
  };
  const gatewayLabels = GATEWAY_LABELS[selectedGateway] ?? GATEWAY_LABELS.payhere;

  // Purely a convenience default — the key is never validated against
  // anything, so this doesn't need to be cryptographically random, just
  // unique enough that two sellers don't accidentally pick the same string.
  const generateApiKey = () => {
    const base = shopName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-store';
    const suffix = Math.random().toString(36).slice(2, 8);
    setApiKey(`${base}-${suffix}`);
  };

  useEffect(() => { load(); }, [shopId]);

  const saveGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantId.trim() || !merchantSecret.trim()) return;
    setSavingGateway(true); setGatewayError(''); setGatewaySaved(false);
    try {
      await paymentGatewayApi.set(shopId, { payment_gateway: selectedGateway, merchant_id: merchantId.trim(), merchant_secret: merchantSecret.trim() });
      setMerchantSecret('');
      setGatewaySaved(true);
      load();
    } catch (err: any) {
      setGatewayError(err?.response?.data?.detail ?? 'Could not save. Check your credentials and try again.');
    } finally {
      setSavingGateway(false);
    }
  };

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true); setError('');
    try {
      await channelsApi.connect(shopId, {
        channel_type: 'custom',
        channel_api_key: apiKey.trim(),
      });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Connection failed. Try again.');
    } finally { setSaving(false); }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await channelsApi.disconnectChannel(shopId, connection!.id);
      setConnection(null);
      setConfirming(false);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/dashboard/channels" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" /> Back to Channels
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-foreground">Custom Website Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect any website using our API or webhook. Receive orders directly from your own storefront.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : connection ? (
        <>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Custom Website</p>
                <p className="text-xs text-muted-foreground">Your own storefront</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>
          <div className="p-5 space-y-4">
            <CopyBox label="ExiusCart Order Webhook URL — use this in your website checkout" value={connection.webhook_url} />
            <div className="bg-muted/50 rounded-lg px-3 py-3 space-y-1.5 text-xs text-muted-foreground">
              <p><strong className="text-foreground">How it works:</strong></p>
              <p>When a customer places an order on your website, POST the order data to this URL. ExiusCart will create the order, update stock, and sync everything automatically.</p>
              <p>Your website must send the <strong className="text-foreground">X-Signature</strong> header and match the API key you connected with.</p>
            </div>
            <div className="pt-3 border-t border-border">
              {confirming ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">Disconnect this website? Orders will stop syncing here.</p>
                  <button onClick={disconnect} disabled={disconnecting}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition disabled:opacity-60">
                    {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
                  </button>
                  <button onClick={() => setConfirming(false)} disabled={disconnecting}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirming(true)} className="text-xs text-muted-foreground hover:text-destructive transition">
                  Disconnect Custom Website
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Payment Gateway</p>
                <p className="text-xs text-muted-foreground">Lets customers actually pay at checkout on your storefront</p>
              </div>
            </div>
            {gateway?.configured && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" /> Configured
              </span>
            )}
          </div>
          <form onSubmit={saveGateway} className="p-5 space-y-4">
            {gatewayError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{gatewayError}</div>
            )}
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Gateway</label>
              <select value={selectedGateway} onChange={(e) => setSelectedGateway(e.target.value)}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm">
                {Object.entries(GATEWAY_LABELS).map(([value, l]) => <option key={value} value={value}>{l.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">
                Switching gateways doesn't require any change to how your storefront calls checkout.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">{gatewayLabels.idLabel} *</label>
                <input type="text" value={merchantId} onChange={(e) => setMerchantId(e.target.value)}
                  placeholder={gateway?.payment_gateway === selectedGateway ? (gateway?.merchant_id || gatewayLabels.idPlaceholder) : gatewayLabels.idPlaceholder}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm font-mono" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">{gatewayLabels.secretLabel} *</label>
                <input type="password" value={merchantSecret} onChange={(e) => setMerchantSecret(e.target.value)}
                  placeholder={gateway?.configured && gateway?.payment_gateway === selectedGateway ? '••••••••  (saved)' : gatewayLabels.secretPlaceholder}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm font-mono" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Stored server-side only — never sent to your website's browser code.</p>
            {gateway?.webhook_url && (
              <CopyBox label="Notify URL — paste into your payment gateway's webhook/notify settings" value={gateway.webhook_url} />
            )}
            <button type="submit" disabled={savingGateway || !merchantId.trim() || !merchantSecret.trim()}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {savingGateway && <Loader2 className="w-4 h-4 animate-spin" />}
              {gatewaySaved && !savingGateway && <Check className="w-4 h-4" />}
              {savingGateway ? 'Saving...' : gatewaySaved ? 'Saved' : 'Save Payment Gateway'}
            </button>
          </form>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-3">More for this channel</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <QuickLinkCard
              href="/dashboard/signup-forms"
              icon={<FormInput className="w-4 h-4 text-primary" />}
              iconClass="bg-primary/10"
              title="Signup Forms"
              description="Newsletter or inquiry forms for your site — submissions land in Lead Management."
            />
            <QuickLinkCard
              href="/dashboard/wallet"
              icon={<Coins className="w-4 h-4 text-emerald-500" />}
              iconClass="bg-emerald-500/10"
              title="Wallet"
              description="Set your cashback % and see every customer's balance and activity."
            />
            <QuickLinkCard
              href="/dashboard/storefront-categories"
              icon={<LayoutGrid className="w-4 h-4 text-amber-500" />}
              iconClass="bg-amber-500/10"
              title="Storefront Categories"
              description="Build the category tree shoppers browse on your site."
            />
            <QuickLinkCard
              href="/dashboard/custom-website-fields"
              icon={<ListPlus className="w-4 h-4 text-violet-500" />}
              iconClass="bg-violet-500/10"
              title="Product Fields"
              description="Define your own extra product fields — quantity tiers, gift wrap, anything your site needs."
            />
          </div>
        </div>

        {/* Last on purpose — this is reference material for whoever's
            building the site, not a setup step, so it doesn't need to
            compete with the actual connection/payment steps above it. */}
        {shopSlug && <DeveloperReferenceCard slug={shopSlug} />}
        </>
      ) : (
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <p className="font-semibold text-foreground">Connect Custom Website</p>
            <p className="text-xs text-muted-foreground mt-0.5">Get an order webhook URL for your own storefront</p>
          </div>
          <form onSubmit={connect} className="p-5 space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">API Key *</label>
              <div className="flex items-center gap-2">
                <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
                  placeholder="Choose any secret key, e.g. mysite_secret_key_123"
                  className="flex-1 px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
                <button type="button" onClick={generateApiKey}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition">
                  <Wand2 className="w-3.5 h-3.5" /> Generate
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This is a shared secret between your website and ExiusCart. Choose any string — you'll use it when sending orders from your site. "Generate" makes one from your store name.
              </p>
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Connecting...' : 'Connect & Get Webhook URL'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
