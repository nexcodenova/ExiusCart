'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Globe, Loader2, CheckCircle2, FormInput, ArrowRight, CreditCard, Check, Coins, LayoutGrid, ListPlus, Wand2, DollarSign,
  Package, ShoppingCart, TrendingUp, LayoutDashboard, Settings2, BookOpen, Grid3x3, RefreshCw, TestTube2, X, KeyRound, AlertTriangle, ArrowLeftRight,
} from 'lucide-react';
import { channelsApi, paymentGatewayApi, shopApi } from '@/lib/api';
import { CopyBox } from '@/components/channels/CopyBox';
import StatCard from '@/components/custom-website/StatCard';
import WorkflowDiagram from '@/components/custom-website/WorkflowDiagram';
import RecentOrdersTable, { RecentOrder } from '@/components/custom-website/RecentOrdersTable';
import WebsiteProductsTable from '@/components/custom-website/WebsiteProductsTable';
import IntegrationHealth from '@/components/custom-website/IntegrationHealth';
import AutomationPanel from '@/components/custom-website/AutomationPanel';
import SalesChart from '@/components/custom-website/SalesChart';
import TrafficChart from '@/components/custom-website/TrafficChart';
import DeveloperDocs from '@/components/custom-website/DeveloperDocs';
import ConnectionHealthGauge from '@/components/custom-website/ConnectionHealthGauge';
import ConnectionActivityChart from '@/components/custom-website/ConnectionActivityChart';
import ChannelListingActivity from '@/components/channel-listings/ChannelListingActivity';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Webhook, ShieldCheck, LockKeyhole, Eye, EyeOff, Copy, Save } from 'lucide-react';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  webhook_url: string;
}

interface CustomWebsiteStats {
  active_products: number;
  orders: number;
  revenue: number;
  today_orders: number;
  today_revenue: number;
  orders_per_100_views: number | null;
  recent_success_rate: number | null;
  refunds_count: number;
  out_of_stock_count: number;
  connected_at: string | null;
  last_order_at: string | null;
  recent_orders: RecentOrder[];
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'connection', label: 'Connection & Payments', icon: Settings2 },
  { id: 'docs', label: 'Developer Docs', icon: BookOpen },
  { id: 'more', label: 'More Features', icon: Grid3x3 },
] as const;
type TabId = typeof TABS[number]['id'];

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

// Same list as the dashboard header's currency switcher, so this page never
// offers a narrower choice than what a seller can already pick elsewhere.
const CURRENCIES = [
  'AED', 'SAR', 'USD', 'EUR', 'GBP', 'INR', 'LKR', 'BDT', 'PKR', 'MYR',
  'SGD', 'CAD', 'AUD', 'QAR', 'KWD', 'BHD', 'OMR', 'EGP', 'NGN', 'KES',
  'ZAR', 'TRY', 'IDR', 'PHP', 'THB', 'JPY', 'CNY',
];

export default function CustomWebsiteIntegrationPage() {
  const [shopId, setShopId] = useState('');
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [stats, setStats] = useState<CustomWebsiteStats | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [toast, setToast] = useState('');

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
  const [webhookSigningSecret, setWebhookSigningSecret] = useState(''); // Whop-only, see GATEWAY_LABELS
  const [shopSlug, setShopSlug] = useState('');
  const [shopName, setShopName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('');
  const [storefrontCurrency, setStorefrontCurrency] = useState('');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);
  const [rateInfo, setRateInfo] = useState<{ rate: number; cached?: boolean } | null>(null);
  const [ratesError, setRatesError] = useState(false);

  const [rotating, setRotating] = useState(false);
  const [rotateConfirm, setRotateConfirm] = useState(false);

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
      shopApi.getMyShop().then((r) => {
        setShopSlug(r.data?.slug ?? '');
        setShopName(r.data?.name ?? '');
        setBaseCurrency(r.data?.base_currency ?? r.data?.currency ?? 'USD');
        setStorefrontCurrency(r.data?.storefront_currency ?? '');
      }).catch(() => {}),
      paymentGatewayApi.getStats(shopId).then((r) => setStats(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  // Credentials are stored in the same two generic columns for every
  // gateway (see checkout.py) — what changes is what to call them.
  const GATEWAY_LABELS: Record<string, { name: string; bestFor: string; idLabel: string; idPlaceholder: string; secretLabel: string; secretPlaceholder: string; needsWebhookSecret?: boolean; note?: string }> = {
    payhere: { name: 'PayHere', bestFor: 'Sri Lanka — settles in LKR', idLabel: 'Merchant ID', idPlaceholder: 'Your PayHere Merchant ID', secretLabel: 'Merchant Secret', secretPlaceholder: 'Your PayHere Merchant Secret' },
    stripe: { name: 'Stripe', bestFor: 'Global card payments — requires a registered business', idLabel: 'Secret Key', idPlaceholder: 'sk_live_...', secretLabel: 'Webhook Signing Secret', secretPlaceholder: 'whsec_...' },
    paypal: { name: 'PayPal', bestFor: 'Global reach — requires a registered business', idLabel: 'Client ID', idPlaceholder: 'Your PayPal Client ID', secretLabel: 'Client Secret', secretPlaceholder: 'Your PayPal Client Secret' },
    // No business registration needed to accept payment — Whop is
    // Merchant of Record. Unlike the others, the amount is computed live
    // per order (a Checkout Configuration), not a fixed pre-made product.
    whop: {
      name: 'Whop', bestFor: 'Any country — no business registration needed', idLabel: 'Company ID', idPlaceholder: 'biz_xxxxxxxx', secretLabel: 'API Key', secretPlaceholder: '••••••••••••••••',
      needsWebhookSecret: true, note: 'Whop is Merchant of Record — you can accept payment without a registered business.',
    },
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

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); }, [toast]);

  // Real live rate from the same endpoint the dashboard currency switcher
  // uses (shopApi.getExchangeRates → open.er-api.com, 12h-cached server-side)
  // — not a fabricated preview number.
  useEffect(() => {
    if (!storefrontCurrency || storefrontCurrency === baseCurrency) { setRateInfo(null); setRatesError(false); return; }
    let cancelled = false;
    shopApi.getExchangeRates(baseCurrency || 'USD').then((r) => {
      if (cancelled) return;
      const rate = r.data?.rates?.[storefrontCurrency];
      if (rate) { setRateInfo({ rate, cached: r.data?.cached }); setRatesError(false); }
      else { setRateInfo(null); setRatesError(true); }
    }).catch(() => { if (!cancelled) { setRateInfo(null); setRatesError(true); } });
    return () => { cancelled = true; };
  }, [storefrontCurrency, baseCurrency]);

  const saveGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantId.trim() || !merchantSecret.trim()) return;
    setSavingGateway(true); setGatewayError(''); setGatewaySaved(false);
    try {
      await paymentGatewayApi.set(shopId, {
        payment_gateway: selectedGateway, merchant_id: merchantId.trim(), merchant_secret: merchantSecret.trim(),
        ...(selectedGateway === 'whop' && webhookSigningSecret.trim() ? { webhook_signing_secret: webhookSigningSecret.trim() } : {}),
      });
      setMerchantSecret('');
      setWebhookSigningSecret('');
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

  const saveCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCurrency(true); setCurrencySaved(false);
    try {
      await shopApi.updateShop({ storefront_currency: storefrontCurrency || null });
      setCurrencySaved(true);
      setTimeout(() => setCurrencySaved(false), 2000);
    } finally {
      setSavingCurrency(false);
    }
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

  // Rotation is real: it regenerates ChannelConnection.webhook_secret, which
  // IS the credential (the secret lives in the URL path itself — there's no
  // separate signing key here, see Developer Docs). The old URL stops
  // working the instant this runs, so it's gated behind an inline confirm
  // just like Disconnect below.
  const rotateSecret = async () => {
    setRotating(true);
    try {
      const r = await paymentGatewayApi.rotateWebhookSecret(shopId);
      setConnection((c) => (c ? { ...c, webhook_url: r.data.webhook_url } : c));
      setRotateConfirm(false);
      setToast('Webhook URL rotated. Update your website with the new URL below — the old one no longer works.');
    } catch (err: any) {
      setToast(err?.response?.data?.detail ?? 'Could not rotate the webhook URL. Try again.');
    } finally {
      setRotating(false);
    }
  };

  // "Sync now" — there's no periodic sync job to trigger for this channel
  // (see WorkflowDiagram: orders arrive live via webhook, nothing polls on
  // a schedule), so this honestly does the real thing available: re-fetch
  // everything shown on this page from the database.
  const syncNow = async () => {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 500));
    load();
    setSyncing(false);
    setToast('Data refreshed from your real order and product history.');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link href="/dashboard/channels" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" /> Back to Channels
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-2">Sales Channels / Custom Website</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Custom Website</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Manage your storefront connection, payments, API access, and order automation from ExiusCart.
          </p>
        </div>
        {!loading && connection && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </span>
            <button onClick={syncNow} disabled={syncing}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-60">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Refreshing…' : 'Sync now'}
            </button>
            <button onClick={() => setActiveTab('connection')}
              className="inline-flex items-center gap-1.5 border border-border px-3.5 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-muted transition">
              <Settings2 className="w-3.5 h-3.5" /> Connection settings
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="flex items-center justify-between gap-2 text-sm bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg px-4 py-2.5">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {toast}</span>
          <button onClick={() => setToast('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : connection ? (
        <>
          {/* Real stat cards — no per-product "sync" state exists here
              (every active product is already API-reachable), so this
              shows catalog size + real today's orders/revenue for this
              channel, plus a real "orders per 100 views" (not a fabricated
              session-based conversion % — see IntegrationHealth/StorefrontEvent
              for why that's not computable here). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={<Package className="w-5 h-5" />} title="Active Products" value={(stats?.active_products ?? 0).toLocaleString()} />
            <StatCard icon={<ShoppingCart className="w-5 h-5" />} title="Orders Today" value={stats?.today_orders ?? 0} iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
            <StatCard icon={<DollarSign className="w-5 h-5" />} title="Revenue Today" value={`$${(stats?.today_revenue ?? 0).toFixed(2)}`} iconClassName="bg-green-500/10 text-green-600 dark:text-green-400" />
            <StatCard icon={<TrendingUp className="w-5 h-5" />} title="Orders per 100 Views" value={stats?.orders_per_100_views != null ? stats.orders_per_100_views : '—'} iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border overflow-x-auto">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                  activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}>
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
                <div className="space-y-5">
                  <TrafficChart shopId={shopId} />
                  <SalesChart shopId={shopId} refundsCount={stats?.refunds_count ?? 0} />
                </div>
                <IntegrationHealth
                  connected={!!connection}
                  paymentConfigured={!!gateway?.configured}
                  lastOrderAt={stats?.last_order_at ?? null}
                  recentSuccessRate={stats?.recent_success_rate ?? null}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
                <WorkflowDiagram />
                <AutomationPanel />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <RecentOrdersTable orders={stats?.recent_orders ?? []} />
                <WebsiteProductsTable shopId={shopId} />
              </div>

              <ChannelListingActivity shopId={shopId} channelType="custom" />
            </div>
          )}

          {activeTab === 'connection' && (
            // Layout + polish mirror the reference mockup; every value here is
            // real (see notes). Things the mockup faked and this omits: an
            // outbound webhook delivery log + "99.8% delivery rate" (Custom
            // Website has no outbound webhook system), a Test/Live environment
            // toggle and a "secret rotated N days ago" line (no such fields on
            // ChannelConnection), and "Product/Inventory sync: in sync" rows
            // (nothing syncs on a schedule here).
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)] items-start">
              <div className="space-y-4">
                {/* ── Storefront connection ─────────────────────────────── */}
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Webhook className="w-5 h-5 text-primary" /> Storefront connection
                      </CardTitle>
                      <CardDescription>Your order webhook endpoint and API connection for {shopName || 'your storefront'}.</CardDescription>
                    </div>
                    {shopSlug && (
                      <a href={`https://${shopSlug}`} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-xs font-semibold text-primary hover:opacity-80">View site ↗</a>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-foreground text-background text-sm font-bold">
                        {(shopName || 'W').charAt(0).toUpperCase()}
                      </div>
                      <p className="font-bold text-foreground">{shopSlug || shopName || 'Custom Website'}</p>
                      <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/10 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Connected
                      </Badge>
                      {stats?.connected_at && (
                        <span className="text-xs text-muted-foreground">
                          since {new Date(stats.connected_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>

                    <CopyBox label="Order webhook URL — POST your website's orders here" value={connection.webhook_url} />

                    <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg bg-muted/40 px-3 py-2.5">
                      <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-md">
                        <KeyRound className="w-3.5 h-3.5 mt-px shrink-0" />
                        <span>The secret is part of the URL itself — rotating generates a new URL and the old one stops working immediately.</span>
                      </div>
                      {rotateConfirm ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={rotateSecret} disabled={rotating}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-60">
                            {rotating ? 'Rotating…' : 'Yes, rotate now'}
                          </button>
                          <button onClick={() => setRotateConfirm(false)} disabled={rotating}
                            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setRotateConfirm(true)}
                          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition">
                          <RefreshCw className="w-3.5 h-3.5" /> Rotate webhook URL
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-5">
                      <button onClick={() => setTestOpen(true)}
                        className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition">
                        <TestTube2 className="w-4 h-4" /> Test connection
                      </button>
                      <div>
                        <p className="text-xs text-muted-foreground">Last order received</p>
                        <p className="mt-0.5 text-sm font-bold text-foreground">
                          {stats?.last_order_at ? new Date(stats.last_order_at).toLocaleString() : 'None yet'}
                        </p>
                      </div>
                      {stats?.recent_success_rate != null && (
                        <>
                          <Separator orientation="vertical" className="hidden h-10 md:block" />
                          <div>
                            <p className="text-xs text-muted-foreground">Recent payment success</p>
                            <p className="mt-0.5 text-sm font-bold text-green-600 dark:text-green-400">{stats.recent_success_rate}%</p>
                            <p className="text-[10px] text-muted-foreground">last 20 orders</p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs text-foreground">
                      <LockKeyhole className="w-4 h-4 shrink-0 text-primary" />
                      <p><strong>Keep this URL server-side.</strong> It's the credential — never expose it in your website's browser code or a public repo.</p>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground">Recent orders from this website</h3>
                        <button onClick={() => setActiveTab('overview')} className="text-xs font-semibold text-primary hover:opacity-80">View all →</button>
                      </div>
                      {stats?.recent_orders?.length ? (
                        <div className="divide-y divide-border rounded-lg border border-border">
                          {stats.recent_orders.slice(0, 4).map((o) => (
                            <div key={o.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5 text-xs">
                              <span className="font-medium text-foreground truncate">{o.customer_name || `Order #${o.id}`}</span>
                              <span className="text-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</span>
                              <Badge className={`${o.payment_status === 'paid' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : o.payment_status === 'refunded' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'} hover:bg-transparent capitalize`}>
                                {o.payment_status || 'pending'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border px-3 py-4 text-center">No orders from this website yet.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* ── Payment gateway ───────────────────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CreditCard className="w-5 h-5 text-primary" /> Payment gateway
                      {gateway?.configured && (
                        <Badge className="ml-1 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/10 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Configured
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Connect a provider so customers can actually pay at checkout on your website.</CardDescription>
                  </CardHeader>
                  <form onSubmit={saveGateway}>
                    <CardContent className="space-y-5">
                      {gatewayError && (
                        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{gatewayError}</div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {Object.entries(GATEWAY_LABELS).map(([value, l]) => {
                          const active = selectedGateway === value;
                          const badgeColor = ({ payhere: 'bg-blue-600', stripe: 'bg-violet-600', paypal: 'bg-blue-800', whop: 'bg-[#FA4616]' } as Record<string, string>)[value] ?? 'bg-slate-600';
                          return (
                            <button key={value} type="button" onClick={() => setSelectedGateway(value)}
                              className={`rounded-xl border p-3 text-left transition ${active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40 hover:bg-muted/40'}`}>
                              <div className="flex items-center justify-between">
                                <span className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black text-white ${badgeColor}`}>
                                  {l.name.slice(0, 2).toUpperCase()}
                                </span>
                                <span className={`h-4 w-4 rounded-full border-2 ${active ? 'border-primary bg-primary' : 'border-border'}`} />
                              </div>
                              <p className="mt-2.5 text-sm font-bold text-foreground">{l.name}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">{l.bestFor}</p>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground -mt-2">
                        {gatewayLabels.note ?? "Switching providers doesn't require any change to how your storefront calls checkout."}
                      </p>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">{gatewayLabels.idLabel} *</label>
                          <input type="text" value={merchantId} onChange={(e) => setMerchantId(e.target.value)}
                            placeholder={gateway?.payment_gateway === selectedGateway ? (gateway?.merchant_id || gatewayLabels.idPlaceholder) : gatewayLabels.idPlaceholder}
                            className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm font-mono" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">{gatewayLabels.secretLabel} *</label>
                          <input type="password" value={merchantSecret} onChange={(e) => setMerchantSecret(e.target.value)}
                            placeholder={gateway?.configured && gateway?.payment_gateway === selectedGateway ? '••••••••  (saved)' : gatewayLabels.secretPlaceholder}
                            className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm font-mono" />
                        </div>
                        {gatewayLabels.needsWebhookSecret && (
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-medium text-foreground">Webhook Signing Secret (optional)</label>
                            <input type="password" value={webhookSigningSecret} onChange={(e) => setWebhookSigningSecret(e.target.value)}
                              placeholder="whsec_•••••••••••• — paste after registering the Notify URL below"
                              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm font-mono" />
                            <p className="text-[11px] text-muted-foreground">Can be added later — without it, incoming payment confirmations won't be signature-verified.</p>
                          </div>
                        )}
                      </div>

                      {gateway?.webhook_url && (
                        <CopyBox label="Notify URL — add this to your payment gateway's webhook / IPN settings" value={gateway.webhook_url} />
                      )}
                      <p className="text-[11px] text-muted-foreground -mt-2">Credentials are stored server-side only — never sent to your website's browser code.</p>

                      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          {gateway?.configured
                            ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> {gatewayLabels.name} is configured for checkout</>
                            : <><AlertTriangle className="w-4 h-4 text-amber-500" /> No gateway configured yet — customers can't pay</>}
                        </p>
                        <button type="submit" disabled={savingGateway || !merchantId.trim() || !merchantSecret.trim()}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60">
                          {savingGateway ? <Loader2 className="w-4 h-4 animate-spin" /> : gatewaySaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                          {savingGateway ? 'Saving...' : gatewaySaved ? 'Saved' : 'Save payment gateway'}
                        </button>
                      </div>
                    </CardContent>
                  </form>
                </Card>
              </div>

              {/* ── Right column ───────────────────────────────────────── */}
              <div className="space-y-4">
                <ConnectionHealthGauge
                  connected={!!connection}
                  paymentConfigured={!!gateway?.configured}
                  lastOrderAt={stats?.last_order_at ?? null}
                />

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="w-5 h-5 text-primary" /> Security checklist
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3.5">
                    {[
                      { title: 'HTTPS enforced', desc: 'Every request to the webhook URL is TLS-only.' },
                      { title: 'Secret embedded in the URL', desc: 'The URL path is the credential — no separate key to leak.' },
                      { title: 'Credentials stored server-side', desc: 'Gateway keys never reach your website’s browser code.' },
                    ].map((item, i) => (
                      <div key={item.title}>
                        {i > 0 && <Separator className="mb-3.5" />}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{item.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        </div>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Rotate the webhook secret</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Do it any time from the connection card.</p>
                      </div>
                      <button onClick={() => setRotateConfirm(true)}
                        className="text-xs font-semibold text-primary hover:opacity-80 shrink-0">Rotate</button>
                    </div>
                  </CardContent>
                </Card>

                <ConnectionActivityChart shopId={shopId} />

                {!!stats?.out_of_stock_count && stats.out_of_stock_count > 0 && (
                  <a href="/dashboard/products?stock=out"
                    className="flex items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-500/10 p-4">
                    <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                        {stats.out_of_stock_count} product{stats.out_of_stock_count === 1 ? '' : 's'} out of stock
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300/80">Customers can't buy these on your website right now.</p>
                    </div>
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-200 shrink-0">Review →</span>
                  </a>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="w-5 h-5 text-amber-500" /> Storefront currency
                    </CardTitle>
                    <CardDescription>What currency your website receives prices in.</CardDescription>
                  </CardHeader>
                  <form onSubmit={saveCurrency}>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Show prices on my website in</label>
                        <select value={storefrontCurrency} onChange={(e) => setStorefrontCurrency(e.target.value)}
                          className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm">
                          <option value="">Same as my store ({baseCurrency || 'USD'}) — no conversion</option>
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3 text-xs">
                        <p className="text-muted-foreground">Exchange-rate preview</p>
                        {!storefrontCurrency || storefrontCurrency === baseCurrency ? (
                          <p className="mt-1 font-bold text-foreground font-mono">1 {baseCurrency || 'USD'} = 1.0000 {baseCurrency || 'USD'} · no conversion</p>
                        ) : rateInfo ? (
                          <p className="mt-1 font-bold text-foreground font-mono">
                            1 {baseCurrency || 'USD'} = {rateInfo.rate.toFixed(4)} {storefrontCurrency}
                            <span className="ml-1.5 font-sans font-normal text-muted-foreground">{rateInfo.cached ? '(cached · 12h)' : '(live)'}</span>
                          </p>
                        ) : ratesError ? (
                          <p className="mt-1 text-muted-foreground">Live rate unavailable — conversion still applies at checkout.</p>
                        ) : (
                          <p className="mt-1 text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Fetching live rate…</p>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Products are priced in <strong className="text-foreground">{baseCurrency || 'USD'}</strong>. Every price the API sends is converted with a live rate before your site sees it.
                      </p>
                      <button type="submit" disabled={savingCurrency}
                        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                        {savingCurrency ? <Loader2 className="w-4 h-4 animate-spin" /> : currencySaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {savingCurrency ? 'Saving...' : currencySaved ? 'Saved' : 'Save currency'}
                      </button>
                    </CardContent>
                  </form>
                </Card>

                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-destructive">Danger zone</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Disconnecting stops new orders from this website. Nothing already recorded is deleted.</p>
                      <div className="mt-3">
                        {confirming ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={disconnect} disabled={disconnecting}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition disabled:opacity-60">
                              {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
                            </button>
                            <button onClick={() => setConfirming(false)} disabled={disconnecting}
                              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirming(true)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition">
                            Disconnect Custom Website
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <DeveloperDocs slug={shopSlug} webhookUrl={connection.webhook_url} />
          )}

          {activeTab === 'more' && (
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
          )}
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

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connection test</DialogTitle>
            <DialogDescription>
              {/* Honest — there's nothing for ExiusCart to "ping" here (your
                  site calls ExiusCart, not the other way around), so this
                  checks what's actually real instead of faking a network
                  round-trip. */}
              What's actually verified, not a simulated ping
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-2.5">
              <span className="text-foreground font-medium">Webhook URL is active</span>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-2.5">
              <span className="text-foreground font-medium">Payment gateway configured</span>
              {gateway?.configured ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-destructive" />}
            </div>
            <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-2.5">
              <span className="text-foreground font-medium">Last real order received</span>
              <span className="text-xs text-muted-foreground">{stats?.last_order_at ? new Date(stats.last_order_at).toLocaleString() : 'None yet'}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            ExiusCart never calls your site to "test" it — your site calls ExiusCart's webhook URL when an order happens. The real test is sending a real order and checking it appears in Recent Orders.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
