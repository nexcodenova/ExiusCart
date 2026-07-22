'use client';

import { useState, useEffect } from 'react';
import { ListChecks, CheckCircle2, XCircle, Loader2, RefreshCw, ShoppingBag, Link2 } from 'lucide-react';
import Link from 'next/link';
import { channelsApi } from '@/lib/api';

interface SyncLog {
  id: number;
  product_id: number | null;
  product_name: string | null;
  channel_type: string;
  action: string;
  success: boolean;
  external_id: string | null;
  error_message: string | null;
  created_at: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  noon: 'Noon',
  daraz: 'Daraz',
  thedersi: 'TheDersi',
  shopify: 'Shopify',
};

const ACTION_LABELS: Record<string, string> = {
  create_listing: 'Create Listing',
  update_stock: 'Update Stock',
  update_price: 'Update Price',
  sync_order: 'Sync Order',
};

function shopIdFromStorage() { return localStorage.getItem('shop_id') || ''; }

export default function ChannelListingsPage() {
  const [shopId, setShopId] = useState('');
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'success' | 'failed'>('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    setLoading(true);
    channelsApi.getSyncLogs(shopId, {
      channel_type: channelFilter || undefined,
      success: statusFilter === '' ? undefined : statusFilter === 'success',
      limit: 200,
    })
      .then((res) => setLogs(res.data ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId, channelFilter, statusFilter]);

  const failedCount = logs.filter((l) => !l.success).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" /> Channel Listings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every listing, stock, and price sync attempt across all your channels — see what worked and what failed, in one place.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total attempts (last 200)</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{loading ? '—' : logs.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className={`text-2xl font-bold mt-1 ${failedCount > 0 ? 'text-red-500' : 'text-foreground'}`}>{loading ? '—' : failedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}
          className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none">
          <option value="">All channels</option>
          <option value="noon">Noon</option>
          <option value="daraz">Daraz</option>
          <option value="thedersi">TheDersi</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none">
          <option value="">All statuses</option>
          <option value="success">Success only</option>
          <option value="failed">Failed only</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center">
            <ListChecks className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">No sync activity yet</h3>
            <p className="text-sm text-muted-foreground mb-5">Once you list a product on Noon or another channel, attempts show up here.</p>
            <Link href="/dashboard/channels" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium">
              <Link2 className="w-4 h-4" /> Go to Channels
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {['Product', 'Channel', 'Action', 'Status', 'Details', 'When'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition">
                    <td className="px-4 py-3 text-foreground">
                      {log.product_id ? (
                        <Link href={`/dashboard/products?edit=${log.product_id}`} className="hover:text-primary transition">
                          {log.product_name || `Product #${log.product_id}`}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                        <ShoppingBag className="w-3 h-3" /> {CHANNEL_LABELS[log.channel_type] || log.channel_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{ACTION_LABELS[log.action] || log.action}</td>
                    <td className="px-4 py-3">
                      {log.success ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[280px] truncate" title={log.error_message ?? log.external_id ?? ''}>
                      {log.error_message || log.external_id || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
