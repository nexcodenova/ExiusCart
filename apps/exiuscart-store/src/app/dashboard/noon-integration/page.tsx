'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ShoppingBag, Loader2, CheckCircle2, Warehouse, RefreshCw, AlertCircle,
} from 'lucide-react';
import { channelsApi, noonApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  channel_seller_id?: string;
  channel_warehouse_code?: string | null;
}

export default function NoonIntegrationPage() {
  const [shopId, setShopId] = useState('');
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [keyId, setKeyId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [channelIdentifier, setChannelIdentifier] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const [warehouses, setWarehouses] = useState<{ warehouse_code: string; name?: string }[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    channelsApi.getConnections(shopId)
      .then((r) => {
        const conns: ChannelConnection[] = r.data ?? [];
        const conn = conns.find((c) => c.channel_type === 'noon') ?? null;
        setConnection(conn);
        if (conn && !conn.channel_warehouse_code) loadWarehouses();
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyId.trim() || !privateKey.trim() || !channelIdentifier.trim() || !projectCode.trim()) return;
    setConnecting(true); setError('');
    try {
      await noonApi.connect(shopId, {
        key_id: keyId.trim(),
        private_key: privateKey.trim(),
        channel_identifier: channelIdentifier.trim(),
        project_code: projectCode.trim(),
      });
      load();
      loadWarehouses();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Connection failed — double-check your credentials and try again.');
    } finally {
      setConnecting(false);
    }
  };

  const loadWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const r = await noonApi.listWarehouses(shopId);
      setWarehouses(r.data?.warehouses ?? []);
    } catch {
      setWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const saveWarehouse = async () => {
    if (!selectedWarehouse) return;
    setSavingWarehouse(true);
    try {
      await noonApi.setWarehouse(shopId, selectedWarehouse);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not save warehouse. Try again.');
    } finally {
      setSavingWarehouse(false);
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
        <h1 className="text-xl font-semibold text-foreground">Noon Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">UAE / KSA / GCC's biggest marketplace — products, stock, and orders sync to ExiusCart.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : connection ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Noon</p>
                <p className="text-xs text-muted-foreground">UAE / KSA / GCC Marketplace</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>
          <div className="p-5 space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Account: <strong className="text-foreground font-mono text-xs">{connection.channel_seller_id}</strong></p>
              {connection.channel_warehouse_code ? (
                <p className="flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5" /> Warehouse: <strong className="text-foreground font-mono text-xs">{connection.channel_warehouse_code}</strong>
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-600 dark:text-amber-400">No warehouse selected — products/stock can't sync yet</p>
                  </div>
                  {loadingWarehouses ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Loading your warehouses...</span>
                    </div>
                  ) : warehouses.length === 0 ? (
                    <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium">
                        <AlertCircle className="w-4 h-4" /> No warehouse set up yet
                      </div>
                      <p className="text-xs text-muted-foreground">
                        You need at least one warehouse on your Noon account before products/stock can sync — either your own licensed location, or Noon's own consolidation center if you don't have a UAE/KSA trade license. Set this up on your Noon Partners dashboard, then refresh below.
                      </p>
                      <button type="button" onClick={loadWarehouses}
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {warehouses.map((w) => (
                        <label key={w.warehouse_code}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition ${
                            selectedWarehouse === w.warehouse_code ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                          }`}>
                          <input type="radio" name="warehouse" value={w.warehouse_code}
                            checked={selectedWarehouse === w.warehouse_code}
                            onChange={() => setSelectedWarehouse(w.warehouse_code)} />
                          <Warehouse className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate">{w.name || w.warehouse_code}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{w.warehouse_code}</p>
                          </div>
                        </label>
                      ))}
                      <button type="button" onClick={saveWarehouse} disabled={!selectedWarehouse || savingWarehouse}
                        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                        {savingWarehouse && <Loader2 className="w-4 h-4 animate-spin" />}
                        {savingWarehouse ? 'Saving...' : 'Save & Finish'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="pt-3 border-t border-border">
              {confirming ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">Disconnect Noon? Your listings stay on Noon, but they stop syncing here.</p>
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
                  Disconnect Noon
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <p className="font-semibold text-foreground">Connect Noon</p>
            <p className="text-xs text-muted-foreground mt-0.5">Paste your own Noon service account key</p>
          </div>
          <form onSubmit={connect} className="p-5 space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1.5">
              <p><strong className="text-foreground">Don't have these yet?</strong></p>
              <p>1. Go to your Noon Partners dashboard → API Users → Add Service Account</p>
              <p>2. Download the credentials JSON — it has all 4 fields below</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Key ID *</label>
              <input type="text" value={keyId} onChange={(e) => setKeyId(e.target.value)} required
                placeholder="noon-partners-key-id-..."
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm font-mono" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Private Key *</label>
              <textarea value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} required rows={4}
                placeholder="-----BEGIN PRIVATE KEY-----..."
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-xs font-mono" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Channel Identifier *</label>
              <input type="text" value={channelIdentifier} onChange={(e) => setChannelIdentifier(e.target.value)} required
                placeholder="yourkey@p123456.idp.noon.partners"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm font-mono" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Project Code *</label>
              <input type="text" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} required
                placeholder="PRJ123456"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-sm font-mono" />
            </div>
            <button type="submit" disabled={connecting}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
              {connecting ? 'Verifying...' : 'Connect Noon'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
