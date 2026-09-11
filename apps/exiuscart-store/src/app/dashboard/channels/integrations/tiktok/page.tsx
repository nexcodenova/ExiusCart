'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Music2, Loader2, CheckCircle2, X,
} from 'lucide-react';
import { channelsApi, tiktokApi } from '@/lib/api';
import ChannelListingActivity from '@/components/channels/ChannelListingActivity';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  channel_seller_id?: string;
}

// Mirrors ebay-integration/page.tsx's structure exactly, minus the
// seller_country field (TikTok's docs don't document an equivalent
// item-location requirement the way eBay's do) and the Business Policies
// step (no TikTok equivalent found). Product listing / order sync UI isn't
// built yet — connect/disconnect only, same incremental order eBay itself
// shipped in (connect flow first, product/order endpoints after).
export default function TikTokIntegrationPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [oauthResult, setOauthResult] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    channelsApi.getConnections(shopId)
      .then((r) => {
        const conns: ChannelConnection[] = r.data ?? [];
        setConnection(conns.find((c) => c.channel_type === 'tiktok') ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('tiktok');
    if (!result) return;
    setOauthResult(result);
    router.replace('/dashboard/channels/integrations/tiktok');
    load();
  }, []);

  const startAuthorize = async () => {
    setConnecting(true); setError('');
    try {
      const res = await tiktokApi.authorize(shopId);
      window.open(res.data.authorize_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not start TikTok Shop connection. Try again.');
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
        <h1 className="text-xl font-semibold text-foreground">TikTok Shop Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">Sell directly on TikTok. Orders sync to ExiusCart, stock stays in sync automatically.</p>
      </div>

      {/* TikTok Shop only supports registering a local seller account in
          these markets today (checked 2026-08-29) — UAE, Gulf, and Sri
          Lanka aren't among them, so a seller based there can't complete
          Connect below yet. Shown up front rather than letting someone
          hit a dead end after clicking Connect. */}
      <div className="bg-muted/50 border border-border rounded-xl px-4 py-3.5 text-xs text-muted-foreground space-y-1.5">
        <p className="font-medium text-foreground">TikTok Shop seller accounts are currently available in:</p>
        <p>United States, United Kingdom, Mexico, Brazil, Germany, France, Italy, Spain, Ireland, Poland, Netherlands, Belgium, Indonesia, Malaysia, Thailand, Vietnam, Philippines, Singapore, Japan.</p>
        <p>Not yet available: UAE, Saudi Arabia &amp; the wider Gulf, Sri Lanka. TikTok is expanding this list regularly — check back if your market isn't listed yet.</p>
      </div>

      {oauthResult && (
        <div className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border ${
          oauthResult === 'connected' ? 'bg-green-500/8 border-green-500/30'
          : oauthResult === 'pending' ? 'bg-amber-500/8 border-amber-500/30'
          : 'bg-destructive/8 border-destructive/30'
        }`}>
          <p className="text-sm font-medium text-foreground">
            {oauthResult === 'connected' && 'TikTok Shop connected.'}
            {oauthResult === 'pending' && "TikTok Shop authorization received — we're finishing setup on our end, check back shortly."}
            {oauthResult === 'denied' && 'TikTok Shop connection was cancelled — you can try again anytime.'}
            {oauthResult === 'invalid_state' && 'That TikTok Shop connection link expired — please try connecting again.'}
          </p>
          <button onClick={() => setOauthResult(null)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
              <div className="w-9 h-9 rounded-lg bg-[#010101]/10 flex items-center justify-center">
                <Music2 className="w-4 h-4 text-[#010101] dark:text-white" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">TikTok Shop</p>
                <p className="text-xs text-muted-foreground">Social Commerce</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>
          <div className="p-5 text-sm text-muted-foreground space-y-3">
            <p>Seller: <strong className="text-foreground">{connection.channel_seller_id || 'TikTok Shop account connected'}</strong></p>
            <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground">
              Product listing and order sync are being finished on our end — your account is connected and ready for when they go live.
            </div>

            <div className="pt-3 mt-1 border-t border-border">
              {confirming ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">Disconnect TikTok Shop? Your shop stays on TikTok, but it stops syncing here.</p>
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
                  Disconnect TikTok Shop
                </button>
              )}
            </div>
          </div>
        </div>
        <ChannelListingActivity shopId={shopId} channelType="tiktok" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <p className="font-semibold text-foreground">Connect TikTok Shop</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sell products and manage orders on TikTok Shop</p>
          </div>
          <div className="p-5 space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1.5">
              <p><strong className="text-foreground">What happens next:</strong></p>
              <p>• TikTok Shop opens in a new tab — log into your own seller account there</p>
              <p>• Approve ExiusCart's access request</p>
              <p>• Come back to this tab — your account will show as connected</p>
            </div>
            <button onClick={startAuthorize} disabled={connecting}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
              {connecting ? 'Opening TikTok Shop...' : 'Continue to TikTok Shop'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
