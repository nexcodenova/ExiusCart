'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Link2, Loader2, CheckCircle2, X,
} from 'lucide-react';
import { channelsApi } from '@/lib/api';
import { CopyBox } from '@/components/channels/CopyBox';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  webhook_url: string;
  seller_status?: string | null;
}

export default function TheDersiIntegrationPage() {
  const [shopId, setShopId] = useState('');
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [sellerId, setSellerId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

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
    setDisconnecting(true);
    try {
      await channelsApi.disconnectChannel(shopId, connection!.id);
      setConnection(null);
      setConfirming(false);
    } finally {
      setDisconnecting(false);
    }
  };

  const isSuspended = connection?.seller_status === 'suspended';
  const isRejected = connection?.seller_status === 'rejected';
  const isRestricted = isSuspended || isRejected;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/channels" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" /> Back to Channels
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-foreground">TheDersi Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">Sri Lankan Fashion Marketplace — get credentials from thedersi.lk/seller/connect.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : connection && !webhookUrl ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isRestricted ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                <Link2 className={`w-4 h-4 ${isRestricted ? 'text-red-500' : 'text-primary'}`} />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">TheDersi</p>
                <p className="text-xs text-muted-foreground">Sri Lankan Fashion Marketplace</p>
              </div>
            </div>
            {isRestricted ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                <X className="w-3 h-3" /> {isSuspended ? 'Suspended' : 'Not Approved'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            )}
          </div>

          {isRestricted && (
            <div className="mx-5 mt-5 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-lg">
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

          <div className="p-5 space-y-4">
            <CopyBox label="Your ExiusCart Webhook URL" value={connection.webhook_url} />
            {!isRestricted && (
              <Link href="/dashboard/payout"
                className="flex items-center justify-center gap-2 w-full py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">
                View Payouts & Earnings →
              </Link>
            )}
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
        </div>
      ) : webhookUrl ? (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
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
          <Link href="/dashboard/channels"
            className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition text-center">
            Done
          </Link>
        </div>
      ) : (
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
      )}
    </div>
  );
}
