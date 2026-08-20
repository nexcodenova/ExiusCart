'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Tag, Loader2, CheckCircle2, ExternalLink, X, AlertCircle, RefreshCw,
} from 'lucide-react';
import { channelsApi, ebayApi } from '@/lib/api';
import { ChannelCurrencyField } from '@/components/channels/ChannelCurrencyField';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  channel_seller_id?: string;
  seller_country?: string | null;
  channel_currency?: string | null;
}

export default function EbayIntegrationPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [oauthResult, setOauthResult] = useState<string | null>(null);

  const [sellerCountry, setSellerCountry] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const [countryInput, setCountryInput] = useState('');
  const [savingCountry, setSavingCountry] = useState(false);
  const [countryError, setCountryError] = useState('');

  const [policiesConfigured, setPoliciesConfigured] = useState<boolean | null>(null);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);

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
    router.replace('/dashboard/ebay-integration');
    load();
    if (result === 'connected') setShowPoliciesModal(true);
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
    } catch (err: any) {
      setCountryError(err?.response?.data?.detail ?? 'Could not save. Try again.');
    } finally {
      setSavingCountry(false);
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
        <h1 className="text-xl font-semibold text-foreground">eBay Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">List products on eBay and manage all orders directly from ExiusCart.</p>
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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : connection ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#E53238]/10 flex items-center justify-center">
                <Tag className="w-4 h-4 text-[#E53238]" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">eBay</p>
                <p className="text-xs text-muted-foreground">Global Marketplace</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>
          <div className="p-5 text-sm text-muted-foreground space-y-3">
            <p>Seller: <strong className="text-foreground">{connection.channel_seller_id || 'eBay account connected'}</strong></p>
            {connection.seller_country ? (
              <p className="text-xs">Seller registered country: <strong className="text-foreground">{connection.seller_country}</strong></p>
            ) : (
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2 space-y-2">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Seller registered country not set — listings will fail until this matches what eBay has on file for your account.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={countryInput}
                    onChange={(e) => setCountryInput(e.target.value)}
                    placeholder="e.g. Sri Lanka"
                    className="flex-1 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs"
                  />
                  <button onClick={saveCountry} disabled={savingCountry || !countryInput.trim()}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60">
                    {savingCountry ? 'Saving…' : 'Save'}
                  </button>
                </div>
                {countryError && <p className="text-xs text-destructive">{countryError}</p>}
              </div>
            )}
            <ChannelCurrencyField shopId={shopId} channelId={connection.id} initialValue={connection.channel_currency} storeName="eBay" />
            {policiesConfigured === false ? (
              <div className="flex items-center justify-between gap-3 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-600 dark:text-amber-400">Business Policies not set — products can't be listed yet</p>
                <button onClick={() => setShowPoliciesModal(true)} className="shrink-0 text-xs text-primary hover:text-primary/80 font-medium whitespace-nowrap">
                  Choose
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs">Orders syncing from eBay automatically</p>
                <button onClick={() => setShowPoliciesModal(true)} className="shrink-0 text-xs text-primary hover:text-primary/80 font-medium whitespace-nowrap">
                  Manage Business Policies
                </button>
              </div>
            )}

            <div className="pt-3 mt-1 border-t border-border">
              {confirming ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">Disconnect eBay? Your listings stay on eBay, but they stop syncing here.</p>
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
                  Disconnect eBay
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
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
      )}

      {showPoliciesModal && (
        <EbayBusinessPoliciesModal
          shopId={shopId}
          onSaved={() => { setPoliciesConfigured(true); load(); }}
          onClose={() => setShowPoliciesModal(false)}
        />
      )}
    </div>
  );
}

// eBay requires every listing to reference a payment/fulfillment/return
// policy ID. These can't be created on the seller's behalf — they encode
// real shipping-cost/return-window decisions — so this fetches the
// seller's existing policies and lets them pick.
function EbayBusinessPoliciesModal({ shopId, onSaved, onClose }: {
  shopId: string; onSaved: () => void; onClose: () => void;
}) {
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

  const load = async () => {
    setLoading(true); setError(''); setNoPolicies(false);
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

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!paymentId || !fulfillmentId || !returnId) return;
    setSaving(true); setError('');
    try {
      await ebayApi.saveBusinessPolicies(shopId, {
        payment_policy_id: paymentId,
        fulfillment_policy_id: fulfillmentId,
        return_policy_id: returnId,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not save Business Policies.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="font-semibold text-foreground">eBay Business Policies</p>
            <p className="text-xs text-muted-foreground mt-0.5">Choose your payment, shipping & return policies</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
              {error}
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
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Payment Policy *</label>
                <select value={paymentId} onChange={(e) => setPaymentId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm">
                  <option value="">Select...</option>
                  {payments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Fulfillment (Shipping) Policy *</label>
                <select value={fulfillmentId} onChange={(e) => setFulfillmentId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm">
                  <option value="">Select...</option>
                  {fulfillments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Return Policy *</label>
                <select value={returnId} onChange={(e) => setReturnId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm">
                  <option value="">Select...</option>
                  {returns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
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
    </div>
  );
}
