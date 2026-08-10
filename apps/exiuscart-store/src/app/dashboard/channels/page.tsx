'use client';

import { useState, useEffect } from 'react';
import {
  Link2, Loader2,
  X, ExternalLink,
  ShoppingBag, Globe, ShoppingCart, Package, Instagram, Tag, Music2,
} from 'lucide-react';
import { channelsApi, shopifyApi, subscriptionApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
}

// ── Channel tile for available-but-not-connected channels ─────────────────────

interface ChannelDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  badge: 'live' | 'connect' | 'soon' | 'locked';
  badgeLabel?: string;
  onAction?: () => void;
  actionLabel?: string;
}

function ChannelTile({ ch }: { ch: ChannelDef }) {
  const badgeStyles: Record<string, string> = {
    live: 'bg-green-500/10 text-green-600 dark:text-green-400',
    connect: 'bg-primary/10 text-primary',
    soon: 'bg-muted text-muted-foreground',
    locked: 'bg-muted/80 text-muted-foreground/70',
  };
  const dotStyles: Record<string, string> = {
    live: 'bg-green-500',
    connect: 'bg-primary',
    soon: 'bg-muted-foreground/40',
    locked: 'bg-muted-foreground/40',
  };
  const badgeLabels: Record<string, string> = {
    live: 'Live',
    connect: 'Available',
    soon: 'Coming Soon',
    locked: 'Not on your plan',
  };
  return (
    <div className={`group relative bg-card border rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.03] hover:-translate-y-0.5 ${
      ch.badge === 'live' ? 'border-green-500/25 bg-gradient-to-br from-green-500/[0.04] to-transparent' : 'border-border hover:border-primary/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="w-12 h-12 rounded-2xl bg-muted/70 ring-1 ring-border flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:ring-primary/20 transition-all duration-200">
          {ch.icon}
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${badgeStyles[ch.badge]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[ch.badge]}`} />
          {ch.badgeLabel ?? badgeLabels[ch.badge]}
        </span>
      </div>
      <div className="flex-1">
        <p className="font-semibold text-foreground text-sm">{ch.name}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ch.description}</p>
      </div>
      {ch.onAction && ch.badge !== 'soon' && ch.badge !== 'locked' && (
        <button type="button" onClick={ch.onAction}
          className="w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition flex items-center justify-center gap-1.5">
          {ch.actionLabel ?? 'Connect'} <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
      {ch.onAction && ch.badge === 'locked' && (
        <button type="button" onClick={ch.onAction}
          className="w-full py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-muted transition text-muted-foreground">
          {ch.actionLabel ?? 'Upgrade to Premium'}
        </button>
      )}
      {ch.onAction && ch.badge === 'soon' && (
        <button type="button" onClick={ch.onAction}
          className="w-full py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-muted transition text-muted-foreground">
          Learn more
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
//
// Every real connect/manage flow now lives on its own dedicated page
// (/dashboard/*-integration), same pattern Shopify already used. This page
// is just the directory: a grid of tiles that route there, plus the
// plan-gating explainers (locked/upgrade/TheDersi-block) that make sense
// to show inline without leaving this list.

export default function ChannelsPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [ebayLocked, setEbayLocked] = useState(false);
  const [dersiBlockChannel, setDersiBlockChannel] = useState<string | null>(null);
  const [darazLocked, setDarazLocked] = useState(false);
  const [upgradeLimitModal, setUpgradeLimitModal] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [plan, setPlan] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    Promise.all([
      channelsApi.getConnections(shopId).then((r) => setConnections(r.data ?? [])),
      shopifyApi.getStatus(shopId).then((r) => setShopifyConnected(r.data?.connected ?? false)).catch(() => {}),
      subscriptionApi.getCurrent(shopId).then((r) => setPlan(r.data?.plan?.plan_type || '')).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const hasTheDersi = connections.some((c) => c.channel_type === 'thedersi');
  const hasDaraz = connections.some((c) => c.channel_type === 'daraz');
  const hasNoon = connections.some((c) => c.channel_type === 'noon');
  const hasEbay = connections.some((c) => c.channel_type === 'ebay');
  const hasCustomWebsite = connections.some((c) => c.channel_type === 'custom');
  // Detected via an active TheDersi connection, not plan_type — TheDersi's
  // Growth/Premium tier maps to plan='starter', same as a direct customer,
  // so a plan-string check alone would miss those sellers.
  const isTheDersiUser = hasTheDersi;
  const isPremium = plan === 'premium';
  // Count Shopify separately since it's tracked via a different API
  const totalChannelCount = connections.length + (shopifyConnected ? 1 : 0);
  // Free trial + Starter = max 1 channel; Premium = unlimited
  const channelLimitReached = plan !== '' && !isPremium && !isTheDersiUser && totalChannelCount >= 1;
  // Daraz: TheDersi Pro or Premium only
  const canUseDaraz = ['thedersi_pro', 'premium'].includes(plan);
  // Noon is direct-ExiusCart only — TheDersi sellers (Basic or Pro) get
  // TheDersi + Daraz and nothing else, same rule as Shopify/Custom Website.
  // eBay follows that same "ExiusCart direct only" rule (unlike Daraz) —
  // its Business-Policies + multi-marketplace flow doesn't fit TheDersi's
  // managed-seller model, so it's gated exactly like Shopify/Custom Website.
  const canUseEbay = plan === 'premium' && !isTheDersiUser;

  const availableChannels: ChannelDef[] = [
    // ── Row 1: TheDersi + Daraz (the two channels TheDersi sellers can use) ──
    {
      id: 'thedersi',
      name: 'TheDersi',
      description: "List products on Sri Lanka's #1 fashion marketplace. Orders sync automatically to your dashboard.",
      icon: <Link2 className="w-5 h-5 text-primary" />,
      badge: hasTheDersi ? 'live' : (channelLimitReached ? 'locked' : 'connect'),
      badgeLabel: hasTheDersi ? 'Connected' : (channelLimitReached ? 'Upgrade to Premium' : 'Available'),
      onAction: channelLimitReached && !hasTheDersi
        ? () => setUpgradeLimitModal(true)
        : () => router.push('/dashboard/thedersi-integration'),
      actionLabel: hasTheDersi ? 'Manage TheDersi' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect TheDersi'),
    },
    {
      id: 'daraz',
      name: 'Daraz',
      description: "Sri Lanka's #1 marketplace. Orders sync to ExiusCart automatically — manage everything from one dashboard.",
      icon: <ShoppingBag className="w-5 h-5 text-orange-500" />,
      badge: hasDaraz ? 'live' : canUseDaraz ? 'connect' : 'locked',
      badgeLabel: hasDaraz ? 'Connected' : canUseDaraz ? 'Available' : (isTheDersiUser ? 'TheDersi Pro only' : 'Premium only'),
      onAction: hasDaraz || canUseDaraz
        ? () => router.push('/dashboard/daraz-integration')
        : () => setDarazLocked(true),
      actionLabel: hasDaraz ? 'Manage Daraz' : 'Connect Daraz',
    },
    {
      id: 'noon',
      name: 'Noon',
      description: "UAE/KSA/GCC's biggest marketplace. Paste your own Noon service account key to connect — products, stock, and orders sync to ExiusCart.",
      icon: <ShoppingBag className="w-5 h-5 text-yellow-500" />,
      badge: hasNoon ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: hasNoon ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: hasNoon
        ? () => router.push('/dashboard/noon-integration')
        : isTheDersiUser
          ? () => setDersiBlockChannel('Noon')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/noon-integration'),
      actionLabel: hasNoon ? 'Manage Noon' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Noon')),
    },
    // ── Row 2: Shopify + Custom Website (direct-ExiusCart channels) ──
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Sync your Shopify store — products, orders, and inventory stay in sync automatically.',
      icon: <ShoppingBag className="w-5 h-5 text-[#96BF48]" />,
      badge: shopifyConnected ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: shopifyConnected ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: shopifyConnected
        ? () => router.push('/dashboard/shopify-integration')
        : isTheDersiUser
          ? () => setDersiBlockChannel('Shopify')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/shopify-integration'),
      actionLabel: shopifyConnected ? 'Manage Shopify' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Shopify')),
    },
    {
      id: 'custom_website',
      name: 'Custom Website',
      description: 'Connect any website using our API or webhook. Receive orders directly from your own storefront.',
      icon: <Globe className="w-5 h-5 text-sky-400" />,
      badge: hasCustomWebsite ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: hasCustomWebsite ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: hasCustomWebsite
        ? () => router.push('/dashboard/custom-website-integration')
        : isTheDersiUser
          ? () => setDersiBlockChannel('Custom Website')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/custom-website-integration'),
      actionLabel: hasCustomWebsite ? 'Manage Website' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Website')),
    },
    // ── Row 3+: Amazon, eBay & all other channels ──
    {
      id: 'amazon',
      name: 'Amazon',
      description: 'List and manage your Amazon products and orders through ExiusCart.',
      icon: <Package className="w-5 h-5 text-orange-400" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Amazon') : undefined,
    },
    {
      id: 'ebay',
      name: 'eBay',
      description: 'List products on eBay and manage all orders directly from ExiusCart.',
      icon: <Tag className="w-5 h-5 text-[#E53238]" />,
      badge: hasEbay ? 'live' : (isTheDersiUser ? 'locked' : (canUseEbay ? 'connect' : 'locked')),
      badgeLabel: hasEbay ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (canUseEbay ? 'Available' : 'Premium only')),
      onAction: hasEbay
        ? () => router.push('/dashboard/ebay-integration')
        : isTheDersiUser
          ? () => setDersiBlockChannel('eBay')
          : canUseEbay
            ? () => router.push('/dashboard/ebay-integration')
            : () => setEbayLocked(true),
      actionLabel: hasEbay ? 'Manage eBay' : (isTheDersiUser ? 'Learn more' : (canUseEbay ? 'Connect eBay' : 'Upgrade to Premium')),
    },
    {
      id: 'tiktok',
      name: 'TikTok Shop',
      description: 'Sell directly on TikTok. Orders sync to ExiusCart, stock stays in sync automatically.',
      icon: <Music2 className="w-5 h-5 text-[#010101] dark:text-white" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('TikTok Shop') : undefined,
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      description: 'WordPress + WooCommerce integration. Install the ExiusCart plugin to sync products and orders.',
      icon: <ShoppingCart className="w-5 h-5 text-[#7F54B3]" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('WooCommerce') : undefined,
    },
    {
      id: 'instagram',
      name: 'Instagram Shopping',
      description: 'Tag products in your Instagram posts and stories. Orders sync to ExiusCart.',
      icon: <Instagram className="w-5 h-5 text-pink-400" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Instagram Shopping') : undefined,
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sales Channels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect marketplaces and storefronts to sell everywhere from one dashboard.
        </p>
      </div>

      {/* Plan limit banner for free/starter users */}
      {!loading && !isTheDersiUser && !isPremium && plan !== '' && (
        <div className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border ${channelLimitReached ? 'bg-amber-500/8 border-amber-500/30' : 'bg-muted/60 border-border'}`}>
          <div>
            <p className={`text-sm font-semibold ${channelLimitReached ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
              {channelLimitReached ? '1 channel slot used — limit reached' : '1 channel slot available on your plan'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {channelLimitReached
                ? 'Upgrade to Premium to connect all channels — Shopify, Daraz, TheDersi, Noon & more.'
                : 'Free Trial & Starter plans include 1 channel. Upgrade to Premium for all channels.'}
            </p>
          </div>
          <Link href="/dashboard/billing"
            className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition whitespace-nowrap">
            Upgrade to Premium
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading channels...</span>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">All Channels</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableChannels.map((ch) => (
              <ChannelTile key={ch.id} ch={ch} />
            ))}
          </div>
        </div>
      )}

      {ebayLocked && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E53238]/10 flex items-center justify-center shrink-0">
                <Tag className="w-5 h-5 text-[#E53238]" />
              </div>
              <button type="button" onClick={() => setEbayLocked(false)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-foreground">eBay Integration</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                eBay sync is available on Premium plans. Upgrade to ExiusCart Premium to connect your eBay seller account.
              </p>
            </div>
            <Link href="/dashboard/billing" onClick={() => setEbayLocked(false)}
              className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition text-center">
              Upgrade to Premium
            </Link>
          </div>
        </div>
      )}

      {darazLocked && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5 text-orange-500" />
              </div>
              <button type="button" onClick={() => setDarazLocked(false)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-foreground">Daraz Integration</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {isTheDersiUser
                  ? 'Daraz sync is available on TheDersi Pro. Upgrade your TheDersi plan to connect your Daraz seller account.'
                  : 'Daraz sync is available on Premium plans. Upgrade to ExiusCart Premium to connect your Daraz seller account.'}
              </p>
            </div>
            <button type="button" onClick={() => setDarazLocked(false)}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
              Got it
            </button>
          </div>
        </div>
      )}

      {dersiBlockChannel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <button type="button" onClick={() => setDersiBlockChannel(null)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-foreground">{dersiBlockChannel}</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {dersiBlockChannel} is only available for direct ExiusCart sellers. Your store is managed by TheDersi — you can sell on <strong className="text-foreground">TheDersi</strong>, and on <strong className="text-foreground">Daraz</strong> with TheDersi Pro.
              </p>
            </div>
            <button type="button" onClick={() => setDersiBlockChannel(null)}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
              Got it
            </button>
          </div>
        </div>
      )}

      {upgradeLimitModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <button type="button" onClick={() => setUpgradeLimitModal(false)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-foreground">Channel limit reached</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Free Trial and Starter plans include <strong className="text-foreground">1 channel connection</strong>. You've already used your slot.
              </p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Upgrade to <strong className="text-foreground">Premium (99 AED/mo)</strong> to connect all channels — Shopify, Daraz, TheDersi, Noon & more.
              </p>
            </div>
            <Link href="/dashboard/billing" onClick={() => setUpgradeLimitModal(false)}
              className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition text-center">
              Upgrade to Premium
            </Link>
            <button type="button" onClick={() => setUpgradeLimitModal(false)}
              className="w-full py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition">
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
