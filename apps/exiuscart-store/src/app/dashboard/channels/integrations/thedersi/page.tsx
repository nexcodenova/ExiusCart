'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, CheckCircle2, X, KeyRound, ArrowLeftRight, FileText, Link2Off, LifeBuoy, Link2,
  RefreshCw, Settings, MoreHorizontal, LayoutDashboard, Package, ShoppingCart, FileClock, ChevronRight,
} from 'lucide-react';
import { channelsApi } from '@/lib/api';
import { CopyBox } from '@/components/channels/CopyBox';
import ChannelLogo from '@/components/channels/ChannelLogo';
import { channelMeta } from '@/components/channels/channelMeta';
import BeforeConnectLayout, { SidebarCard } from '@/components/channels/BeforeConnect';
import ChannelDashboardOverview from '@/components/channels/dashboard/ChannelDashboardOverview';
import ChannelListingActivity from '@/components/channels/ChannelListingActivity';
import ChannelOrdersMini from '@/components/channels/dashboard/ChannelOrdersMini';
import ChannelLogsMini from '@/components/channels/dashboard/ChannelLogsMini';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  webhook_url: string;
  seller_status?: string | null;
  last_synced_at?: string | null;
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'logs', label: 'Logs', icon: FileClock },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;
type TabId = typeof TABS[number]['id'];

export default function TheDersiIntegrationPage() {
  const [shopId, setShopId] = useState('');
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [dashboardRefresh, setDashboardRefresh] = useState(0);

  const [sellerId, setSellerId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  // Settings tab actions
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratedUrl, setRegeneratedUrl] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    channelsApi.getConnections(shopId)
      .then((r) => {
        const conns: ChannelConnection[] = r.data ?? [];
        setConnection(conns.find((c) => c.channel_type === 'thedersi') ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerId.trim() || !apiKey.trim()) return;
    setSaving(true); setError('');
    try {
      const r = await channelsApi.connect(shopId, {
        channel_type: 'thedersi',
        channel_api_key: apiKey.trim(),
        channel_api_url: 'https://thedersi.lk/api/v1',
        channel_seller_id: sellerId.trim(),
      });
      const secret = r.data?.webhook_secret;
      if (secret) setWebhookUrl(`https://api.exiuscart.com/api/v1/channels/webhook/${secret}`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Connection failed. Check your Seller ID and API Key.');
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!connection) return;
    setDisconnecting(true);
    try {
      await channelsApi.disconnectChannel(shopId, connection.id);
      setConnection(null);
      setConfirming(false);
    } finally {
      setDisconnecting(false);
    }
  };

  const regenerateWebhook = async () => {
    if (!connection) return;
    setRegenerating(true);
    try {
      const r = await channelsApi.regenerateWebhook(shopId, connection.id);
      setRegeneratedUrl(r.data?.webhook_url ?? '');
    } finally {
      setRegenerating(false);
    }
  };

  const syncNow = async () => {
    if (!connection) return;
    setSyncing(true);
    try {
      await channelsApi.syncChannel(shopId, connection.id);
      setDashboardRefresh((n) => n + 1);
    } finally {
      setTimeout(() => setSyncing(false), 1200);
    }
  };

  const isSuspended = connection?.seller_status === 'suspended';
  const isRejected = connection?.seller_status === 'rejected';
  const isRestricted = isSuspended || isRejected;
  const meta = channelMeta('thedersi');

  return (
    <div className="max-w-[1500px] mx-auto space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/channels" aria-label="Back to Channels"
            className="mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Sales Channels</span>
              <ChevronRight className="w-3 h-3" />
              <Link href="/dashboard/channels" className="hover:text-foreground">All Channels</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium">TheDersi</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${isRestricted ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                <ChannelLogo channelType="thedersi" size={22} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">TheDersi</h1>
              {connection && (
                isRestricted ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                    <X className="w-3 h-3" /> {isSuspended ? 'Suspended' : 'Not Approved'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                )
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Sri Lankan Fashion Marketplace <span className="mx-1.5">•</span>
              <a href="https://thedersi.lk" target="_blank" rel="noreferrer" className="hover:text-primary">thedersi.lk</a>
            </p>
          </div>
        </div>

        {connection && !isRestricted && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={syncNow} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </Button>
            <Button onClick={() => setActiveTab('settings')}>
              <Settings className="w-4 h-4" /> Settings
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setActiveTab('logs')}>View integration logs</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('settings')}>Regenerate webhook</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setActiveTab('settings')}>Disconnect channel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {isRestricted && (
        <div className="px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-lg max-w-3xl">
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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : connection && !webhookUrl ? (
        isRestricted ? (
          <div className="max-w-3xl space-y-5">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <CopyBox label="Your ExiusCart Webhook URL" value={connection.webhook_url} />
              <div className="pt-3 border-t border-border">
                {confirming ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-muted-foreground">Disconnect TheDersi? New orders will stop syncing here.</p>
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
                    Disconnect TheDersi
                  </button>
                )}
              </div>
            </div>
            <ChannelListingActivity shopId={shopId} channelType="thedersi" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}
                  className="relative h-11 shrink-0 rounded-none border-b-2 border-transparent px-4 text-xs font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
                  <tab.icon className="w-4 h-4 mr-1.5" /> {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="mt-5">
              <ChannelDashboardOverview
                shopId={shopId}
                channelType="thedersi"
                channelLabel="TheDersi"
                siteUrl="https://thedersi.lk"
                accentColor="#7c3aed"
                onDisconnected={() => setConnection(null)}
                refreshKey={dashboardRefresh}
              />
            </TabsContent>

            <TabsContent value="products" className="mt-5">
              <ChannelListingActivity shopId={shopId} channelType="thedersi" limit={15} />
            </TabsContent>

            <TabsContent value="orders" className="mt-5">
              <ChannelOrdersMini shopId={shopId} channelType="thedersi" limit={15} />
            </TabsContent>

            <TabsContent value="logs" className="mt-5">
              <ChannelLogsMini shopId={shopId} channelType="thedersi" limit={50} />
            </TabsContent>

            <TabsContent value="settings" className="mt-5">
              <div className="max-w-2xl space-y-5">
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">Webhook</p>
                    <p className="text-xs text-muted-foreground mt-0.5">TheDersi calls this URL whenever a buyer places an order.</p>
                  </div>
                  <CopyBox label="Your ExiusCart Webhook URL" value={regeneratedUrl || connection.webhook_url} />
                  {regeneratedUrl && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
                      This is a new webhook URL — paste it into <strong>thedersi.lk/seller/connect</strong> to keep orders flowing. The old URL no longer works.
                    </p>
                  )}
                  <button onClick={regenerateWebhook} disabled={regenerating}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:bg-muted transition disabled:opacity-60">
                    <KeyRound className="w-3.5 h-3.5" /> {regenerating ? 'Regenerating…' : 'Regenerate Webhook'}
                  </button>
                </div>

                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">Account status</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Set by TheDersi, not editable here.</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-foreground font-medium">Approved</span>
                  </div>
                </div>

                <div className="bg-card border border-destructive/30 rounded-xl p-5 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-destructive">Disconnect TheDersi</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Your TheDersi shop stays live — it just stops syncing here.</p>
                  </div>
                  {confirming ? (
                    <div className="flex items-center gap-2 flex-wrap">
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
                    <button onClick={() => setConfirming(true)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition">
                      Disconnect TheDersi
                    </button>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )
      ) : webhookUrl ? (
        <div className="max-w-lg bg-card rounded-xl border border-border p-6 space-y-5">
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
          <button onClick={() => setWebhookUrl('')}
            className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition text-center">
            Done
          </button>
        </div>
      ) : (
        <BeforeConnectLayout
          accentClass="bg-primary/10 text-primary"
          badges={[
            { icon: KeyRound, label: 'Your own credentials', desc: 'Seller ID & API key you generate on thedersi.lk' },
            { icon: ArrowLeftRight, label: 'Two-way handshake', desc: "You paste theirs here, then paste ours back into TheDersi" },
            { icon: FileText, label: 'Manage in Channel Orders', desc: 'TheDersi orders show up alongside every other channel' },
            { icon: Link2Off, label: 'Disconnect anytime', desc: 'Your TheDersi listings stay untouched' },
          ]}
          sidebar={<>
            <SidebarCard icon={LifeBuoy} iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              title="Need help?" desc={'The real 4-step flow is right below.'}
              action={<a href="#how-it-works" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Jump to "How it works" ↓</a>} />
            <SidebarCard icon={Link2} iconClass="bg-primary/10 text-primary"
              title="What syncs" desc="Once both URLs are exchanged, TheDersi orders sync in automatically — every attempt, success or failure, is tracked in Channel Listings." />
          </>}
          steps={[
            { icon: KeyRound, title: '1. Get credentials', desc: 'From thedersi.lk/seller/connect.' },
            { icon: ArrowLeftRight, title: '2. Paste Seller ID & key', desc: 'Into the form here.' },
            { icon: CheckCircle2, title: '3. Copy your webhook URL', desc: 'Paste it back into TheDersi.' },
            { icon: FileText, title: '4. Orders sync in', desc: 'Manage them from Channel Orders.' },
          ]}
        >
          <div className="bg-card border border-border rounded-xl">
            <div className="p-5 border-b border-border">
              <p className="font-semibold text-foreground">Connect TheDersi</p>
              <p className="text-xs text-muted-foreground mt-0.5">Get credentials from thedersi.lk/seller/connect</p>
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
        </BeforeConnectLayout>
      )}
    </div>
  );
}
