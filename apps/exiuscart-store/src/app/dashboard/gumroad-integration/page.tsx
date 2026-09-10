'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Download, Loader2, CheckCircle2,
} from 'lucide-react';
import { channelsApi, gumroadApi } from '@/lib/api';
import ChannelListingActivity from '@/components/channel-listings/ChannelListingActivity';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
}

// Unlike every other *-integration page, connecting here doesn't let you
// create/push a listing — Gumroad's own API blocks programmatic product
// creation (confirmed against their docs, 2026-03-03: the create-product
// endpoint 404s). So this page connects the account, then the seller
// pastes the ID of a product they've ALREADY created on Gumroad's own
// dashboard to link it — orders start syncing once their Ping endpoint
// is pointed at the URL shown after connecting.
export default function GumroadIntegrationPage() {
  const [shopId, setShopId] = useState('');
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [accessToken, setAccessToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [pingUrl, setPingUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    channelsApi.getConnections(shopId)
      .then((r) => {
        const conns: ChannelConnection[] = r.data ?? [];
        setConnection(conns.find((c) => c.channel_type === 'gumroad') ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken.trim()) return;
    setConnecting(true); setError('');
    try {
      const res = await gumroadApi.connect(shopId, {
        access_token: accessToken.trim(),
        webhook_signing_secret: webhookSecret.trim() || undefined,
      });
      setPingUrl(res.data?.ping_url ?? '');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Connection failed — double-check your access token.');
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

  const copyPingUrl = () => {
    const full = `${process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com'}/api/v1${pingUrl}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/channels" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" /> Back to Channels
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-foreground">Gumroad Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">List your digital products on Gumroad and manage orders from ExiusCart.</p>
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
              <div className="w-9 h-9 rounded-lg bg-[#FF90E8]/10 flex items-center justify-center">
                <Download className="w-4 h-4 text-[#FF90E8]" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Gumroad</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>
          <div className="p-5 space-y-4">
            {pingUrl && (
              <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs space-y-2">
                <p className="text-foreground font-medium">Last step — paste this URL as your Ping endpoint (Gumroad Settings → Advanced → Ping endpoint). It's account-wide, not per-product.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border border-border rounded px-2 py-1.5 font-mono text-[11px] truncate">
                    {(process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com') + '/api/v1' + pingUrl}
                  </code>
                  <button onClick={copyPingUrl} className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition">
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
              <strong>Note:</strong> Gumroad's own API doesn't allow creating listings from outside their dashboard — create your product on Gumroad first, then link it to an ExiusCart product from that product's edit page.
            </div>
            <div className="pt-3 mt-1 border-t border-border">
              {confirming ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">Disconnect Gumroad? Your listings stay live on Gumroad, but stop syncing here.</p>
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
                  Disconnect Gumroad
                </button>
              )}
            </div>
          </div>
        </div>
        <ChannelListingActivity shopId={shopId} channelType="gumroad" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <p className="font-semibold text-foreground">Connect Gumroad</p>
            <p className="text-xs text-muted-foreground mt-0.5">Paste your own Gumroad access token</p>
          </div>
          <form onSubmit={connect} className="p-5 space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1.5">
              <p><strong className="text-foreground">Don't have this yet?</strong></p>
              <p>1. In your Gumroad account, go to Settings → Advanced → Applications</p>
              <p>2. Create an application, then click "Generate access token"</p>
              <p>3. Copy the access token shown</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Access Token *</label>
              <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} required
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm font-mono" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Webhook Signing Secret (optional)</label>
              <input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Paste after registering your Ping endpoint"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm font-mono" />
              <p className="text-xs text-muted-foreground mt-1.5">Can be added later — without it, incoming orders won't be signature-verified.</p>
            </div>
            <button type="submit" disabled={connecting}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
              {connecting ? 'Verifying...' : 'Connect Gumroad'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
