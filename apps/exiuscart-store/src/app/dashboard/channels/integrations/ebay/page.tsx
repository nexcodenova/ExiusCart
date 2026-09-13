'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, CheckCircle2, ExternalLink, X, AlertCircle, RefreshCw, ShieldCheck, ListChecks, FileText, Link2Off, LifeBuoy, MapPin,
  Settings, MoreHorizontal, LayoutDashboard, FileClock, ChevronRight, KeyRound, Zap, Clock3, CreditCard, Truck, RotateCcw,
} from 'lucide-react';
import { channelsApi, ebayApi } from '@/lib/api';
import { ChannelCurrencyField } from '@/components/channels/ChannelCurrencyField';
import ChannelLogo from '@/components/channels/ChannelLogo';
import TheDersiRestrictionNotice, { useIsTheDersiUser } from '@/components/channels/TheDersiRestriction';
import BeforeConnectLayout, { SidebarCard } from '@/components/channels/BeforeConnect';
import ChannelDashboardOverview from '@/components/channels/dashboard/ChannelDashboardOverview';
import ChannelLogsMini from '@/components/channels/dashboard/ChannelLogsMini';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  channel_seller_id?: string;
  seller_country?: string | null;
  channel_currency?: string | null;
}

// Listings/Orders/Inventory intentionally aren't separate tabs here —
// Channel Listings and Channel Orders already are the full dedicated pages
// for that (same call made for every other channel's dashboard).
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'policies', label: 'Business Policies', icon: FileText },
  { id: 'automation', label: 'Automation', icon: Zap },
  { id: 'logs', label: 'Logs', icon: FileClock },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;
type TabId = typeof TABS[number]['id'];

export default function EbayIntegrationPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const isTheDersiUser = useIsTheDersiUser(shopId);
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [oauthResult, setOauthResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const [sellerCountry, setSellerCountry] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const [countryInput, setCountryInput] = useState('');
  const [savingCountry, setSavingCountry] = useState(false);
  const [countryError, setCountryError] = useState('');

  const [policiesConfigured, setPoliciesConfigured] = useState<boolean | null>(null);
  const [marketplace, setMarketplace] = useState<{ marketplace_id: string; marketplace_label: string; is_default_fallback: boolean } | null>(null);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    channelsApi.getConnections(shopId)
      .then((r) => {
        const conns: ChannelConnection[] = r.data ?? [];
        const conn = conns.find((c) => c.channel_type === 'ebay') ?? null;
        setConnection(conn);
        if (conn) {
          ebayApi.getBusinessPolicies(shopId)
            .then((pr) => {
              const sel = pr.data?.selected ?? {};
              setPoliciesConfigured(!!(sel.payment_policy_id && sel.fulfillment_policy_id && sel.return_policy_id));
            })
            .catch((err) => {
              setPoliciesConfigured(err?.response?.data?.detail?.error === 'no_business_policies' ? false : null);
            });
          ebayApi.getMarketplace(shopId).then((r2) => setMarketplace(r2.data)).catch(() => setMarketplace(null));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('ebay');
    if (!result) return;
    setOauthResult(result);
    router.replace('/dashboard/channels/integrations/ebay');
    load();
    if (result === 'connected') setActiveTab('policies');
  }, []);

  const startAuthorize = async () => {
    if (!sellerCountry.trim()) return;
    setConnecting(true); setError('');
    try {
      const res = await ebayApi.authorize(shopId, sellerCountry.trim());
      window.open(res.data.authorize_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not start eBay connection. Try again.');
    } finally {
      setConnecting(false);
    }
  };

  const saveCountry = async () => {
    if (!countryInput.trim()) return;
    setSavingCountry(true); setCountryError('');
    try {
      const res = await ebayApi.setSellerCountry(shopId, countryInput.trim());
      setConnection((c) => (c ? { ...c, seller_country: res.data.seller_country } : c));
      ebayApi.getMarketplace(shopId).then((r2) => setMarketplace(r2.data)).catch(() => {});
      setCountryInput('');
    } catch (err: any) {
      setCountryError(err?.response?.data?.detail ?? 'Could not save. Try again.');
    } finally {
      setSavingCountry(false);
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

  const syncNow = async () => {
    if (!connection) return;
    setSyncing(true);
    try {
      await ebayApi.syncOrdersNow(shopId);
      setDashboardRefresh((n) => n + 1);
    } finally {
      setTimeout(() => setSyncing(false), 1200);
    }
  };

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
              <span className="text-foreground font-medium">eBay</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {/* eBay's real logo is a wide wordmark (channelMeta wide:true) —
                  a fixed square color chip clips/squishes it, so it renders
                  at its own natural width here instead of being boxed in. */}
              <div className="h-8 flex items-center shrink-0">
                <ChannelLogo channelType="ebay" size={32} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">eBay</h1>
              {connection && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Global Marketplace
              {connection?.seller_country && <span className="mx-1.5">•</span>}
              {connection?.seller_country && <span>Registered: {connection.seller_country}</span>}
            </p>
          </div>
        </div>

        {connection && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={syncNow} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Orders Now'}
            </Button>
            <Button onClick={() => setActiveTab('settings')}>
              <Settings className="w-4 h-4" /> Settings
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setActiveTab('policies')}>Manage Business Policies</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('logs')}>View integration logs</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setActiveTab('settings')}>Disconnect channel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {oauthResult && (
        <div className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border ${
          oauthResult === 'connected' ? 'bg-green-500/8 border-green-500/30'
          : oauthResult === 'pending' ? 'bg-amber-500/8 border-amber-500/30'
          : 'bg-destructive/8 border-destructive/30'
        }`}>
          <p className="text-sm font-medium text-foreground">
            {oauthResult === 'connected' && "eBay connected — now choose your Business Policies to start listing."}
            {oauthResult === 'pending' && "eBay authorization received — we're finishing setup on our end, check back shortly."}
            {oauthResult === 'denied' && 'eBay connection was cancelled — you can try again anytime.'}
            {oauthResult === 'invalid_state' && 'That eBay connection link expired — please try connecting again.'}
          </p>
          <button onClick={() => setOauthResult(null)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {connection && policiesConfigured === false && (
        <div className="flex items-center justify-between gap-3 bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-600 dark:text-amber-400">Business Policies not set — products can't be listed on eBay yet.</p>
          <button onClick={() => setActiveTab('policies')} className="shrink-0 text-xs font-semibold text-primary hover:underline whitespace-nowrap">
            Set up now
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : connection ? (
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
              channelType="ebay"
              channelLabel="eBay"
              accentColor="#E53238"
              onDisconnected={() => setConnection(null)}
              refreshKey={dashboardRefresh}
            />
          </TabsContent>

          <TabsContent value="policies" className="mt-5">
            <EbayBusinessPoliciesPanel shopId={shopId} onSaved={() => { setPoliciesConfigured(true); }} />
          </TabsContent>

          <TabsContent value="automation" className="mt-5">
            <EbayAutomationPanel shopId={shopId} connectionId={connection.id} />
          </TabsContent>

          <TabsContent value="logs" className="mt-5">
            <ChannelLogsMini shopId={shopId} channelType="ebay" limit={50} />
          </TabsContent>

          <TabsContent value="settings" className="mt-5">
            <div className="max-w-2xl space-y-5">
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div>
                  <p className="text-sm font-bold text-foreground">Seller registered country</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Must match what eBay has on file for your account, or listings fail.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={countryInput}
                    onChange={(e) => setCountryInput(e.target.value)}
                    placeholder={connection.seller_country || 'e.g. Sri Lanka'}
                    className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm"
                  />
                  <button onClick={saveCountry} disabled={savingCountry || !countryInput.trim()}
                    className="shrink-0 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60">
                    {savingCountry ? 'Saving…' : 'Save'}
                  </button>
                </div>
                {connection.seller_country && (
                  <p className="text-xs text-muted-foreground">Currently set to <strong className="text-foreground">{connection.seller_country}</strong>.</p>
                )}
                {countryError && <p className="text-xs text-destructive">{countryError}</p>}
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm font-bold text-foreground mb-1">Marketplace</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Derived from your seller country above — eBay ties one connection to one marketplace, so this isn't a separate switch that could disagree with it.
                </p>
                {marketplace ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">{marketplace.marketplace_label}</p>
                    {marketplace.is_default_fallback && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                        Your registered country isn't one we've explicitly mapped yet, so this defaults to the US marketplace. Contact support if you need a different one added.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm font-bold text-foreground mb-1">Store currency</p>
                <p className="text-xs text-muted-foreground mb-3">What currency your eBay store actually operates in.</p>
                <ChannelCurrencyField shopId={shopId} channelId={connection.id} initialValue={connection.channel_currency} storeName="eBay" />
              </div>

              <div className="bg-card border border-destructive/30 rounded-xl p-5 space-y-3">
                <div>
                  <p className="text-sm font-bold text-destructive">Disconnect eBay</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your eBay listings stay live — they just stop syncing here.</p>
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
                    Disconnect eBay
                  </button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      ) : isTheDersiUser ? (
        <TheDersiRestrictionNotice channelKey="ebay" />
      ) : (
        <BeforeConnectLayout
          accentClass="bg-[#E53238]/10 text-[#E53238]"
          badges={[
            { icon: ShieldCheck, label: 'OAuth secured', desc: "You authorize on eBay's own site — no password shared" },
            { icon: ListChecks, label: 'Tracked in Channel Listings', desc: 'Every listing attempt, success or failure' },
            { icon: FileText, label: 'Manage in Channel Orders', desc: 'eBay orders show up alongside every other channel' },
            { icon: Link2Off, label: 'Disconnect anytime', desc: 'Your eBay account and listings stay untouched' },
          ]}
          sidebar={<>
            <SidebarCard icon={LifeBuoy} iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              title="Need help?" desc={'The real 4-step flow is right below.'}
              action={<a href="#how-it-works" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Jump to "How it works" ↓</a>} />
            <SidebarCard icon={MapPin} iconClass="bg-[#E53238]/10 text-[#E53238]"
              title="Why we ask for your country" desc="eBay rejects listings whose item location doesn't match your account's registered country — we ask directly rather than guessing from your ExiusCart shop's country." />
          </>}
          steps={[
            { icon: ShieldCheck, title: '1. Authorize on eBay', desc: 'Log into your own eBay account.' },
            { icon: CheckCircle2, title: '2. Approve access', desc: "Grant ExiusCart's access request." },
            { icon: RefreshCw, title: '3. Pick Business Policies', desc: 'Choose your payment/fulfillment/return policies.' },
            { icon: ListChecks, title: '4. List & manage', desc: 'Assign products from Channel Categories.' },
          ]}
        >
          <div className="bg-card border border-border rounded-xl">
            <div className="p-5 border-b border-border">
              <p className="font-semibold text-foreground">Connect eBay</p>
              <p className="text-xs text-muted-foreground mt-0.5">List products and manage orders on eBay</p>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Country your eBay seller account is registered under *
                </label>
                <input
                  type="text"
                  value={sellerCountry}
                  onChange={(e) => setSellerCountry(e.target.value)}
                  placeholder="e.g. Sri Lanka, UAE, United States"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  This must match the country eBay has on file for your seller account — not
                  necessarily your ExiusCart shop's country. eBay rejects listings whose item
                  location doesn't match your account's registered country, so we ask directly
                  rather than guessing.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1.5">
                <p><strong className="text-foreground">What happens next:</strong></p>
                <p>• eBay opens in a new tab — log into your own account there</p>
                <p>• Approve ExiusCart's access request</p>
                <p>• Come back to this tab — then choose your Business Policies to finish setup</p>
              </div>
              <button onClick={startAuthorize} disabled={connecting || !sellerCountry.trim()}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {connecting ? 'Opening eBay...' : 'Continue to eBay'}
              </button>
            </div>
          </div>
        </BeforeConnectLayout>
      )}
    </div>
  );
}

// eBay requires every listing to reference a payment/fulfillment/return
// policy ID. These can't be created on the seller's behalf — they encode
// real shipping-cost/return-window decisions — so this fetches the
// seller's existing policies and lets them pick. Moved from a modal into
// its own tab so it's not a one-time gate but a real, revisitable settings
// panel (policies can change on eBay's side anytime).
function EbayBusinessPoliciesPanel({ shopId, onSaved }: { shopId: string; onSaved: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noPolicies, setNoPolicies] = useState(false);
  const [payments, setPayments] = useState<{ id: string; name: string }[]>([]);
  const [fulfillments, setFulfillments] = useState<{ id: string; name: string }[]>([]);
  const [returns, setReturns] = useState<{ id: string; name: string }[]>([]);
  const [paymentId, setPaymentId] = useState('');
  const [fulfillmentId, setFulfillmentId] = useState('');
  const [returnId, setReturnId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true); setError(''); setNoPolicies(false); setSaved(false);
    try {
      const r = await ebayApi.getBusinessPolicies(shopId);
      setPayments(r.data?.payment ?? []);
      setFulfillments(r.data?.fulfillment ?? []);
      setReturns(r.data?.return ?? []);
      const sel = r.data?.selected ?? {};
      setPaymentId(sel.payment_policy_id ?? '');
      setFulfillmentId(sel.fulfillment_policy_id ?? '');
      setReturnId(sel.return_policy_id ?? '');
    } catch (err: any) {
      if (err?.response?.data?.detail?.error === 'no_business_policies') {
        setNoPolicies(true);
      } else {
        setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not load Business Policies.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [shopId]);

  const save = async () => {
    if (!paymentId || !fulfillmentId || !returnId) return;
    setSaving(true); setError('');
    try {
      await ebayApi.saveBusinessPolicies(shopId, {
        payment_policy_id: paymentId,
        fulfillment_policy_id: fulfillmentId,
        return_policy_id: returnId,
      });
      setSaved(true);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not save Business Policies.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl bg-card border border-border rounded-xl">
      <div className="p-5 border-b border-border">
        <p className="font-semibold text-foreground">eBay Business Policies</p>
        <p className="text-xs text-muted-foreground mt-0.5">Choose your payment, shipping & return policies — required before you can list.</p>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Business Policies saved.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Loading your policies...</span>
          </div>
        ) : noPolicies ? (
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium">
              <AlertCircle className="w-4 h-4" /> No Business Policies set up yet
            </div>
            <p className="text-xs text-muted-foreground">
              eBay requires at least one payment, fulfillment (shipping), and return policy before you can list products. Set these up on eBay first, then refresh below.
            </p>
            <a href="https://www.ebay.com/help/selling/business-policies/business-policies-setup" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium">
              Set up Business Policies on eBay <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button type="button" onClick={load}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        ) : (
          <>
            <PolicyRow icon={CreditCard} title="Payment Policy" options={payments} selectedId={paymentId} onChange={setPaymentId} />
            <PolicyRow icon={Truck} title="Fulfillment (Shipping) Policy" options={fulfillments} selectedId={fulfillmentId} onChange={setFulfillmentId} />
            <PolicyRow icon={RotateCcw} title="Return Policy" options={returns} selectedId={returnId} onChange={setReturnId} />

            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Tax Policy</p>
                <p className="text-xs text-muted-foreground mt-0.5">eBay-managed — there's no tax-policy API, so nothing to configure here.</p>
              </div>
              <span className="ml-auto shrink-0 text-[10px] font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground whitespace-nowrap">Using eBay default</span>
            </div>

            <button type="button" onClick={save} disabled={!paymentId || !fulfillmentId || !returnId || saving}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Policies'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PolicyRow({ icon: Icon, title, options, selectedId, onChange }: {
  icon: React.ElementType; title: string; options: { id: string; name: string }[]; selectedId: string; onChange: (id: string) => void;
}) {
  const selected = options.find((o) => o.id === selectedId);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {selected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-2.5 h-2.5" /> Configured
              </span>
            ) : (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">Not set</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{selected ? selected.name : 'Choose a policy →'}</p>
        </div>
      </div>
      <select value={selectedId} onChange={(e) => onChange(e.target.value)}
        className="sm:w-56 shrink-0 px-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-xs">
        <option value="">Select...</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}

const FREQUENCY_OPTIONS = [
  { minutes: 15, label: 'Every 15 minutes' },
  { minutes: 30, label: 'Every 30 minutes' },
  { minutes: 60, label: 'Every hour' },
  { minutes: 180, label: 'Every 3 hours' },
];

// Real, persisted automation settings — a background thread (see main.py's
// eBay auto-sync scheduler) reads exactly these two fields for exactly this
// connection and acts on them. No price/stock/tracking toggles here: the
// shared product-push path (_bg_push_product) already pushes price+stock
// together on every edit with no per-field on/off switch to persist, and
// there's no relist mechanism anywhere in the codebase to gate — a toggle
// for either would just be UI with nothing behind it.
function EbayAutomationPanel({ shopId, connectionId }: { shopId: string; connectionId: number }) {
  const [loading, setLoading] = useState(true);
  const [autoSyncOrders, setAutoSyncOrders] = useState(false);
  const [frequency, setFrequency] = useState(30);
  const [lastAutoSyncedAt, setLastAutoSyncedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    channelsApi.getSyncSettings(shopId, connectionId)
      .then((r) => {
        setAutoSyncOrders(!!r.data?.auto_sync_orders);
        setFrequency(r.data?.sync_frequency_minutes ?? 30);
        setLastAutoSyncedAt(r.data?.last_auto_synced_at ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId, connectionId]);

  const save = async (next: { auto_sync_orders: boolean; sync_frequency_minutes: number }) => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const r = await channelsApi.setSyncSettings(shopId, connectionId, next);
      setAutoSyncOrders(!!r.data?.auto_sync_orders);
      setFrequency(r.data?.sync_frequency_minutes ?? next.sync_frequency_minutes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const nextSyncEta = lastAutoSyncedAt
    ? new Date(new Date(lastAutoSyncedAt).getTime() + frequency * 60000)
    : null;

  return (
    <div className="max-w-xl bg-card border border-border rounded-xl">
      <div className="p-5 border-b border-border">
        <p className="font-semibold text-foreground">Sync Automation</p>
        <p className="text-xs text-muted-foreground mt-0.5">Automatically pull in new eBay orders on a schedule, instead of only when you click "Sync Orders Now".</p>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
        )}
        {saved && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Automation settings saved.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Auto-import new orders</p>
                <p className="text-xs text-muted-foreground mt-0.5">Runs in the background — you don't need this page open.</p>
              </div>
              <Switch
                checked={autoSyncOrders}
                disabled={saving}
                onCheckedChange={(checked) => save({ auto_sync_orders: checked, sync_frequency_minutes: frequency })}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Check for new orders</label>
              <select
                value={frequency}
                disabled={saving || !autoSyncOrders}
                onChange={(e) => save({ auto_sync_orders: autoSyncOrders, sync_frequency_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm disabled:opacity-50"
              >
                {FREQUENCY_OPTIONS.map((f) => <option key={f.minutes} value={f.minutes}>{f.label}</option>)}
              </select>
            </div>

            <div className="bg-muted/50 rounded-lg px-4 py-3 flex items-start gap-2.5">
              <Clock3 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Last auto-sync: <strong className="text-foreground">{lastAutoSyncedAt ? new Date(lastAutoSyncedAt).toLocaleString() : 'Never yet'}</strong></p>
                {autoSyncOrders && (
                  <p>Next check: <strong className="text-foreground">{nextSyncEta ? nextSyncEta.toLocaleString() : 'Within 5 minutes'}</strong></p>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Prices and stock already push to eBay automatically whenever you edit a listed product — that's not something to toggle separately.
              There's no eBay auto-relist feature built yet, so it isn't offered here.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
