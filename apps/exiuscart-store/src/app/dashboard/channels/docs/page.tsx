'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Link2, ShieldCheck, RefreshCw, Settings2, KeyRound, ExternalLink, Globe, FileText,
  CheckCircle2, AlertTriangle, BookOpen, Webhook,
} from 'lucide-react';
import { channelsApi } from '@/lib/api';
import ChannelLogo from '@/components/channels/ChannelLogo';
import { channelMeta } from '@/components/channels/channelMeta';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

// Every channel that's actually connectable today — matches the real
// availableChannels list on the directory page (no "Coming Soon" ones,
// since there's nothing real yet to document for those). No live status
// here on purpose (Connected/listing counts/last sync) — that's the
// directory page's job; this is a static reference, so it never needs a
// data fetch and can't go stale.
const CHANNELS: { key: string; category: string; method: 'OAuth' | 'API key'; path: string }[] = [
  { key: 'shopify', category: 'eCommerce Platform', method: 'OAuth', path: 'shopify' },
  { key: 'etsy', category: 'Marketplace', method: 'OAuth', path: 'etsy' },
  { key: 'custom', category: 'Your Own Store', method: 'API key', path: 'custom-website' },
  { key: 'woocommerce', category: 'eCommerce Platform', method: 'API key', path: 'woocommerce' },
  { key: 'bigcommerce', category: 'eCommerce Platform', method: 'OAuth', path: 'bigcommerce' },
  { key: 'ebay', category: 'Marketplace', method: 'OAuth', path: 'ebay' },
  { key: 'tiktok', category: 'Social Commerce', method: 'OAuth', path: 'tiktok' },
  { key: 'noon', category: 'Marketplace', method: 'API key', path: 'noon' },
  { key: 'daraz', category: 'Marketplace', method: 'OAuth', path: 'daraz' },
  { key: 'thedersi', category: 'Marketplace', method: 'API key', path: 'thedersi' },
  { key: 'whop', category: 'Digital Products', method: 'API key', path: 'whop' },
  { key: 'gumroad', category: 'Digital Products', method: 'API key', path: 'gumroad' },
];

const ACTION_LABELS: Record<string, string> = {
  create_listing: 'Listing created', update_stock: 'Stock updated',
  update_price: 'Price updated', sync_order: 'Order synced',
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface SyncLog {
  id: number; channel_type: string; action: string; success: boolean;
  error_message: string | null; created_at: string;
}
interface Connection {
  channel_type: string; seller_status: string | null;
}

export default function ChannelDocsPage() {
  const [shopId, setShopId] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [recentActivity, setRecentActivity] = useState<SyncLog[]>([]);
  const [failures, setFailures] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    Promise.all([
      channelsApi.getConnections(shopId).then((r) => setConnections(r.data ?? [])).catch(() => setConnections([])),
      channelsApi.getSyncLogs(shopId, { success: true, limit: 5 }).then((r) => setRecentActivity(r.data ?? [])).catch(() => setRecentActivity([])),
      channelsApi.getSyncLogs(shopId, { success: false, limit: 5 }).then((r) => setFailures(r.data ?? [])).catch(() => setFailures([])),
    ]).finally(() => setLoading(false));
  }, [shopId]);

  // Real issues only: a channel partner marking the seller suspended/
  // rejected, or an actual failed sync attempt — nothing fabricated like a
  // fake "API key expired" unless a real log says so.
  const accountIssues = connections.filter((c) => c.seller_status === 'suspended' || c.seller_status === 'rejected');

  return (
    <div className="max-w-[1500px] mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold text-primary">Sales Channels <span className="mx-1 text-muted-foreground">/</span> Documentation</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">How connecting a sales channel works</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          The real mechanics behind "Connect Channel" — what each step actually does, what's automatic versus manual, and where your credentials go. For exact setup steps for one channel, open that channel's own page — this is the general model underneath all of them.
        </p>
      </div>

      {/* Three-step model — full width */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
            <Link2 className="w-4 h-4 text-primary" />
          </div>
          <p className="font-semibold text-foreground text-sm">1. Connect</p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Either you're redirected to the channel to authorize ExiusCart (<strong className="text-foreground">OAuth</strong> — Shopify, Etsy, eBay, Daraz, TikTok, BigCommerce), or you paste API credentials from that channel's own developer settings (<strong className="text-foreground">API key</strong> — WooCommerce, Noon, TheDersi, Whop, Gumroad, Custom Website). Each channel's own page tells you which, and walks through it.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
            <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="font-semibold text-foreground text-sm">2. Synchronize</p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Inventory pushes out automatically the moment stock actually changes (a sale, a manual edit) — not on a timer. Orders come back in one of two ways: pushed to ExiusCart instantly via webhook the moment a customer buys (Shopify, and any channel using ExiusCart's inbound webhook URL), or pulled in when you hit "Sync Orders" on that channel's page. There's no background scheduler running periodic syncs behind the scenes — every pull-based sync is something you (or a webhook) actually triggered.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
            <Settings2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-semibold text-foreground text-sm">3. Manage</p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Every order that comes in through a channel shows up in <Link href="/dashboard/orders" className="text-primary hover:underline">Orders</Link> and <Link href="/dashboard/channels/orders" className="text-primary hover:underline">Channel Orders</Link>; every listing attempt (success or failure) is logged in <Link href="/dashboard/channels/listings" className="text-primary hover:underline">Channel Listings</Link>. Disconnecting a channel from its own page stops new syncs — it doesn't delete orders or products you already have.
          </p>
        </div>
      </div>

      {/* Security (left) + real live-data sidebar (right) — the sidebar
          starts here, not up at the header, so it doesn't dangle half-empty
          next to a much taller main column further down. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Where your credentials actually go</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground leading-relaxed">
            <div className="flex gap-2.5">
              <KeyRound className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p>API keys you paste in are encrypted before they're stored — ExiusCart's own staff can't read them back out in plain text, and they're never shown again in full after you save them.</p>
            </div>
            <div className="flex gap-2.5">
              <Link2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p>OAuth connections never hand ExiusCart your channel password — you authorize on the channel's own site, and only an access token (revocable any time, from that channel's own settings) comes back to ExiusCart.</p>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{loading ? '—' : connections.length}</p>
                <p className="text-xs text-muted-foreground">Channel{connections.length === 1 ? '' : 's'} connected right now</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">Recent Sync Activity</h2>
            {loading ? (
              <p className="text-xs text-muted-foreground py-2">Loading…</p>
            ) : recentActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nothing synced yet — this fills in once a channel pushes or pulls something real.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex items-center gap-2.5">
                    <ChannelLogo channelType={log.channel_type} size={18} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{channelMeta(log.channel_type).label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{ACTION_LABELS[log.action] ?? log.action}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{timeAgo(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(failures.length > 0 || accountIssues.length > 0) && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <h2 className="text-sm font-bold text-foreground">Issues Needing Attention</h2>
              </div>
              <div className="space-y-3">
                {accountIssues.map((c) => (
                  <div key={c.channel_type} className="flex items-center gap-2.5">
                    <ChannelLogo channelType={c.channel_type} size={18} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{channelMeta(c.channel_type).label}</p>
                      <p className="text-[11px] text-destructive capitalize">Account {c.seller_status} by the channel</p>
                    </div>
                  </div>
                ))}
                {failures.map((log) => (
                  <div key={log.id} className="flex items-center gap-2.5">
                    <ChannelLogo channelType={log.channel_type} size={18} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{channelMeta(log.channel_type).label}</p>
                      <p className="text-[11px] text-destructive truncate">{log.error_message || `${ACTION_LABELS[log.action] ?? log.action} failed`}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{timeAgo(log.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">Developer &amp; API</h2>
            <div className="space-y-2">
              <Link href="/dashboard/channels/integrations/custom-website" className="flex items-center gap-2.5 text-xs font-medium text-foreground hover:text-primary transition">
                <BookOpen className="w-4 h-4 text-muted-foreground" /> API Documentation
              </Link>
              <Link href="/dashboard/channels/integrations/custom-website" className="flex items-center gap-2.5 text-xs font-medium text-foreground hover:text-primary transition">
                <Webhook className="w-4 h-4 text-muted-foreground" /> Webhooks (order push-in)
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Per-channel cards — full page width now, not squeezed into a
          two-thirds column */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3">Every channel, and how it connects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CHANNELS.map((c) => {
            const meta = channelMeta(c.key);
            return (
              <div key={c.key} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <ChannelLogo channelType={c.key} size={24} />
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${c.method === 'OAuth' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                    {c.method}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{c.category}</p>
                </div>
                <Link href={`/dashboard/channels/integrations/${c.path}`}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold border border-border rounded-lg py-2 hover:bg-muted transition">
                  <FileText className="w-3.5 h-3.5" /> View Docs
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Different audience: developers building the storefront itself */}
      <div className="rounded-xl border border-border bg-muted/30 p-5 flex items-start gap-4">
        <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
          <Globe className="w-4 h-4 text-sky-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground text-sm">Building the storefront yourself, not just connecting it?</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            This page is for sellers connecting an existing channel. If you're a developer building a Custom Website's actual storefront pages against ExiusCart's API, that's a separate reference — the real public endpoints (products, checkout, customer accounts) with request/response shapes, on the Custom Website integration page.
          </p>
          <Link href="/dashboard/channels/integrations/custom-website"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-primary hover:underline">
            Open Custom Website → Developer Docs <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
