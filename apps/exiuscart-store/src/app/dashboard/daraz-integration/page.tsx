'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ShoppingBag, Loader2, CheckCircle2, ExternalLink, X,
} from 'lucide-react';
import { channelsApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  channel_seller_id?: string;
  webhook_url: string;
}

export default function DarazIntegrationPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [oauthResult, setOauthResult] = useState<string | null>(null);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    channelsApi.getConnections(shopId)
      .then((r) => {
        const conns: ChannelConnection[] = r.data ?? [];
        setConnection(conns.find((c) => c.channel_type === 'daraz') ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('daraz');
    if (!result) return;
    setOauthResult(result);
    router.replace('/dashboard/daraz-integration');
    load();
  }, []);

  const startAuthorize = async () => {
    setConnecting(true); setError('');
    try {
      const res = await channelsApi.darazAuthorize(shopId);
      window.open(res.data.authorize_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not start Daraz connection. Try again.');
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
        <h1 className="text-xl font-semibold text-foreground">Daraz Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">Sri Lanka's #1 marketplace — orders sync to ExiusCart automatically.</p>
      </div>

      {oauthResult && (
        <div className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border ${
          oauthResult === 'connected' ? 'bg-green-500/8 border-green-500/30'
          : oauthResult === 'pending' ? 'bg-amber-500/8 border-amber-500/30'
          : 'bg-destructive/8 border-destructive/30'
        }`}>
          <p className="text-sm font-medium text-foreground">
            {oauthResult === 'connected' && 'Daraz connected successfully — your products will start syncing shortly.'}
            {oauthResult === 'pending' && "Daraz authorization received — we're finishing setup on our end, check back shortly."}
            {oauthResult === 'denied' && 'Daraz connection was cancelled — you can try again anytime.'}
            {oauthResult === 'invalid_state' && 'That Daraz connection link expired — please try connecting again.'}
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
          <div className="p-5 space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>Seller ID: <strong className="text-foreground">{connection.channel_seller_id}</strong></p>
              <p className="mt-1 text-xs">Orders syncing from daraz.lk automatically</p>
            </div>
            <div className="pt-3 border-t border-border">
              {confirming ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">Disconnect Daraz? Your listings stay on Daraz, but they stop syncing here.</p>
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
                  Disconnect Daraz
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <p className="font-semibold text-foreground">Connect Daraz</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sri Lanka's #1 Marketplace</p>
          </div>
          <div className="p-5 space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {hasAccount === null && (
              <>
                <p className="text-sm text-muted-foreground">Do you already have a Daraz seller account?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setHasAccount(true)}
                    className="py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                    Yes, I have one
                  </button>
                  <button onClick={() => setHasAccount(false)}
                    className="py-2.5 bg-muted border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted/70 transition">
                    Not yet
                  </button>
                </div>
              </>
            )}

            {hasAccount === true && (
              <>
                <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1.5">
                  <p><strong className="text-foreground">What happens next:</strong></p>
                  <p>• Daraz opens in a new tab — log into your own seller account there</p>
                  <p>• Approve ExiusCart's access request</p>
                  <p>• Come back to this tab — it'll be connected once you're done</p>
                </div>
                <button onClick={startAuthorize} disabled={connecting}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                  {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {connecting ? 'Opening Daraz...' : 'Continue to Daraz'}
                </button>
                <button onClick={() => setHasAccount(null)} className="w-full text-xs text-muted-foreground hover:text-foreground">
                  ← Back
                </button>
              </>
            )}

            {hasAccount === false && (
              <>
                <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm text-muted-foreground">
                  You'll need a Daraz seller account before you can connect. It's free to create — once you're registered and approved as a seller, come back here and connect.
                </div>
                <a href="https://sellercenter.daraz.lk/apps/register/index" target="_blank" rel="noopener noreferrer"
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition flex items-center justify-center gap-2">
                  Create Daraz Seller Account <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button onClick={() => setHasAccount(true)}
                  className="w-full py-2.5 bg-muted border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted/70 transition">
                  I've created my account
                </button>
                <button onClick={() => setHasAccount(null)} className="w-full text-xs text-muted-foreground hover:text-foreground">
                  ← Back
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
