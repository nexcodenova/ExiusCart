'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Download, Loader2, CheckCircle2, KeyRound, Link2, FileText, Link2Off, LifeBuoy,
} from 'lucide-react';
import { channelsApi, gumroadApi, productsApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ChannelListingActivity from '@/components/channels/ChannelListingActivity';
import TheDersiRestrictionNotice, { useIsTheDersiUser } from '@/components/channels/TheDersiRestriction';
import BeforeConnectLayout, { SidebarCard } from '@/components/channels/BeforeConnect';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
}

// Gumroad's API cannot create products (create on Gumroad first), so once
// connected this page lists the seller's real Gumroad products and lets them
// link each one to an ExiusCart product. Sales then arrive through the Ping
// URL shown here (always, not only right after connecting).
export default function GumroadIntegrationPage() {
  const [shopId, setShopId] = useState('');
  const isTheDersiUser = useIsTheDersiUser(shopId);
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [accessToken, setAccessToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [pingUrl, setPingUrl] = useState('');
  const [copied, setCopied] = useState(false);
  type GStatus = Awaited<ReturnType<typeof gumroadApi.status>>['data'];
  const [gStatus, setGStatus] = useState<GStatus | null>(null);
  const [myProducts, setMyProducts] = useState<{ id: number; name: string }[]>([]);
  const [linking, setLinking] = useState<string | null>(null);
  const loadStatus = () => {
    if (!shopId) return;
    gumroadApi.status(shopId).then((r) => { setGStatus(r.data); setPingUrl(r.data.ping_url); }).catch(() => {});
    productsApi.getAll(shopId).then((r) => setMyProducts((r.data ?? []).map((p: any) => ({ id: p.id, name: p.name })))).catch(() => {});
  };
  const linkTo = async (gumroadId: string, productId: string) => {
    setLinking(gumroadId);
    try { await gumroadApi.linkProduct(shopId, productId, { gumroad_product_id: gumroadId }); loadStatus(); }
    finally { setLinking(null); }
  };

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
  useEffect(() => { if (connection) loadStatus(); }, [connection]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken.trim()) return;
    setConnecting(true); setError('');
    try {
      const res = await gumroadApi.connect(shopId, { access_token: accessToken.trim() });
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
    navigator.clipboard.writeText(pingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/channels" aria-label="Back to Channels"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Gumroad Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">List your digital products on Gumroad and manage orders from ExiusCart.</p>
        </div>
      </div>

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
                <p className="text-foreground font-medium">Paste this URL as your Ping endpoint in Gumroad (Settings → Advanced → Ping endpoint), then click Update settings. It is one URL for your whole Gumroad account.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border border-border rounded px-2 py-1.5 font-mono text-[11px] truncate">
                    {pingUrl}
                  </code>
                  <button onClick={copyPingUrl} className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition">
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
            {/* Link each Gumroad product to an ExiusCart product; a sale of an unlinked product cannot be recorded */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Your Gumroad products</p>
                <button onClick={loadStatus} className="text-xs text-muted-foreground hover:text-foreground">Refresh</button>
              </div>
              {!gStatus ? (
                <p className="text-xs text-muted-foreground">Loading your Gumroad products…</p>
              ) : gStatus.error ? (
                <p className="text-xs text-destructive">{gStatus.error}</p>
              ) : gStatus.products.length === 0 ? (
                <p className="text-xs text-muted-foreground">No products on Gumroad yet. Gumroad does not let other apps create products, so create one on Gumroad first, then click Refresh.</p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {gStatus.products.map((g) => {
                    const linked = gStatus.links[g.id] || (g.permalink ? gStatus.links[g.permalink] : undefined);
                    return (
                      <li key={g.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {g.image ? <img src={g.image} alt="" className="h-full w-full object-cover" /> : <Download className="h-4 w-4 text-[#FF90E8]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                          <p className="text-xs text-muted-foreground">{g.price ?? ''}{!g.published && ' · not published'}</p>
                        </div>
                        <div className="w-full sm:w-64">
                          <Select value={linked ? String(linked.product_id) : ''} onValueChange={(v) => linkTo(g.id, v)} disabled={linking === g.id}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Link to an ExiusCart product" /></SelectTrigger>
                            <SelectContent className="max-h-72">
                              {myProducts.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <span className={`text-[11px] ${linked ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {linking === g.id ? 'Saving…' : linked ? '● Linked' : '● Not linked'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {gStatus?.last_sale_at && <p className="mt-2 text-[11px] text-muted-foreground">Last sale received {new Date(gStatus.last_sale_at).toLocaleString()}.</p>}
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
      ) : isTheDersiUser ? (
        <TheDersiRestrictionNotice channelKey="gumroad" />
      ) : (
        <BeforeConnectLayout
          accentClass="bg-[#FF90E8]/10 text-[#FF90E8]"
          badges={[
            { icon: KeyRound, label: 'Your own access token', desc: 'Generated in your Gumroad account — you control it' },
            { icon: Link2, label: 'Link, not create', desc: "Gumroad's API can't create listings — create on Gumroad, then link" },
            { icon: FileText, label: 'Manage in Channel Orders', desc: 'Gumroad orders show up alongside every other channel' },
            { icon: Link2Off, label: 'Disconnect anytime', desc: 'Your Gumroad listings stay untouched' },
          ]}
          sidebar={<>
            <SidebarCard icon={LifeBuoy} iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              title="Need help?" desc={'The real 4-step flow is right below.'}
              action={<a href="#how-it-works" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Jump to "How it works" ↓</a>} />
            <SidebarCard icon={Download} iconClass="bg-[#FF90E8]/10 text-[#FF90E8]"
              title="What syncs" desc="Create the product on Gumroad first, then link it on this page. Each sale then arrives here as a paid order once your Ping endpoint is set." />
          </>}
          steps={[
            { icon: KeyRound, title: '1. Generate an access token', desc: 'Gumroad Settings → Advanced → Applications.' },
            { icon: Link2, title: '2. Paste token here', desc: 'We check it with Gumroad straight away.' },
            { icon: CheckCircle2, title: '3. Set your Ping endpoint', desc: "We'll show the exact URL once connected." },
            { icon: FileText, title: '4. Link your products', desc: 'Pick the matching ExiusCart product for each Gumroad product, right on this page.' },
          ]}
        >
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
              <button type="submit" disabled={connecting}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {connecting ? 'Verifying...' : 'Connect Gumroad'}
              </button>
            </form>
          </div>
        </BeforeConnectLayout>
      )}
    </div>
  );
}
