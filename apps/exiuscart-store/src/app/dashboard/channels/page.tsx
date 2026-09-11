'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Link2, Loader2, Search, FileText, Plus,
  X,
  ShoppingBag, Globe, ShoppingCart, Package, Instagram, Tag, Music2, Store, CreditCard, Download,
} from 'lucide-react';
import { channelsApi, shopifyApi, subscriptionApi } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/channels/directory/StatCard';
import ChannelCard, { ChannelDef, ChannelStat } from '@/components/channels/directory/ChannelCard';
import ConnectChannelModal from '@/components/channels/directory/ConnectChannelModal';
import FlowDiagram from '@/components/channels/directory/FlowDiagram';
import HowItWorks from '@/components/channels/directory/HowItWorks';
import SecurityPanel from '@/components/channels/directory/SecurityPanel';
import SyncCenter from '@/components/channels/directory/SyncCenter';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  last_synced_at: string | null;
}

interface ChannelStatsResponse {
  summary: { connected_channels: number; active_channels: number; products_synced: number; orders_synced: number };
  channels: Record<string, ChannelStat & { connected: boolean; is_active: boolean }>;
}

const STATUS_FILTERS = ['All', 'Connected', 'Available'] as const;

// ── Main page ─────────────────────────────────────────────────────────────────
//
// Every real connect/manage flow still lives on its own dedicated page
// (/dashboard/*-integration), same pattern Shopify already used — this page
// is the directory: search, filter, and a premium card grid that routes
// there, plus the plan-gating explainers (locked/upgrade/TheDersi-block)
// that make sense to show inline without leaving this list. Redesigned
// visual layer (stat cards, search, category chips, flow diagram, sync
// center) sits on top of the exact same gating logic the previous version
// had — nothing about who can connect what changed here.

export default function ChannelsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shopId, setShopId] = useState('');
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ChannelStatsResponse | null>(null);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [ebayLocked, setEbayLocked] = useState(false);
  const [dersiBlockChannel, setDersiBlockChannel] = useState<string | null>(null);
  const [darazLocked, setDarazLocked] = useState(false);
  const [upgradeLimitModal, setUpgradeLimitModal] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [plan, setPlan] = useState('');

  const [search, setSearch] = useState('');
  // Preset from ?status=Connected — the sidebar's "Connected Channels" link
  // deep-links here rather than being a separate page, since this page
  // already has the real filter built in.
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>(() => {
    const s = searchParams.get('status');
    return (STATUS_FILTERS as readonly string[]).includes(s ?? '') ? (s as typeof STATUS_FILTERS[number]) : 'All';
  });
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const loadStats = (sid: string) => {
    setRefreshingStats(true);
    channelsApi.getStats(sid).then((r) => setStats(r.data)).catch(() => {}).finally(() => setRefreshingStats(false));
  };

  const load = () => {
    if (!shopId) return;
    Promise.all([
      channelsApi.getConnections(shopId).then((r) => setConnections(r.data ?? [])),
      shopifyApi.getStatus(shopId).then((r) => setShopifyConnected(r.data?.connected ?? false)).catch(() => {}),
      subscriptionApi.getCurrent(shopId).then((r) => setPlan(r.data?.plan?.plan_type || '')).catch(() => {}),
    ]).finally(() => setLoading(false));
    loadStats(shopId);
  };

  useEffect(() => { load(); }, [shopId]);

  const hasTheDersi = connections.some((c) => c.channel_type === 'thedersi');
  const hasDaraz = connections.some((c) => c.channel_type === 'daraz');
  const hasNoon = connections.some((c) => c.channel_type === 'noon');
  const hasEbay = connections.some((c) => c.channel_type === 'ebay');
  const hasTikTok = connections.some((c) => c.channel_type === 'tiktok');
  const hasWooCommerce = connections.some((c) => c.channel_type === 'woocommerce');
  const hasBigCommerce = connections.some((c) => c.channel_type === 'bigcommerce');
  const hasEtsy = connections.some((c) => c.channel_type === 'etsy');
  const hasWhop = connections.some((c) => c.channel_type === 'whop');
  const hasGumroad = connections.some((c) => c.channel_type === 'gumroad');
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

  const availableChannels: (ChannelDef & { channelType?: string })[] = [
    // ── Row 1: Shopify, Custom Website, WooCommerce ──
    {
      id: 'shopify',
      channelType: 'shopify',
      name: 'Shopify',
      category: 'Your Own Store',
      description: 'Sync your Shopify store — products, orders, and inventory stay in sync automatically.',
      icon: <ShoppingBag className="w-5 h-5 text-[#96BF48]" />,
      badge: shopifyConnected ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: shopifyConnected ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: shopifyConnected
        ? () => router.push('/dashboard/channels/integrations/shopify')
        : isTheDersiUser
          ? () => setDersiBlockChannel('Shopify')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/channels/integrations/shopify'),
      actionLabel: shopifyConnected ? 'Manage Shopify' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Shopify')),
    },
    {
      id: 'etsy',
      channelType: 'etsy',
      name: 'Etsy',
      category: 'Global Marketplaces',
      description: 'List products on Etsy and manage orders from ExiusCart — great for handmade and craft sellers.',
      icon: <ShoppingBag className="w-5 h-5 text-orange-600" />,
      badge: hasEtsy ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: hasEtsy ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: hasEtsy
        ? () => router.push('/dashboard/channels/integrations/etsy')
        : isTheDersiUser
          ? () => setDersiBlockChannel('Etsy')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/channels/integrations/etsy'),
      actionLabel: hasEtsy ? 'Manage Etsy' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Etsy')),
    },
    {
      id: 'custom_website',
      channelType: 'custom',
      name: 'Custom Website',
      category: 'Your Own Store',
      description: 'Connect any website using our API or webhook. Receive orders directly from your own storefront.',
      icon: <Globe className="w-5 h-5 text-sky-400" />,
      badge: hasCustomWebsite ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: hasCustomWebsite ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: hasCustomWebsite
        ? () => router.push('/dashboard/channels/integrations/custom-website')
        : isTheDersiUser
          ? () => setDersiBlockChannel('Custom Website')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/channels/integrations/custom-website'),
      actionLabel: hasCustomWebsite ? 'Manage Website' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Website')),
    },
    {
      id: 'woocommerce',
      channelType: 'woocommerce',
      name: 'WooCommerce',
      category: 'Your Own Store',
      description: 'Connect your own WordPress store — paste your site\'s REST API keys, no plugin needed.',
      icon: <ShoppingCart className="w-5 h-5 text-[#7F54B3]" />,
      badge: hasWooCommerce ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: hasWooCommerce ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: hasWooCommerce
        ? () => router.push('/dashboard/channels/integrations/woocommerce')
        : isTheDersiUser
          ? () => setDersiBlockChannel('WooCommerce')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/channels/integrations/woocommerce'),
      actionLabel: hasWooCommerce ? 'Manage WooCommerce' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect WooCommerce')),
    },
    {
      id: 'bigcommerce',
      channelType: 'bigcommerce',
      name: 'BigCommerce',
      category: 'Your Own Store',
      description: 'Sync your BigCommerce store — products, orders, and inventory stay in sync automatically.',
      icon: <Store className="w-5 h-5 text-[#00C9A7]" />,
      badge: hasBigCommerce ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: hasBigCommerce ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: hasBigCommerce
        ? () => router.push('/dashboard/channels/integrations/bigcommerce')
        : isTheDersiUser
          ? () => setDersiBlockChannel('BigCommerce')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/channels/integrations/bigcommerce'),
      actionLabel: hasBigCommerce ? 'Manage BigCommerce' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect BigCommerce')),
    },
    {
      id: 'wix',
      channelType: 'wix',
      name: 'Wix Stores',
      category: 'Your Own Store',
      description: 'Connect your Wix store — products, orders, and inventory stay in sync automatically.',
      icon: <Globe className="w-5 h-5 text-[#000000] dark:text-white" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Wix Stores') : undefined,
    },
    // ── Row 2: eBay, Amazon, Instagram, TikTok Shop ──
    {
      id: 'ebay',
      channelType: 'ebay',
      name: 'eBay',
      category: 'Global Marketplaces',
      description: 'List products on eBay and manage all orders directly from ExiusCart.',
      icon: <Tag className="w-5 h-5 text-[#E53238]" />,
      badge: hasEbay ? 'live' : (isTheDersiUser ? 'locked' : (canUseEbay ? 'connect' : 'locked')),
      badgeLabel: hasEbay ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (canUseEbay ? 'Available' : 'Premium only')),
      onAction: hasEbay
        ? () => router.push('/dashboard/channels/integrations/ebay')
        : isTheDersiUser
          ? () => setDersiBlockChannel('eBay')
          : canUseEbay
            ? () => router.push('/dashboard/channels/integrations/ebay')
            : () => setEbayLocked(true),
      actionLabel: hasEbay ? 'Manage eBay' : (isTheDersiUser ? 'Learn more' : (canUseEbay ? 'Connect eBay' : 'Upgrade to Premium')),
    },
    {
      id: 'amazon',
      channelType: 'amazon',
      name: 'Amazon',
      category: 'Global Marketplaces',
      description: 'List and manage your Amazon products and orders through ExiusCart.',
      icon: <Package className="w-5 h-5 text-orange-400" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Amazon') : undefined,
    },
    {
      id: 'instagram',
      channelType: 'instagram',
      name: 'Instagram Shopping',
      category: 'Social Commerce',
      description: 'Tag products in your Instagram posts and stories. Orders sync to ExiusCart.',
      icon: <Instagram className="w-5 h-5 text-pink-400" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Instagram Shopping') : undefined,
    },
    {
      // Gated the same way as Noon/Shopify/Custom Website — Starter picks
      // it as their one channel, Premium gets it unlimited alongside
      // everything else — matching the pricing page's actual promise,
      // NOT eBay's inline Premium-only gate (a separate, pre-existing
      // mismatch between eBay's code and its own marketing copy).
      id: 'tiktok',
      channelType: 'tiktok',
      name: 'TikTok Shop',
      category: 'Social Commerce',
      description: 'Sell directly on TikTok. Orders sync to ExiusCart, stock stays in sync automatically.',
      icon: <Music2 className="w-5 h-5 text-[#010101] dark:text-white" />,
      badge: hasTikTok ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: hasTikTok ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: hasTikTok
        ? () => router.push('/dashboard/channels/integrations/tiktok')
        : isTheDersiUser
          ? () => setDersiBlockChannel('TikTok Shop')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/channels/integrations/tiktok'),
      actionLabel: hasTikTok ? 'Manage TikTok Shop' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect TikTok Shop')),
    },
    // ── Row 3: Noon, Trendyol ──
    {
      id: 'noon',
      channelType: 'noon',
      name: 'Noon',
      category: 'Middle East',
      description: "UAE/KSA/GCC's biggest marketplace. Paste your own Noon service account key to connect — products, stock, and orders sync to ExiusCart.",
      icon: <ShoppingBag className="w-5 h-5 text-yellow-500" />,
      badge: hasNoon ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: hasNoon ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: hasNoon
        ? () => router.push('/dashboard/channels/integrations/noon')
        : isTheDersiUser
          ? () => setDersiBlockChannel('Noon')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/channels/integrations/noon'),
      actionLabel: hasNoon ? 'Manage Noon' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Noon')),
    },
    {
      id: 'trendyol',
      channelType: 'trendyol',
      name: 'Trendyol',
      category: 'Global Marketplaces',
      description: "Turkey's largest online marketplace. List products and manage orders through ExiusCart.",
      icon: <ShoppingBag className="w-5 h-5 text-[#F27A1A]" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Trendyol') : undefined,
    },
    {
      id: 'walmart',
      channelType: 'walmart',
      name: 'Walmart',
      category: 'Global Marketplaces',
      description: 'Reach US shoppers on Walmart Marketplace. List products and manage orders through ExiusCart.',
      icon: <Store className="w-5 h-5 text-[#0071CE]" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Walmart') : undefined,
    },
    {
      id: 'jumia',
      channelType: 'jumia',
      name: 'Jumia',
      category: 'Africa',
      description: "Africa's leading marketplace. List products and manage orders through ExiusCart.",
      icon: <ShoppingBag className="w-5 h-5 text-[#F68B1E]" />,
      badge: 'soon',
      onAction: isTheDersiUser ? () => setDersiBlockChannel('Jumia') : undefined,
    },
    // ── Row 4 (last): Daraz, TheDersi — the two channels TheDersi sellers can use ──
    {
      id: 'daraz',
      channelType: 'daraz',
      name: 'Daraz',
      category: 'Asia',
      description: "South Asia's largest marketplace — Pakistan, Bangladesh, Sri Lanka, Nepal and Myanmar. Orders sync to ExiusCart automatically.",
      icon: <ShoppingBag className="w-5 h-5 text-orange-500" />,
      badge: hasDaraz ? 'live' : canUseDaraz ? 'connect' : 'locked',
      badgeLabel: hasDaraz ? 'Connected' : canUseDaraz ? 'Available' : (isTheDersiUser ? 'TheDersi Pro only' : 'Premium only'),
      onAction: hasDaraz || canUseDaraz
        ? () => router.push('/dashboard/channels/integrations/daraz')
        : () => setDarazLocked(true),
      actionLabel: hasDaraz ? 'Manage Daraz' : 'Connect Daraz',
    },
    {
      id: 'thedersi',
      channelType: 'thedersi',
      name: 'TheDersi',
      category: 'TheDersi',
      description: "List products on Sri Lanka's #1 fashion marketplace. Orders sync automatically to your dashboard.",
      icon: <Link2 className="w-5 h-5 text-primary" />,
      badge: hasTheDersi ? 'live' : (channelLimitReached ? 'locked' : 'connect'),
      badgeLabel: hasTheDersi ? 'Connected' : (channelLimitReached ? 'Upgrade to Premium' : 'Available'),
      onAction: channelLimitReached && !hasTheDersi
        ? () => setUpgradeLimitModal(true)
        : () => router.push('/dashboard/channels/integrations/thedersi'),
      actionLabel: hasTheDersi ? 'Manage TheDersi' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect TheDersi'),
    },
    // ── Digital products: Whop, Gumroad ──
    {
      id: 'whop',
      channelType: 'whop',
      name: 'Whop',
      category: 'Sell Digital Products',
      description: 'Sell digital products with no business registration needed — Whop is Merchant of Record, so it handles payment and tax compliance for you.',
      icon: <CreditCard className="w-5 h-5 text-[#FA4616]" />,
      badge: hasWhop ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: hasWhop ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: hasWhop
        ? () => router.push('/dashboard/channels/integrations/whop')
        : isTheDersiUser
          ? () => setDersiBlockChannel('Whop')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/channels/integrations/whop'),
      actionLabel: hasWhop ? 'Manage Whop' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Whop')),
    },
    {
      id: 'gumroad',
      channelType: 'gumroad',
      name: 'Gumroad',
      category: 'Sell Digital Products',
      description: 'List your digital products on Gumroad and manage orders from ExiusCart.',
      icon: <Download className="w-5 h-5 text-[#FF90E8]" />,
      badge: hasGumroad ? 'live' : (isTheDersiUser ? 'locked' : (channelLimitReached ? 'locked' : 'connect')),
      badgeLabel: hasGumroad ? 'Connected' : (isTheDersiUser ? 'ExiusCart direct only' : (channelLimitReached ? 'Upgrade to Premium' : 'Available')),
      onAction: hasGumroad
        ? () => router.push('/dashboard/channels/integrations/gumroad')
        : isTheDersiUser
          ? () => setDersiBlockChannel('Gumroad')
          : channelLimitReached
            ? () => setUpgradeLimitModal(true)
            : () => router.push('/dashboard/channels/integrations/gumroad'),
      actionLabel: hasGumroad ? 'Manage Gumroad' : (isTheDersiUser ? 'Learn more' : (channelLimitReached ? 'Upgrade to Premium' : 'Connect Gumroad')),
    },
  ];

  const categories = ['All', 'Your Own Store', 'Global Marketplaces', 'Middle East', 'Asia', 'Africa', 'Social Commerce', 'Sell Digital Products', 'TheDersi'];

  const filteredChannels = useMemo(() => {
    return availableChannels.filter((c) => {
      const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase());
      const statusMatch = statusFilter === 'All' ? true : statusFilter === 'Connected' ? c.badge === 'live' : c.badge !== 'live';
      const categoryMatch = categoryFilter === 'All' ? true : c.category === categoryFilter;
      return searchMatch && statusMatch && categoryMatch;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [search, statusFilter, categoryFilter, connections, shopifyConnected, plan]);

  // Connected/Active come straight from `connections` (already-loaded,
  // already-working data) rather than the newer /channels/stats endpoint —
  // getConnections() only ever returns is_active=True rows, so "connected"
  // IS "active" in this data model; "active" additionally requires having
  // synced at least once (last_synced_at set), distinguishing a channel
  // that's connected but never successfully synced from one that has.
  // Only Products/Orders Synced below depend on /channels/stats.
  const connectedChannelsCount = connections.length + (shopifyConnected ? 1 : 0);
  const activeChannelsCount = connections.filter((c) => c.last_synced_at).length + (shopifyConnected ? 1 : 0);
  const syncedChannels = availableChannels
    .filter((c) => c.badge === 'live' && c.channelType)
    .map((c) => ({
      name: c.name,
      channelType: c.channelType,
      lastSyncedAt: connections.find((conn) => conn.channel_type === c.channelType)?.last_synced_at ?? null,
    }));

  return (
    // No extra p-* here — the dashboard layout's <main> already pads every
    // page (matches Orders/Products/Customers' own root pattern); this
    // page previously double-padded on top of that.
    <div className="max-w-[1500px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-2">Sales Channels / Connections</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Connect your sales channels</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Connect every place you sell and manage your ecommerce operations from one centralized workspace.
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <Button variant="outline" asChild>
            <Link href="/dashboard/helpdesk"><FileText className="w-4 h-4" /> View Documentation</Link>
          </Button>
          <Button onClick={() => setConnectModalOpen(true)}>
            <Plus className="w-4 h-4" /> Connect Channel
          </Button>
        </div>
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
        <>
          {/* Stat cards — real numbers from /channels/stats, Shopify's own
              connected state folded in since it's tracked separately */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={<Store className="w-5 h-5" />} title="Connected Channels" value={connectedChannelsCount} />
            <StatCard icon={<Link2 className="w-5 h-5" />} title="Active Channels" value={activeChannelsCount} iconClassName="bg-green-500/10 text-green-600 dark:text-green-400" />
            <StatCard icon={<Package className="w-5 h-5" />} title="Products Synced" value={(stats?.summary.products_synced ?? 0).toLocaleString()} iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
            <StatCard icon={<ShoppingCart className="w-5 h-5" />} title="Orders Synced" value={(stats?.summary.orders_synced ?? 0).toLocaleString()} iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-foreground">Your sales channels</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Connect stores, marketplaces and social commerce channels to ExiusCart.</p>
          </div>

          {/* Left column and right rail now both start at this row — the
              heading above sits full-width outside the grid so "Your
              connections stay secure" lines up exactly with the search/
              status-filter row instead of the heading, per feedback. */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6">
            {/* Channels grid */}
            <div className="min-w-0 space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search channels..."
                    className="w-full h-10 pl-10 pr-3 bg-muted border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="flex rounded-xl bg-muted p-1 shrink-0">
                  {STATUS_FILTERS.map((f) => (
                    <button key={f} onClick={() => setStatusFilter(f)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${statusFilter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                      categoryFilter === cat ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>

              {filteredChannels.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Search className="w-5 h-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">No channels found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Try another search or filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {filteredChannels.map((c) => (
                    <ChannelCard key={c.id} channel={c} stat={c.channelType ? stats?.channels[c.channelType] : undefined} />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                <span>Showing <span className="font-semibold text-foreground">{filteredChannels.length}</span> channels</span>
                <button onClick={() => { setSearch(''); setStatusFilter('All'); setCategoryFilter('All'); }}
                  className="font-semibold text-primary hover:opacity-80">
                  Reset filters
                </button>
              </div>
            </div>

            {/* Right rail */}
            <div className="space-y-5">
              <HowItWorks />
              <SecurityPanel />
              <SyncCenter channels={syncedChannels} onRefresh={() => loadStats(shopId)} refreshing={refreshingStats} />
            </div>
          </div>

          {/* Empty / new-user CTA */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.06] via-card to-blue-500/[0.05] p-6">
            <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-card shadow-sm text-primary flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Start connecting your ecommerce ecosystem</h3>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">Connect your first sales channel to start importing products and synchronizing orders.</p>
                </div>
              </div>
              <Button onClick={() => setConnectModalOpen(true)} className="shrink-0">
                Connect your first channel →
              </Button>
            </div>
          </div>

          {/* Flow diagram — full-width at the end of the page */}
          <FlowDiagram />
        </>
      )}

      <ConnectChannelModal open={connectModalOpen} onClose={() => setConnectModalOpen(false)} channels={availableChannels} />

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
