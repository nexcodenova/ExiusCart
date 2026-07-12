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
  seller_status?: string | null;
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


// ── Daraz connect modal ───────────────────────────────────────────────────────

function DarazConnectModal({ shopId, onConnected, onClose }: {
  shopId: string; onConnected: () => void; onClose: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [appKey, setAppKey] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !appKey.trim() || !appSecret.trim()) return;
    setSaving(true); setError('');
    try {
      await channelsApi.connect(shopId, {
        channel_type: 'daraz',
        channel_api_key: `${appKey.trim()}|${appSecret.trim()}`,
        channel_api_url: 'https://api.daraz.lk',
        channel_seller_id: userId.trim(),
      });
      setDone(true);
      onConnected();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Connection failed. Check your credentials.');
    } finally { setSaving(false); }
  };

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl border border-border w-full max-w-md p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Daraz Connected!</p>
              <p className="text-xs text-muted-foreground">Orders from Daraz.lk will now sync to your dashboard automatically.</p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1.5">
            <p><strong className="text-foreground">What happens next:</strong></p>
            <p>• New Daraz orders appear in your Orders list tagged "Daraz"</p>
            <p>• Stock deducts automatically when orders come in</p>
            <p>• Mark as shipped in ExiusCart → Daraz updates too</p>
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
            <p className="font-semibold text-foreground">Connect Daraz</p>
            <p className="text-xs text-muted-foreground mt-0.5">Get credentials from open.daraz.com → My Apps</p>
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
            <label className="text-sm text-muted-foreground mb-1.5 block">Daraz Seller User ID *</label>
            <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} required
              placeholder="Your Daraz seller account user ID"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">App Key *</label>
            <input type="text" value={appKey} onChange={(e) => setAppKey(e.target.value)} required
              placeholder="App Key from Daraz Open Platform"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">App Secret *</label>
            <input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} required
              placeholder="App Secret from Daraz Open Platform"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
          </div>
          <div className="bg-muted/50 rounded-lg px-3 py-2.5 text-xs text-muted-foreground">
            Get these from <strong className="text-foreground">open.daraz.com</strong> → Register as Developer → Create App → Copy App Key & Secret.
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Connecting...' : 'Connect Daraz'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Daraz connected card ──────────────────────────────────────────────────────

function DarazCard({ connection }: { connection: ChannelConnection }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">Daraz</p>
            <p className="text-xs text-muted-foreground">Sri Lanka's #1 Marketplace</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3" /> Connected
        </span>
      </div>
      <div className="p-5 text-sm text-muted-foreground">
        <p>Seller ID: <strong className="text-foreground">{connection.channel_seller_id}</strong></p>
        <p className="mt-1 text-xs">Orders syncing from daraz.lk automatically</p>
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
  const isSuspended = connection.seller_status === 'suspended';
  const isRejected = connection.seller_status === 'rejected';
  const isRestricted = isSuspended || isRejected;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isRestricted ? 'bg-red-500/10' : 'bg-primary/10'}`}>
            <Link2 className={`w-4 h-4 ${isRestricted ? 'text-red-500' : 'text-primary'}`} />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">TheDersi</p>
            <p className="text-xs text-muted-foreground">Sri Lankan Fashion Marketplace</p>
          </div>
        </div>
        {isRestricted ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
            <X className="w-3 h-3" /> {isSuspended ? 'Suspended' : 'Not Approved'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        )}
      </div>

      {isRestricted && (
        <div className="mx-5 mt-5 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-lg">
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
            {isSuspended ? 'TheDersi channel suspended' : 'TheDersi account not approved'}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isSuspended
              ? 'New TheDersi orders are paused. Your POS and other channels continue to work. Please contact TheDersi support to resolve your account status.'
              : 'Your TheDersi seller application was not approved. New orders from TheDersi are paused. Contact TheDersi support for more information.'}
          </p>
        </div>
      )}

      <div className="p-5 space-y-4">
        <CopyBox label="Your ExiusCart Webhook URL" value={connection.webhook_url} />
        {!isRestricted && (
          <Link href="/dashboard/payout"
            className="flex items-center justify-center gap-2 w-full py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">
            View Payouts & Earnings →
          </Link>
        )}
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
      {ch.onAction && ch.badge !== 'soon' && ch.badge !== 'locked' && (
        <button type="button" onClick={ch.onAction}
          className="w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition flex items-center justify-center gap-1.5">
          {ch.actionLabel ?? 'Connect'} <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
      {ch.onAction && ch.badge === 'locked' && (
        <button type="button" onClick={ch.onAction}
          className="w-full py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition text-muted-foreground">
          {ch.actionLabel ?? 'Upgrade to Premium'}
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
  const [showDarazModal, setShowDarazModal] = useState(false);
  const [dersiBlockChannel, setDersiBlockChannel] = useState<string | null>(null);
  const [darazLocked, setDarazLocked] = useState(false);
  const [upgradeLimitModal, setUpgradeLimitModal] = useState(false);
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
  const darazConns = connections.filter((c) => c.channel_type === 'daraz');
  const hasTheDersi = theDersiConns.length > 0;
  const hasDaraz = darazConns.length > 0;
  const isTheDersiUser = plan.startsWith('thedersi');
  const isPremium = plan === 'premium';
  // Count Shopify separately since it's tracked via a different API
  const totalChannelCount = connections.length + (shopifyConnected ? 1 : 0);
  // Free trial + Starter = max 1 channel; Premium = unlimited
  const channelLimitReached = !isPremium && !isTheDersiUser && totalChannelCount >= 1;
  // Daraz: TheDersi Pro or Premium only
  const canUseDaraz = ['thedersi_pro', 'premium'].includes(plan);

  const availableChannels: ChannelDef[] = [
    {
      id: 'thedersi',
      name: 'TheDersi',
      description: "List products on Sri Lanka's #1 fashion marketplace. Orders sync automatically to your dashboard.",
      icon: <Link2 className="w-5 h-5 text-primary" />,
      badge: hasTheDersi ? 'live' : (channelLimitReached ? 'locked' : 'connect'),
      badgeLabel: hasTheDersi ? 'Connected' : (channelLimitReached ? 'Upgrade to Premium' : 'Available'),
      onAction: hasTheDersi ? undefined : (channelLimitReached ? () => setUpgradeLimitModal(true) : () => setShowTheDersiModal(true)),
      actionLabel: channelLimitReached ? 'Upgrade to Premium' : 'Connect TheDersi',
    },
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Sync your Shopify store — products, orders, and inventory stay in sync automatically.',
      icon: <ShoppingBag className="w-5 h-5 text-[#96BF48]" />,
      badge: shopifyConnected ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: shopifyConnected ? 'Connected' : (isTheDersiUser ? 'TheDersi managed' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: shopifyConnected
        ? undefined
        : isTheDersiUser
          ? () => setDersiBlockChannel('Shopify')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/shopify-integration'),
      actionLabel: shopifyConnected ? 'Manage Shopify' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Shopify')),
    },
    {
      id: 'custom_website',
      name: 'Custom Website',
      description: 'Connect any website using our API or webhook. Receive orders directly from your own storefront.',
      icon: <Globe className="w-5 h-5 text-sky-400" />,
      badge: isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect'),
      badgeLabel: isTheDersiUser ? 'TheDersi managed' : (channelLimitReached ? 'Upgrade to Premium' : 'Available'),
      onAction: isTheDersiUser
        ? () => setDersiBlockChannel('Custom Website')
        : channelLimitReached
          ? () => setUpgradeLimitModal(true)
          : () => setShowCustomWebsiteModal(true),
      actionLabel: isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Website'),
    },
    {
      id: 'daraz',
      name: 'Daraz',
      description: "Sri Lanka's #1 marketplace. Orders sync to ExiusCart automatically — manage everything from one dashboard.",
      icon: <ShoppingBag className="w-5 h-5 text-orange-500" />,
      badge: hasDaraz ? 'live' : canUseDaraz ? 'connect' : 'locked',
      badgeLabel: hasDaraz ? 'Connected' : canUseDaraz ? 'Available' : 'Paid plan required',
      onAction: hasDaraz ? undefined : canUseDaraz ? () => setShowDarazModal(true) : () => setDarazLocked(true),
      actionLabel: 'Connect Daraz',
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

      {/* Plan limit banner for free/starter users */}
      {!loading && !isTheDersiUser && !isPremium && plan !== '' && (
        <div className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border ${channelLimitReached ? 'bg-amber-500/8 border-amber-500/30' : 'bg-muted/60 border-border'}`}>
          <div>
            <p className={`text-sm font-semibold ${channelLimitReached ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
              {channelLimitReached ? '1 channel slot used — limit reached' : '1 channel slot available on your plan'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {channelLimitReached
                ? 'Upgrade to Premium to connect all channels — Shopify, Daraz, TheDersi, Noon & more.'
                : 'Free Trial & Starter plans include 1 channel. Upgrade to Premium for all channels.'}
            </p>
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
          <span className="text-sm">Loading channels...</span>
        </div>
      ) : (
        <>
          {/* Active connected channel cards */}
          {(theDersiConns.length > 0 || darazConns.length > 0) && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-foreground">Connected</h2>
              {theDersiConns.map((conn) => (
                <TheDersiCard key={conn.id} connection={conn} />
              ))}
              {darazConns.map((conn) => (
                <DarazCard key={conn.id} connection={conn} />
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

      {showDarazModal && (
        <DarazConnectModal
          shopId={shopId}
          onConnected={() => load()}
          onClose={() => { setShowDarazModal(false); load(); }}
        />
      )}

      {darazLocked && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5 text-orange-500" />
              </div>
              <button type="button" onClick={() => setDarazLocked(false)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-foreground">Daraz Integration</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {isTheDersiUser
                  ? 'Daraz sync is available on TheDersi Pro. Upgrade your TheDersi plan to connect your Daraz seller account.'
                  : 'Daraz sync is available on Premium plans. Upgrade to ExiusCart Premium to connect your Daraz seller account.'}
              </p>
            </div>
            <button type="button" onClick={() => setDarazLocked(false)}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
              Got it
            </button>
          </div>
        </div>
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
                Your plan is managed by TheDersi. To access more channels, upgrade your plan through TheDersi.
              </p>
            </div>
            <button type="button" onClick={() => setDersiBlockChannel(null)}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
              Got it
            </button>
          </div>
        </div>
      )}

      {upgradeLimitModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <button type="button" onClick={() => setUpgradeLimitModal(false)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-foreground">Channel limit reached</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Free Trial and Starter plans include <strong className="text-foreground">1 channel connection</strong>. You've already used your slot.
              </p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Upgrade to <strong className="text-foreground">Premium (99 AED/mo)</strong> to connect all channels — Shopify, Daraz, TheDersi, Noon & more.
              </p>
            </div>
            <Link href="/dashboard/billing" onClick={() => setUpgradeLimitModal(false)}
              className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition text-center">
              Upgrade to Premium
            </Link>
            <button type="button" onClick={() => setUpgradeLimitModal(false)}
              className="w-full py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition">
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
