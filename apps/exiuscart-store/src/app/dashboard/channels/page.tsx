'use client';

import { useState, useEffect } from 'react';
import {
  Link2, Loader2, AlertTriangle, CheckCircle2, Clock,
  Wallet, Tag, Calendar, Copy, Check, X, ExternalLink,
  ShoppingBag, Globe, ShoppingCart, Package, Instagram,
  Lock, TrendingUp, History,
} from 'lucide-react';
import { channelsApi, shopifyApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  channel_seller_id?: string;
  webhook_secret: string;
  is_active: boolean;
}

interface TheDersiInfo {
  plan_label: string;
  commission_rate: number;
  payout_schedule: string;
  earnings_balance: number;
  held_amount: number;
  available_amount: number;
  total_earned_lifetime: number;
  currency: string;
  next_payout_date: string;
  payout_overdue: boolean;
}

interface PayoutRecord {
  reference: string;
  amount: number;
  status: string;
  date: string;
  period_start: string;
  period_end: string;
}

function fmt(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function TheDersiCard({ connection, shopId }: { connection: ChannelConnection; shopId: string }) {
  const [info, setInfo] = useState<TheDersiInfo | null>(null);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [error, setError] = useState('');
  const webhookUrl = `https://api.exiuscart.com/api/v1/channels/webhook/${connection.webhook_secret}`;

  const loadPayouts = () => {
    setPayoutsLoading(true);
    channelsApi.getTheDersiPayouts(shopId, connection.id)
      .then((r) => setPayouts(r.data ?? []))
      .catch(() => {})
      .finally(() => setPayoutsLoading(false));
  };

  useEffect(() => {
    channelsApi.getTheDersiInfo(shopId, connection.id)
      .then((r) => setInfo(r.data))
      .catch(() => setError('Could not load earnings data from TheDersi.'))
      .finally(() => setLoading(false));
    loadPayouts();
  }, [shopId, connection.id]);

  const handleRequestPayout = async () => {
    setRequesting(true);
    setPayoutError('');
    setPayoutSuccess('');
    try {
      const r = await channelsApi.requestTheDersiPayout(shopId, connection.id);
      const amount = r.data?.requested_amount;
      const currency = r.data?.currency ?? info?.currency ?? 'LKR';
      setPayoutSuccess(`Payout request submitted — ${currency} ${fmt(amount)}. TheDersi will process it on your next payout date.`);
      loadPayouts();
    } catch (err: any) {
      setPayoutError(err?.response?.data?.detail ?? 'Could not submit payout request. Try again.');
    } finally {
      setRequesting(false);
    }
  };

  const hasPending = payouts.some((p) => p.status === 'pending');

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
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

      <div className="p-5 space-y-5">
        <CopyBox label="ExiusCart Webhook URL (paste into thedersi.lk/seller/connect)" value={webhookUrl} />

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading earnings...
          </div>
        )}
        {error && !loading && <p className="text-sm text-muted-foreground">{error}</p>}

        {info && !loading && (
          <div className="space-y-4">
            {/* Earnings breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Available */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">Available</p>
                </div>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {info.currency} {fmt(info.available_amount ?? info.earnings_balance)}
                </p>
                <p className="text-xs text-green-600/70 dark:text-green-500 mt-0.5">Ready for payout</p>
              </div>

              {/* On hold */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">On Hold</p>
                </div>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                  {info.currency} {fmt(info.held_amount ?? 0)}
                </p>
                <p className="text-xs text-amber-600/70 dark:text-amber-500 mt-0.5">7-day hold from order date</p>
              </div>

              {/* All-time */}
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-medium">All-time Earned</p>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {info.currency} {fmt(info.total_earned_lifetime ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Including past payouts</p>
              </div>
            </div>

            {/* Request Payout button */}
            {payoutSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />{payoutSuccess}
              </div>
            )}
            {payoutError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
                {payoutError}
              </div>
            )}
            <button
              type="button"
              onClick={handleRequestPayout}
              disabled={requesting || (info?.available_amount ?? 0) <= 0 || hasPending}
              className="w-full py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requesting && <Loader2 className="w-4 h-4 animate-spin" />}
              {hasPending
                ? '⏳ Payout Request Pending'
                : (info?.available_amount ?? 0) <= 0
                ? 'No Balance Available'
                : `Request Payout — ${info?.currency} ${fmt(info?.available_amount ?? 0)}`}
            </button>

            {/* Plan / Schedule / Next payout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-2.5">
                <Tag className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="text-sm font-medium text-foreground">{info.plan_label}</p>
                  <p className="text-xs text-muted-foreground">{info.commission_rate}% commission</p>
                </div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Payout Schedule</p>
                  <p className="text-sm font-medium text-foreground">{info.payout_schedule}</p>
                  <p className="text-xs text-muted-foreground">
                    {info.plan_label === 'Pro' ? 'Every Monday' : 'Every 2nd Monday'}
                  </p>
                </div>
              </div>
              <div className={`rounded-lg p-3 flex items-start gap-2.5 ${info.payout_overdue ? 'bg-red-500/10' : 'bg-muted/40'}`}>
                <Calendar className={`w-4 h-4 mt-0.5 shrink-0 ${info.payout_overdue ? 'text-red-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-xs text-muted-foreground">Next Payout</p>
                  <p className={`text-sm font-medium ${info.payout_overdue ? 'text-red-500' : 'text-foreground'}`}>
                    {new Date(info.next_payout_date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {info.payout_overdue && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3" /> Overdue
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Payout history */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Payout History</p>
              </div>
              {payoutsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                </div>
              ) : payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No payouts yet.</p>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {['Reference', 'Period', 'Amount', 'Status'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {payouts.map((p) => (
                        <tr key={p.reference} className="hover:bg-muted/30 transition">
                          <td className="px-4 py-3 font-mono text-xs text-foreground">{p.reference}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {p.period_start && p.period_end ? (
                              <>
                                {new Date(p.period_start).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })}
                                {' – '}
                                {new Date(p.period_end).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </>
                            ) : (
                              new Date(p.date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {info.currency} {fmt(p.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.status === 'paid'
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}>
                              {p.status === 'paid' ? '✅ Paid' : '⏳ Processing'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
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
  badge: 'live' | 'connect' | 'soon';
  badgeLabel?: string;
  onAction?: () => void;
  actionLabel?: string;
}

function ChannelTile({ ch }: { ch: ChannelDef }) {
  const badgeStyles: Record<string, string> = {
    live: 'bg-green-500/10 text-green-500',
    connect: 'bg-primary/10 text-primary',
    soon: 'bg-muted text-muted-foreground',
  };
  const badgeLabels: Record<string, string> = {
    live: 'Live',
    connect: 'Available',
    soon: 'Coming Soon',
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
  const [shopifyConnected, setShopifyConnected] = useState(false);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    Promise.all([
      channelsApi.getConnections(shopId).then((r) => setConnections(r.data ?? [])),
      shopifyApi.getStatus(shopId).then((r) => setShopifyConnected(r.data?.connected ?? false)).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const theDersiConns = connections.filter((c) => c.channel_type === 'thedersi' && c.is_active);
  const hasTheDersi = theDersiConns.length > 0;

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
      onAction: () => router.push('/dashboard/shopify-integration'),
      actionLabel: shopifyConnected ? 'Manage Shopify' : 'Connect Shopify',
    },
    {
      id: 'custom_website',
      name: 'Custom Website',
      description: 'Connect any website using our API or webhook. Receive orders directly from your own storefront.',
      icon: <Globe className="w-5 h-5 text-sky-400" />,
      badge: 'soon',
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      description: 'WordPress + WooCommerce integration. Install the ExiusCart plugin to sync products and orders.',
      icon: <ShoppingCart className="w-5 h-5 text-[#7F54B3]" />,
      badge: 'soon',
    },
    {
      id: 'amazon',
      name: 'Amazon',
      description: 'List and manage your Amazon products and orders through ExiusCart.',
      icon: <Package className="w-5 h-5 text-orange-400" />,
      badge: 'soon',
    },
    {
      id: 'instagram',
      name: 'Instagram Shopping',
      description: 'Tag products in your Instagram posts and stories. Orders sync to ExiusCart.',
      icon: <Instagram className="w-5 h-5 text-pink-400" />,
      badge: 'soon',
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
                <TheDersiCard key={conn.id} connection={conn} shopId={shopId} />
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
    </div>
  );
}
