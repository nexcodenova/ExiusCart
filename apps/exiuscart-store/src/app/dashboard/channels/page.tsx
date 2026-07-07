'use client';

import { useState, useEffect } from 'react';
import {
  Link2, Loader2, CheckCircle2,
  Copy, Check, X, ExternalLink,
  ShoppingBag, Globe, ShoppingCart, Package, Instagram, Tag, Music2,
} from 'lucide-react';
import { channelsApi, shopifyApi, subscriptionApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  channel_seller_id?: string;
  webhook_url: string;
}

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-xs text-foreground break-all font-mono">
          {value}
        </code>
        <button type="button" onClick={copy}
          className="shrink-0 p-2 rounded-lg border border-border hover:bg-muted transition" title="Copy">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

// ── Custom Website connect modal ──────────────────────────────────────────────

function CustomWebsiteModal({ shopId, onConnected, onClose }: {
  shopId: string; onConnected: () => void; onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true); setError('');
    try {
      const r = await channelsApi.connect(shopId, {
        channel_type: 'custom',
        channel_api_key: apiKey.trim(),
      });
      const url = r.data?.webhook_url ?? '';
      setWebhookUrl(url);
      onConnected();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Connection failed. Try again.');
    } finally { setSaving(false); }
  };

  if (webhookUrl) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl border border-border w-full max-w-md p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Custom Website Connected!</p>
              <p className="text-xs text-muted-foreground">Use this webhook URL in your website's checkout</p>
            </div>
          </div>
          <CopyBox label="ExiusCart Order Webhook URL — add this to your website checkout" value={webhookUrl} />
          <div className="bg-muted/50 rounded-lg px-3 py-3 space-y-1.5 text-xs text-muted-foreground">
            <p><strong className="text-foreground">How it works:</strong></p>
            <p>When a customer places an order on your website, POST the order data to this URL. ExiusCart will create the order, update stock, and sync everything automatically.</p>
            <p>Your website must send the <strong className="text-foreground">X-Signature</strong> header and match the API key you just set.</p>
          </div>
          <button onClick={onClose}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="font-semibold text-foreground">Connect Custom Website</p>
            <p className="text-xs text-muted-foreground mt-0.5">Get an order webhook URL for your own storefront</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">API Key *</label>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
              placeholder="Choose any secret key, e.g. mysite_secret_key_123"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
            <p className="text-xs text-muted-foreground mt-1">
              This is a shared secret between your website and ExiusCart. Choose any string — you'll use it when sending orders from your site.
            </p>
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting...' : 'Connect & Get Webhook URL'}
          </button>
        </form>
      </div>
    </div>
  );
}


// ── TheDersi connect modal ────────────────────────────────────────────────────

function TheDersiConnectModal({ shopId, onConnected, onClose }: {
  shopId: string; onConnected: () => void; onClose: () => void;
}) {
  const [sellerId, setSellerId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerId.trim() || !apiKey.trim()) return;
    setSaving(true);
    setError('');
    try {
      const r = await channelsApi.connect(shopId, {
        channel_type: 'thedersi',
        channel_api_key: apiKey.trim(),
        channel_api_url: 'https://thedersi.lk/api/v1',
        channel_seller_id: sellerId.trim(),
      });
      const secret = r.data?.webhook_secret;
      if (secret) setWebhookUrl(`https://api.exiuscart.com/api/v1/channels/webhook/${secret}`);
      onConnected();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Connection failed. Check your Seller ID and API Key.');
    } finally {
      setSaving(false);
    }
  };

  if (webhookUrl) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl border border-border w-full max-w-md p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">TheDersi Connected!</p>
              <p className="text-xs text-muted-foreground">Copy your webhook URL and paste it into TheDersi</p>
            </div>
          </div>
          <CopyBox label="ExiusCart Webhook URL — paste into thedersi.lk/seller/connect" value={webhookUrl} />
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            Go to <strong>thedersi.lk/seller/connect</strong>, paste this URL in the "ExiusCart Webhook URL" field and save.
          </p>
          <button onClick={onClose}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="font-semibold text-foreground">Connect TheDersi</p>
            <p className="text-xs text-muted-foreground mt-0.5">Get credentials from thedersi.lk/seller/connect</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={connect} className="p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">TheDersi Seller ID *</label>
            <input type="text" value={sellerId} onChange={(e) => setSellerId(e.target.value)} required
              placeholder="e.g. seller_abc123"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">TheDersi API Key *</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
              placeholder="Paste your API key from TheDersi"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
          </div>
          <p className="text-xs text-muted-foreground">
            Find these at <strong>thedersi.lk/seller/connect</strong> under API Credentials.
          </p>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting...' : 'Connect TheDersi'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── TheDersi connected card ───────────────────────────────────────────────────

function TheDersiCard({ connection }: { connection: ChannelConnection }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">TheDersi</p>
            <p className="text-xs text-muted-foreground">Sri Lankan Fashion Marketplace</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3" /> Connected
        </span>
      </div>
      <div className="p-5 space-y-4">
        <CopyBox label="Your ExiusCart Webhook URL" value={connection.webhook_url} />
        <Link href="/dashboard/payout"
          className="flex items-center justify-center gap-2 w-full py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">
          View Payouts & Earnings →
        </Link>
      </div>
    </div>
  );
}

// ── Channel tile for available-but-not-connected channels ─────────────────────

interface ChannelDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  badge: 'live' | 'connect' | 'soon' | 'locked';
  badgeLabel?: string;
  onAction?: () => void;
  actionLabel?: string;
}

function ChannelTile({ ch }: { ch: ChannelDef }) {
  const badgeStyles: Record<string, string> = {
    live: 'bg-green-500/10 text-green-500',
    connect: 'bg-primary/10 text-primary',
    soon: 'bg-muted text-muted-foreground',
    locked: 'bg-muted/80 text-muted-foreground/70',
  };
  const badgeLabels: Record<string, string> = {
    live: 'Live',
    connect: 'Available',
    soon: 'Coming Soon',
    locked: 'Not on your plan',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          {ch.icon}
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${badgeStyles[ch.badge]}`}>
          {ch.badgeLabel ?? badgeLabels[ch.badge]}
        </span>
      </div>
      <div className="flex-1">
        <p className="font-semibold text-foreground text-sm">{ch.name}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ch.description}</p>
      </div>
      {ch.onAction && ch.badge !== 'soon' && (
        <button type="button" onClick={ch.onAction}
          className="w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition flex items-center justify-center gap-1.5">
          {ch.actionLabel ?? 'Connect'} <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
      {ch.onAction && ch.badge === 'soon' && (
        <button type="button" onClick={ch.onAction}
          className="w-full py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition text-muted-foreground">
          Learn more
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTheDersiModal, setShowTheDersiModal] = useState(false);
  const [showCustomWebsiteModal, setShowCustomWebsiteModal] = useState(false);
  const [dersiBlockChannel, setDersiBlockChannel] = useState<string | null>(null);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [plan, setPlan] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    subscriptionApi.getCurrent(shopId)
      .then((r) => setPlan(r.data?.plan?.plan_type || ''))
      .catch(() => {});
  }, [shopId]);

  const load = () => {
    if (!shopId) return;
    Promise.all([
      channelsApi.getConnections(shopId).then((r) => setConnections(r.data ?? [])),
      shopifyApi.getStatus(shopId).then((r) => setShopifyConnected(r.data?.connected ?? false)).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const theDersiConns = connections.filter((c) => c.channel_type === 'thedersi');
  const hasTheDersi = theDersiConns.length > 0;
  const isTheDersiUser = plan.startsWith('thedersi');

  const availableChannels: ChannelDef[] = [
    {
      id: 'thedersi',
      name: 'TheDersi',
      description: "List products on Sri Lanka's #1 fashion marketplace. Orders sync automatically to your dashboard.",
      icon: <Link2 className="w-5 h-5 text-primary" />,
      badge: hasTheDersi ? 'live' : 'connect',
      badgeLabel: hasTheDersi ? 'Connected' : 'Available',
      onAction: hasTheDersi ? undefined : () => setShowTheDersiModal(true),
      actionLabel: 'Connect TheDersi',
    },
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Sync your Shopify store — products, orders, and inventory stay in sync automatically.',
      icon: <ShoppingBag className="w-5 h-5 text-[#96BF48]" />,
      badge: shopifyConnected ? 'live' : 'connect',
      badgeLabel: shopifyConnected ? 'Connected' : 'Available',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Shopify') : () => router.push('/dashboard/shopify-integration'),
      actionLabel: shopifyConnected ? 'Manage Shopify' : 'Connect Shopify',
    },
    {
      id: 'custom_website',
      name: 'Custom Website',
      description: 'Connect any website using our API or webhook. Receive orders directly from your own storefront.',
      icon: <Globe className="w-5 h-5 text-sky-400" />,
      badge: 'connect',
      badgeLabel: 'Available',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Custom Website') : () => setShowCustomWebsiteModal(true),
      actionLabel: 'Connect Website',
    },
    {
      id: 'tiktok',
      name: 'TikTok Shop',
      description: 'Sell directly on TikTok. Orders sync to ExiusCart, stock stays in sync automatically.',
      icon: <Music2 className="w-5 h-5 text-[#010101] dark:text-white" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('TikTok Shop') : undefined,
    },
    {
      id: 'ebay',
      name: 'eBay',
      description: 'List products on eBay and manage all orders directly from ExiusCart.',
      icon: <Tag className="w-5 h-5 text-[#E53238]" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('eBay') : undefined,
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      description: 'WordPress + WooCommerce integration. Install the ExiusCart plugin to sync products and orders.',
      icon: <ShoppingCart className="w-5 h-5 text-[#7F54B3]" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('WooCommerce') : undefined,
    },
    {
      id: 'amazon',
      name: 'Amazon',
      description: 'List and manage your Amazon products and orders through ExiusCart.',
      icon: <Package className="w-5 h-5 text-orange-400" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Amazon') : undefined,
    },
    {
      id: 'instagram',
      name: 'Instagram Shopping',
      description: 'Tag products in your Instagram posts and stories. Orders sync to ExiusCart.',
      icon: <Instagram className="w-5 h-5 text-pink-400" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Instagram Shopping') : undefined,
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sales Channels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect marketplaces and storefronts to sell everywhere from one dashboard.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading channels...</span>
        </div>
      ) : (
        <>
          {/* Active TheDersi connections — show full card with earnings */}
          {theDersiConns.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-foreground">Connected</h2>
              {theDersiConns.map((conn) => (
                <TheDersiCard key={conn.id} connection={conn} />
              ))}
            </div>
          )}

          {/* All channels grid */}
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-foreground">All Channels</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableChannels.map((ch) => (
                <ChannelTile key={ch.id} ch={ch} />
              ))}
            </div>
          </div>
        </>
      )}

      {showTheDersiModal && (
        <TheDersiConnectModal
          shopId={shopId}
          onConnected={() => load()}
          onClose={() => { setShowTheDersiModal(false); load(); }}
        />
      )}

      {showCustomWebsiteModal && (
        <CustomWebsiteModal
          shopId={shopId}
          onConnected={() => load()}
          onClose={() => { setShowCustomWebsiteModal(false); load(); }}
        />
      )}

      {dersiBlockChannel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <button type="button" onClick={() => setDersiBlockChannel(null)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-foreground">{dersiBlockChannel}</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                This channel is available for <strong>ExiusCart direct sellers</strong> only.
              </p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                As a <strong>TheDersi seller</strong>, your store is already connected through TheDersi. All your orders, stock, and payouts sync through that channel — no additional setup needed.
              </p>
            </div>
            <button type="button" onClick={() => setDersiBlockChannel(null)}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
