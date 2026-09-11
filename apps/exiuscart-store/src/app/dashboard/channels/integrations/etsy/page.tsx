'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Store, Loader2, CheckCircle2, X, ShieldCheck, ListChecks, FileText, Link2Off, LifeBuoy,
} from 'lucide-react';
import { channelsApi, etsyApi } from '@/lib/api';
import ChannelListingActivity from '@/components/channels/ChannelListingActivity';
import TheDersiRestrictionNotice, { useIsTheDersiUser } from '@/components/channels/TheDersiRestriction';
import BeforeConnectLayout, { SidebarCard } from '@/components/channels/BeforeConnect';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  channel_seller_id?: string;
}

// Mirrors tiktok-integration/page.tsx exactly — same OAuth click-to-connect
// shape, no extra fields needed at connect time (Etsy's shop_id comes back
// as part of the token itself, unlike Noon/WooCommerce's manual entry).
export default function EtsyIntegrationPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const isTheDersiUser = useIsTheDersiUser(shopId);
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
        setConnection(conns.find((c) => c.channel_type === 'etsy') ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('etsy');
    if (!result) return;
    setOauthResult(result);
    router.replace('/dashboard/channels/integrations/etsy');
    load();
  }, []);

  const startAuthorize = async () => {
    setConnecting(true); setError('');
    try {
      const res = await etsyApi.authorize(shopId);
      window.open(res.data.authorize_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not start Etsy connection. Try again.');
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/channels" aria-label="Back to Channels"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Etsy Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">List products on Etsy and manage orders directly from ExiusCart.</p>
        </div>
      </div>

      {oauthResult && (
        <div className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border ${
          oauthResult === 'connected' ? 'bg-green-500/8 border-green-500/30'
          : oauthResult === 'pending' ? 'bg-amber-500/8 border-amber-500/30'
          : 'bg-destructive/8 border-destructive/30'
        }`}>
          <p className="text-sm font-medium text-foreground">
            {oauthResult === 'connected' && 'Etsy connected.'}
            {oauthResult === 'pending' && "Etsy authorization received — we're finishing setup on our end, check back shortly."}
            {oauthResult === 'denied' && 'Etsy connection was cancelled — you can try again anytime.'}
            {oauthResult === 'invalid_state' && 'That Etsy connection link expired — please try connecting again.'}
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
        <div className="space-y-5 max-w-3xl">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F1641E]/10 flex items-center justify-center">
                <Store className="w-4 h-4 text-[#F1641E]" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Etsy</p>
                <p className="text-xs text-muted-foreground">Handmade & Craft Marketplace</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>
          <div className="p-5 text-sm text-muted-foreground space-y-3">
            <p>Shop: <strong className="text-foreground font-mono text-xs">{connection.channel_seller_id || 'Etsy shop connected'}</strong></p>
            <div className="pt-3 mt-1 border-t border-border">
              {confirming ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">Disconnect Etsy? Your listings stay on Etsy, but they stop syncing here.</p>
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
                  Disconnect Etsy
                </button>
              )}
            </div>
          </div>
        </div>
        <ChannelListingActivity shopId={shopId} channelType="etsy" />
        </div>
      ) : isTheDersiUser ? (
        <TheDersiRestrictionNotice channelKey="etsy" />
      ) : (
        <BeforeConnectLayout
          accentClass="bg-[#F1641E]/10 text-[#F1641E]"
          badges={[
            { icon: ShieldCheck, label: 'OAuth secured', desc: "You authorize on Etsy's own site — no password shared" },
            { icon: ListChecks, label: 'Tracked in Channel Listings', desc: 'Every listing attempt, success or failure' },
            { icon: FileText, label: 'Manage in Channel Orders', desc: 'Etsy orders show up alongside every other channel' },
            { icon: Link2Off, label: 'Disconnect anytime', desc: 'Your Etsy shop and listings stay untouched' },
          ]}
          sidebar={<>
            <SidebarCard icon={LifeBuoy} iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              title="Need help?" desc={'The real 3-step flow is right below.'}
              action={<a href="#how-it-works" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Jump to "How it works" ↓</a>} />
            <SidebarCard icon={Store} iconClass="bg-[#F1641E]/10 text-[#F1641E]"
              title="What syncs" desc="Assign a product to Etsy from Channel Categories to list it — every attempt, success or failure, is tracked in Channel Listings." />
          </>}
          steps={[
            { icon: ShieldCheck, title: '1. Authorize on Etsy', desc: 'Log into your own Etsy shop.' },
            { icon: CheckCircle2, title: '2. Approve access', desc: "Grant ExiusCart's access request." },
            { icon: ArrowLeft, title: '3. Come back, connected', desc: 'Your shop shows as connected here.' },
            { icon: ListChecks, title: '4. List & manage', desc: 'Assign products from Channel Categories.' },
          ]}
        >
          <div className="bg-card border border-border rounded-xl">
            <div className="p-5 border-b border-border">
              <p className="font-semibold text-foreground">Connect Etsy</p>
              <p className="text-xs text-muted-foreground mt-0.5">List products and manage orders on Etsy</p>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1.5">
                <p><strong className="text-foreground">What happens next:</strong></p>
                <p>• Etsy opens in a new tab — log into your own shop there</p>
                <p>• Approve ExiusCart's access request</p>
                <p>• Come back to this tab — your shop will show as connected</p>
              </div>
              <button onClick={startAuthorize} disabled={connecting}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {connecting ? 'Opening Etsy...' : 'Continue to Etsy'}
              </button>
            </div>
          </div>
        </BeforeConnectLayout>
      )}
    </div>
  );
}
