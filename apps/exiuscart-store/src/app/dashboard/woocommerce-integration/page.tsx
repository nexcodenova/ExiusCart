'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ShoppingCart, Loader2, CheckCircle2, ExternalLink, ChevronDown,
} from 'lucide-react';
import { channelsApi, woocommerceApi } from '@/lib/api';
import ChannelListingActivity from '@/components/channel-listings/ChannelListingActivity';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  channel_api_url?: string | null;
}

// Same per-seller-credential shape as noon-integration/page.tsx — each
// seller's WooCommerce site is independent, no central app to authorize
// against, so they paste their own Consumer Key/Secret + site URL.
export default function WooCommerceIntegrationPage() {
  const [shopId, setShopId] = useState('');
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [siteUrl, setSiteUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  // Optional — separate from the Consumer Key/Secret above. Those only
  // grant access to WooCommerce's own product/order API; blog publishing
  // needs a real WordPress Application Password instead (WP core feature
  // since 5.6). Left blank, product/order sync still works fully.
  const [showBlogAdvanced, setShowBlogAdvanced] = useState(false);
  const [wpUsername, setWpUsername] = useState('');
  const [wpAppPassword, setWpAppPassword] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    channelsApi.getConnections(shopId)
      .then((r) => {
        const conns: ChannelConnection[] = r.data ?? [];
        setConnection(conns.find((c) => c.channel_type === 'woocommerce') ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()) return;
    setConnecting(true); setError('');
    try {
      await woocommerceApi.connect(shopId, {
        site_url: siteUrl.trim(),
        consumer_key: consumerKey.trim(),
        consumer_secret: consumerSecret.trim(),
        wp_username: wpUsername.trim() || undefined,
        wp_app_password: wpAppPassword.trim() || undefined,
      });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Connection failed — double-check your site URL and keys.');
    } finally {
      setConnecting(false);
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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/channels" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" /> Back to Channels
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-foreground">WooCommerce Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">WordPress + WooCommerce — products, orders, and inventory sync to ExiusCart.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : connection ? (
        <div className="space-y-5">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#7F54B3]/10 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-[#7F54B3]" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">WooCommerce</p>
                <p className="text-xs text-muted-foreground truncate max-w-[280px]">{connection.channel_api_url}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>
          <div className="p-5 space-y-4">
            {connection.channel_api_url && (
              <a href={connection.channel_api_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium">
                Open your site <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
              Products you list from ExiusCart go live on your site immediately — WooCommerce has no marketplace review step, unlike Daraz or Noon.
            </p>
            <div className="pt-3 mt-1 border-t border-border">
              {confirming ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">Disconnect WooCommerce? Your store stays live, but it stops syncing here.</p>
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
                  Disconnect WooCommerce
                </button>
              )}
            </div>
          </div>
        </div>
        <ChannelListingActivity shopId={shopId} channelType="woocommerce" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <p className="font-semibold text-foreground">Connect WooCommerce</p>
            <p className="text-xs text-muted-foreground mt-0.5">Paste your own site's REST API keys</p>
          </div>
          <form onSubmit={connect} className="p-5 space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1.5">
              <p><strong className="text-foreground">Don't have these yet?</strong></p>
              <p>1. In your WordPress admin, go to WooCommerce → Settings → Advanced → REST API</p>
              <p>2. Click "Add key" — set permissions to Read/Write</p>
              <p>3. Copy the Consumer Key and Consumer Secret shown (only shown once)</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Site URL *</label>
              <input type="url" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} required
                placeholder="https://yourstore.com"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
              <p className="text-xs text-muted-foreground mt-1.5">Must start with https:// — WooCommerce's REST API requires it.</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Consumer Key *</label>
              <input type="text" value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} required
                placeholder="ck_..."
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm font-mono" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Consumer Secret *</label>
              <input type="password" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} required
                placeholder="cs_..."
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm font-mono" />
            </div>
            <button
              type="button"
              onClick={() => setShowBlogAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBlogAdvanced ? 'rotate-180' : ''}`} />
              Advanced: Enable blog publishing
            </button>
            {showBlogAdvanced && (
              <div className="space-y-3 bg-muted/30 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  Optional — only needed if you want to publish ExiusCart blog posts straight to this site. The Consumer Key/Secret above don't cover this; WordPress requires a separate Application Password for it.
                </p>
                <div className="bg-muted/50 rounded-lg px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                  <p>1. In WordPress admin, go to Users → Profile</p>
                  <p>2. Scroll to "Application Passwords" — enter a name (e.g. "ExiusCart") and click Add</p>
                  <p>3. Copy the generated password (only shown once)</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">WordPress Username</label>
                  <input type="text" value={wpUsername} onChange={(e) => setWpUsername(e.target.value)}
                    placeholder="your-wp-username"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Application Password</label>
                  <input type="password" value={wpAppPassword} onChange={(e) => setWpAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm font-mono" />
                </div>
              </div>
            )}
            <button type="submit" disabled={connecting}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
              {connecting ? 'Verifying...' : 'Connect WooCommerce'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
