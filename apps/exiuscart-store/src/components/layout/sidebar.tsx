'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, FileText, Users, Package, Boxes,
  Truck, Store, ClipboardList, BookOpen, Wallet, BarChart3,
  Settings, PanelLeftClose, PanelLeftOpen, CreditCard,
  UserCheck, Paintbrush, GitBranch, Shield, ChevronDown,
  Megaphone, Mail, MessageSquare, Calendar, ClipboardCheck,
  UserPlus, Clock, Car, Kanban, Headphones, CalendarCheck, Briefcase,
  DollarSign, Target, Sparkles, Link2, BookmarkCheck, Receipt, RefreshCw, ListChecks,
  Star, MapPin, ShoppingBag, LayoutGrid, FormInput, Coins, Share2, MessageCircle, CheckCircle2,
  Percent, Gift, MapPinned, Undo2, Search, Palette, Layers, Image as ImageIcon, ImagePlus,
  LayoutTemplate, FolderOpen, Shapes, Bot, Wand2, FileEdit, LineChart, Workflow,
  History, Rocket, Users2, Network, Cable, Wrench, KeyRound, FileClock,
  TrendingUp, Bell, Lock, ArrowRight,
} from 'lucide-react';
import { shopApi, subscriptionApi, channelsApi, dropshipApi } from '@/lib/api';
import { useAccess } from '@/components/providers/access-provider';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import ChannelLogo from '@/components/channels/ChannelLogo';
import { channelMeta, channelIntegrationPath } from '@/components/channels/channelMeta';
import { SUPPLIER_STYLE } from '@/components/dropshipping/SupplierCard';

function ProdoraIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/prodora-logo.png" alt="" className={`${className ?? ''} rounded-[4px] object-cover`} />;
}

interface MenuItem {
  href: string;
  label: string;
  icon: React.ElementType;
  // 'channels' | 'suppliers' — this item expands in place to list the
  // shop's real connected channels/suppliers (fetched below), each linking
  // straight to that one integration/supplier instead of just the filtered
  // list view. Collapsed (icon-only) sidebar mode ignores this and the item
  // behaves like a normal link — no room to show a second nested level there.
  nestedKey?: 'channels' | 'suppliers';
}
interface MenuGroup {
  id: string;
  label: string | null;
  icon?: React.ElementType;
  accent?: string;
  items: MenuItem[];
}

const GROUPS: MenuGroup[] = [
  {
    id: 'main',
    label: null,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: ShoppingCart,
    accent: 'text-blue-500',
    items: [
      { href: '/dashboard/pos',          label: 'Point of Sale', icon: ShoppingCart  },
      { href: '/dashboard/orders',       label: 'Orders',        icon: FileText      },
      { href: '/dashboard/wholesale',    label: 'Wholesale',     icon: Boxes         },
      { href: '/dashboard/quotations',   label: 'Quotations',    icon: ClipboardList },
      { href: '/dashboard/reservations', label: 'Reservations',  icon: BookmarkCheck },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    icon: Store,
    accent: 'text-blue-400',
    items: [
      { href: '/dashboard/customers',   label: 'Customers',   icon: Users   },
      { href: '/dashboard/discounts',   label: 'Discounts',   icon: Percent },
      { href: '/dashboard/gift-cards',  label: 'Gift Cards & Items',  icon: Gift    },
      { href: '/dashboard/reviews',     label: 'Reviews',     icon: Star    },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    icon: Boxes,
    accent: 'text-green-500',
    items: [
      { href: '/dashboard/products',   label: 'Products',   icon: Package },
      { href: '/dashboard/inventory',  label: 'Inventory',  icon: Boxes   },
      { href: '/dashboard/purchases',  label: 'Purchases',  icon: Truck   },
      { href: '/dashboard/suppliers',  label: 'Local Suppliers', icon: Store },
    ],
  },
  {
    id: 'sales-channels',
    label: 'Sales Channels',
    icon: Link2,
    items: [
      { href: '/dashboard/channels',                    label: 'All Channels',       icon: Link2       },
      { href: '/dashboard/channels?status=Connected',   label: 'Connected Channels', icon: CheckCircle2, nestedKey: 'channels' },
      { href: '/dashboard/channels/listings',           label: 'Channel Listings',   icon: ListChecks  },
      { href: '/dashboard/channels/categories',         label: 'Channel Categories', icon: LayoutGrid  },
      { href: '/dashboard/channels/orders',             label: 'Channel Orders',     icon: FileText    },
    ],
  },
  {
    id: 'fulfillment',
    label: 'Fulfillment',
    icon: Truck,
    items: [
      { href: '/dashboard/dropshipping',                label: 'All Dropship Suppliers', icon: Truck        },
      { href: '/dashboard/dropshipping?view=connected', label: 'Connected Suppliers',    icon: CheckCircle2, nestedKey: 'suppliers' },
      { href: '/dashboard/dropshipping/orders',         label: 'Supplier Orders',        icon: ClipboardList },
      { href: '/dashboard/dropshipping/tracking',       label: 'Supplier Tracking',      icon: MapPinned    },
      { href: '/dashboard/dropshipping/returns',        label: 'Supplier Returns',       icon: Undo2        },
    ],
  },
  {
    id: 'source-products',
    label: 'Product Sourcing',
    icon: ShoppingBag,
    items: [
      { href: '/dashboard/dropshipping/import', label: 'Import Products',  icon: ShoppingBag },
      { href: '/dashboard/product-research',    label: 'Product Research', icon: Search      },
      { href: '/dashboard/prodora-imports', label: 'Prodora', icon: ProdoraIcon },
    ],
  },
  {
    id: 'product-studio',
    label: 'Product Studio',
    icon: Palette,
    items: [
      { href: '/dashboard/design-studio',      label: 'Design Studio',    icon: Palette         },
      { href: '/dashboard/mockup-studio',       label: 'Mockup Studio',    icon: Layers          },
      { href: '/dashboard/ai-product-images',   label: 'AI Product Images', icon: ImageIcon     },
      { href: '/dashboard/lifestyle-images',    label: 'Lifestyle Images', icon: ImagePlus       },
      { href: '/dashboard/design-templates',    label: 'Templates',       icon: LayoutTemplate   },
      { href: '/dashboard/my-designs',          label: 'My Designs',      icon: FolderOpen       },
      { href: '/dashboard/brand-assets',        label: 'Brand Assets',    icon: Shapes           },
    ],
  },
  {
    id: 'ai-commerce',
    label: 'AI Commerce',
    icon: Bot,
    items: [
      { href: '/dashboard/ai-assistant',         label: 'AI Assistant',         icon: Bot       },
      { href: '/dashboard/ai-product-creator',   label: 'AI Product Creator',   icon: Wand2     },
      { href: '/dashboard/ai-listing-generator', label: 'AI Listing Generator', icon: FileEdit  },
      { href: '/dashboard/ai-marketing',         label: 'AI Marketing',         icon: Megaphone },
      { href: '/dashboard/ai-analytics',         label: 'AI Analytics',         icon: LineChart },
      { href: '/dashboard/ai-automations',       label: 'AI Automations',       icon: Workflow  },
      { href: '/dashboard/ai-activity',          label: 'AI Activity',          icon: History   },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    accent: 'text-purple-500',
    items: [
      { href: '/dashboard/marketing',          label: 'Overview',          icon: Megaphone      },
      { href: '/dashboard/campaigns',          label: 'Campaigns',         icon: Rocket         },
      { href: '/dashboard/leads',              label: 'Lead Management',   icon: Target         },
      { href: '/dashboard/customer-segments',  label: 'Customer Segments', icon: Users2         },
      { href: '/dashboard/email-marketing',    label: 'Email Marketing',   icon: Mail           },
      { href: '/dashboard/sms-marketing',      label: 'SMS Marketing',     icon: MessageSquare  },
      { href: '/dashboard/whatsapp-marketing', label: 'WhatsApp Marketing', icon: MessageCircle },
      { href: '/dashboard/drip-flows',         label: 'Abandoned Cart',    icon: Undo2          },
      { href: '/dashboard/social-posting',     label: 'Social Media',      icon: Share2         },
      { href: '/dashboard/ads',                label: 'Ads',               icon: Megaphone      },
      { href: '/dashboard/drip-flows',         label: 'Automations',       icon: GitBranch      },
      { href: '/dashboard/blog',               label: 'Blog',              icon: BookOpen       },
      { href: '/dashboard/signup-forms',       label: 'Signup Forms',      icon: FormInput      },
      { href: '/dashboard/popups',             label: 'Smart Upsells',     icon: Sparkles       },
      { href: '/dashboard/events',             label: 'Events',            icon: Calendar       },
      { href: '/dashboard/surveys',            label: 'Surveys',           icon: ClipboardCheck },
      { href: '/dashboard/ai-seo',             label: 'AI SEO Tools',      icon: Sparkles       },
      { href: '/dashboard/products/videos',    label: 'AI Product Videos', icon: Sparkles       },
      { href: '/dashboard/storefront-insights', label: 'Storefront Insights', icon: BarChart3   },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    accent: 'text-sky-500',
    items: [
      { href: '/dashboard/analytics',            label: 'Overview',    icon: BarChart3 },
      { href: '/dashboard/reports?tab=sales',     label: 'Sales',       icon: TrendingUp },
      { href: '/dashboard/analytics/products',    label: 'Products',   icon: Package   },
      { href: '/dashboard/analytics/channels',    label: 'Channels',   icon: Link2     },
      { href: '/dashboard/analytics/customers',   label: 'Customers',  icon: Users     },
      { href: '/dashboard/analytics/marketing',   label: 'Marketing',  icon: Megaphone },
      { href: '/dashboard/analytics/fulfillment', label: 'Fulfillment', icon: Truck    },
      { href: '/dashboard/reports?tab=profitability', label: 'Profit', icon: DollarSign },
      { href: '/dashboard/reports',                label: 'Reports',   icon: FileText  },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    accent: 'text-orange-500',
    items: [
      { href: '/dashboard/accounting',   label: 'Accounting',   icon: BookOpen     },
      { href: '/dashboard/expenses',     label: 'Expenses',     icon: Wallet       },
      { href: '/dashboard/loyalty',      label: 'Loyalty',      icon: Star         },
      { href: '/dashboard/wallet',       label: 'Wallet',       icon: Coins        },
      { href: '/dashboard/credit-notes',        label: 'Credit Notes',       icon: Receipt   },
      { href: '/dashboard/recurring-invoices',  label: 'Recurring Invoices', icon: RefreshCw },
      { href: '/dashboard/payout',     label: 'Earnings',   icon: CreditCard },
    ],
  },
  {
    id: 'mcp',
    label: 'MCP & AI Connections',
    icon: Network,
    items: [
      { href: '/dashboard/mcp',              label: 'MCP Overview',  icon: Network     },
      { href: '/dashboard/mcp/connected',     label: 'Connected AI',  icon: Cable       },
      { href: '/dashboard/mcp/claude',        label: 'Claude',        icon: Bot         },
      { href: '/dashboard/mcp/chatgpt',       label: 'ChatGPT',       icon: Bot         },
      { href: '/dashboard/mcp/tools',         label: 'MCP Tools',     icon: Wrench      },
      { href: '/dashboard/mcp/permissions',   label: 'Permissions',   icon: Shield      },
      { href: '/dashboard/mcp/api-keys',      label: 'API Keys',      icon: KeyRound    },
      { href: '/dashboard/mcp/activity',      label: 'Activity Logs', icon: FileClock   },
    ],
  },
  {
    id: 'hr',
    label: 'Human Resources',
    icon: UserCheck,
    accent: 'text-teal-500',
    items: [
      { href: '/dashboard/hr',          label: 'HR & Payroll', icon: UserCheck },
      { href: '/dashboard/recruitment', label: 'Recruitment',  icon: UserPlus  },
      { href: '/dashboard/attendance',  label: 'Attendance',   icon: Clock     },
      { href: '/dashboard/fleet',       label: 'Fleet',        icon: Car       },
    ],
  },
  {
    id: 'services',
    label: 'Services',
    icon: Briefcase,
    accent: 'text-indigo-500',
    items: [
      { href: '/dashboard/projects',     label: 'Projects',     icon: Kanban       },
      { href: '/dashboard/helpdesk',     label: 'Helpdesk',     icon: Headphones   },
      { href: '/dashboard/appointments', label: 'Appointments', icon: CalendarCheck},
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    accent: 'text-gray-400',
    items: [
      { href: '/dashboard/settings',                    label: 'Store Settings',      icon: Settings   },
      { href: '/dashboard/settings?tab=general',        label: 'Business',            icon: Store      },
      { href: '/dashboard/branches',                    label: 'Branches',            icon: GitBranch  },
      { href: '/dashboard/staff',                        label: 'Team',                icon: Shield     },
      { href: '/dashboard/staff/roles',                  label: 'Roles & Permissions', icon: Shield     },
      { href: '/dashboard/billing',                      label: 'Billing',             icon: CreditCard },
      { href: '/dashboard/settings?tab=notifications',  label: 'Notifications',       icon: Bell       },
      { href: '/dashboard/settings?tab=security',        label: 'Security',            icon: Shield     },
      { href: '/dashboard/customization',                label: 'Customization',       icon: Paintbrush },
      { href: '/dashboard/settings/webhooks',            label: 'Developer',           icon: Wrench     },
    ],
  },
];

// Flat list for mobile bottom nav / external use — untouched, MobileBottomNav
// still reads these directly and keeps working exactly as before.
export const menuItems = GROUPS.flatMap(g => g.items);

// Growth/Scale only. ai-commerce/product-studio/mcp aren't built yet (all
// "Coming Soon" stubs) but are locked here anyway, so the access rule is
// already correct the day a real feature lands behind them — a TheDersi
// shop on Free Forever/Lite/Pro is never "growth" or "scale" (Official is
// the one TheDersi tier that shares plan_type="scale" with real Scale
// customers, so it already passes this check with no special-casing
// needed) so this same PREMIUM_GROUPS list also gets TheDersi's exclusion
// right for free.
const PREMIUM_GROUPS = new Set(['hr', 'services', 'ai-commerce', 'product-studio', 'mcp']);

function isPremiumGroup(groupId: string): boolean {
  return PREMIUM_GROUPS.has(groupId);
}

// Features no TheDersi-managed plan gets (Official excepted — it resolves to
// plan "scale" and is never treated as restricted). Mirrors the backend's
// is_thedersi_restricted_shop() gates: every dropshipping/supplier/import
// route (blanket 403), the Blog (blog.py), and Wholesale (Scale only).
// Locking them in the sidebar shows the "Not available on TheDersi Plans"
// popup on click instead of navigating to a page that only then says no.
function isTheDersiBlockedHref(href: string): boolean {
  return href.startsWith('/dashboard/dropshipping')
    || href === '/dashboard/wholesale'
    || href === '/dashboard/blog';
}

// Marketing Hub pages that only TheDersi Free Forever lacks (Lite/Pro/
// Official all have them) — same list the pages' own MarketingHubLockScreen
// checks use.
const THEDERSI_FREE_FOREVER_BLOCKED_HREFS = new Set([
  '/dashboard/marketing',
  '/dashboard/campaigns',
  '/dashboard/ads',
  '/dashboard/customer-segments',
]);

// SMS Marketing: backend's SMS_LIMITS only covers launch/growth/scale, so
// TheDersi Free Forever and Lite have none (Pro shares "launch"; Official
// shares "scale").
const THEDERSI_NO_SMS_PLANS = new Set(['thedersi_free_forever', 'thedersi_lite']);

interface TheDersiModalCopy { title: string; body: string }
const THEDERSI_NOT_AVAILABLE: TheDersiModalCopy = {
  title: 'Not Available on TheDersi Plans',
  body: "This isn't included on any TheDersi-managed plan. Contact TheDersi if you have questions about your plan.",
};
const THEDERSI_NOT_ON_FREE_FOREVER: TheDersiModalCopy = {
  title: 'Not Available on Free Forever',
  body: 'This is available on TheDersi Lite, Pro, and Official. Contact TheDersi to change your plan.',
};
const THEDERSI_SMS_PRO_ONLY: TheDersiModalCopy = {
  title: 'Not Available on Your TheDersi Plan',
  body: 'SMS Marketing is available on TheDersi Pro and Official. Contact TheDersi to change your plan.',
};
const THEDERSI_PRO_ONLY: TheDersiModalCopy = {
  title: 'Not Available on Your TheDersi Plan',
  body: 'Advanced analytics is available on TheDersi Pro and Official. Contact TheDersi to change your plan.',
};

// The Analytics group is NOT a premium group as a whole — Sales/Profit/
// Reports (which route into the real Reports page) stay open to every
// plan. Only these 6 real dashboards are Growth/Scale (+ TheDersi Pro/
// Official) — locked per-item below, not via isPremiumGroup, since that
// would also lock the Reports-backed items this group already gives
// Launch today.
const ANALYTICS_ADVANCED_HREFS = new Set([
  '/dashboard/analytics',
  '/dashboard/analytics/products',
  '/dashboard/analytics/channels',
  '/dashboard/analytics/customers',
  '/dashboard/analytics/marketing',
  '/dashboard/analytics/fulfillment',
]);

// Premium-only hrefs — used by mobile nav to gate these items. Includes
// the 6 advanced Analytics hrefs even though "analytics" isn't a premium
// GROUP (Sales/Profit/Reports in the same group stay open to everyone) —
// mobile nav's badge is a flat href set, so it can't distinguish "some
// items in this group" the way the desktop sidebar's per-item check does.
export const PREMIUM_HREFS = new Set([
  ...GROUPS.filter(g => isPremiumGroup(g.id)).flatMap(g => g.items.map(i => i.href)),
  ...ANALYTICS_ADVANCED_HREFS,
]);

// Rebuilt on shadcn/ui's real Sidebar primitive (components/ui/sidebar.tsx)
// instead of a hand-rolled fixed-position <aside> — desktop collapse/expand
// and all its own state (now cookie-persisted, a free upgrade the old
// version didn't have) come from SidebarProvider/useSidebar. Mobile is
// deliberately untouched: MobileBottomNav is still the only mobile nav,
// confirmed with the user before this rebuild — nothing here ever calls
// setOpenMobile(true), so the primitive's own mobile Sheet path simply
// never triggers.
export function ShopSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [theDersiModal, setTheDersiModal] = useState<TheDersiModalCopy | null>(null);
  const access = useAccess();
  const [ownShopData, setShopData] = useState<{ name: string; plan: string; planLabel: string; daysLeft: number | null; isTheDersi: boolean } | null>(null);
  // A team member can't read the billing endpoint that fills ownShopData's plan
  // (it 403s and would leave every premium section looking locked), so their
  // plan comes from the access lookup instead. Owners are unchanged.
  const shopData = useMemo(() => {
    if (access.isOwner || !access.plan) return ownShopData;
    return {
      name: ownShopData?.name || '',
      plan: access.plan.type,
      planLabel: access.plan.label,
      daysLeft: access.plan.daysLeft,
      isTheDersi: access.plan.isTheDersi,
    };
  }, [access.isOwner, access.plan, ownShopData]);
  // Only the sections this person's role includes. Owners see everything.
  const visibleGroups = useMemo(() => {
    if (access.isOwner) return GROUPS;
    return GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => access.canPath(i.href.split('?')[0])) }))
      .filter((g) => g.items.length > 0);
  }, [access]);
  const [connectedChannels, setConnectedChannels] = useState<{ channel_type: string }[]>([]);
  const [connectedSuppliers, setConnectedSuppliers] = useState<{ supplier_type: string; name: string }[]>([]);
  // Every group always starts collapsed — just the group name, nothing
  // expanded — on every page load and every login, no exceptions. Clicking
  // a group only opens it for the current session; it's not remembered.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  // Same "starts closed every load, opens for the session only" rule as
  // openGroups above, one level deeper — keyed by the item's own href.
  const [openNested, setOpenNested] = useState<Set<string>>(new Set());

  useEffect(() => {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') : null;
    Promise.all([
      shopApi.getMyShop().catch(() => null),
      shopId ? subscriptionApi.getCurrent(shopId).catch(() => null) : Promise.resolve(null),
      shopId ? channelsApi.getConnections(shopId).catch(() => null) : Promise.resolve(null),
      shopId ? dropshipApi.getConnections(shopId).catch(() => null) : Promise.resolve(null),
    ]).then(([shopRes, subRes, connRes, dropRes]) => {
      const plan = subRes?.data?.plan;
      const channels: { channel_type: string }[] = (connRes as any)?.data ?? [];
      setShopData({
        name: shopRes?.data?.name || '',
        plan: plan?.plan_type || 'free_trial',
        planLabel: plan?.name || 'Free Trial',
        daysLeft: plan?.daysLeft ?? null,
        isTheDersi: channels.some((c) => c.channel_type === 'thedersi'),
      });
      setConnectedChannels(channels);
      const suppliers: { supplier_type: string; name: string; connected: boolean }[] = (dropRes as any)?.data?.suppliers ?? [];
      setConnectedSuppliers(suppliers.filter((s) => s.connected));
    }).catch(() => {});
  }, []);

  function toggleNested(href: string) {
    setOpenNested((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  // One group open at a time: with every group collapsed the whole menu fits
  // the screen without scrolling, and opening one keeps the list short.
  function toggleGroup(id: string) {
    setOpenGroups(prev => (prev.has(id) ? new Set<string>() : new Set<string>([id])));
  }

  // A few items now share a base path with a more specific sibling (e.g.
  // "All Channels" → /dashboard/channels vs "Connected Channels" →
  // /dashboard/channels?status=Connected) — plain pathname comparison can't
  // tell them apart since usePathname() never includes the query string, so
  // matching also checks that every query param the item's href declares is
  // actually present in the current URL, and ties are broken toward the
  // more specific (longer path, then more query params) match.
  function matchesItem(item: MenuItem) {
    const [path, queryStr] = item.href.split('?');
    if (path === '/dashboard') return pathname === path;
    if (!(pathname === path || pathname.startsWith(path + '/'))) return false;
    if (!queryStr) return true;
    const required = new URLSearchParams(queryStr);
    for (const [key, value] of required.entries()) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  }

  function isGroupActive(group: MenuGroup) {
    return group.items.some(matchesItem);
  }

  function isItemActive(item: MenuItem) {
    if (!matchesItem(item)) return false;
    const candidates = GROUPS.flatMap(g => g.items).filter(matchesItem);
    const best = candidates.sort((a, b) => {
      const [aPath, aQuery] = a.href.split('?');
      const [bPath, bQuery] = b.href.split('?');
      if (aPath.length !== bPath.length) return bPath.length - aPath.length;
      return (bQuery?.length ?? 0) - (aQuery?.length ?? 0);
    })[0];
    return item.href === best.href;
  }

  return (
    <>
      <Sidebar collapsible="icon">
        {/* Logo only — hiding/showing the menu lives in the footer ("Hide
            menu"), same as Prodora. */}
        <SidebarHeader className={`h-14 flex-row flex items-center border-b border-sidebar-border ${collapsed ? 'justify-center' : 'px-4'}`}>
          <Link href="/dashboard" className={`flex items-center gap-2 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
            <Image src="/logo-ec.png" alt="ExiusCart" width={35} height={28} className="flex-shrink-0" />
            {!collapsed && (
              <span className="text-xl font-bold tracking-tight">
                <span className="text-indigo-400">Exius</span><span className="text-sidebar-foreground">Cart</span>
              </span>
            )}
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="p-2 space-y-0.5">
            <SidebarGroupContent>
              {visibleGroups.map(group => {
                const plan = (shopData?.plan || '').toLowerCase();
                const isTheDersiPlan = shopData?.isTheDersi ?? false;
                // Off for every TheDersi tier except Official (which shares
                // plan_type="scale" with real Scale customers and so already
                // satisfies canAccessPremium on its own) — Free Forever,
                // Lite, and Pro all get the TheDersi-specific locked message
                // instead of the generic one.
                const isTheDersiRestricted = isTheDersiPlan && plan !== 'scale';
                const canAccessPremium = plan === 'scale' || plan === 'growth';
                const isTheDersiBasicPlan = isTheDersiRestricted;
                const isFreeForever = plan === 'thedersi_free_forever';
                const locked = (isPremiumGroup(group.id) && !canAccessPremium)
                  || (isTheDersiRestricted && group.id === 'fulfillment');
                // TheDersi Pro shares plan_type="launch" with real Launch
                // customers (who don't get advanced Analytics on their
                // own), so it needs its own bump here — same reasoning as
                // is_thedersi_pro_shop() giving Pro Growth-level limits
                // elsewhere. Official already resolves to plan="scale" and
                // needs no special case.
                const isTheDersiPro = isTheDersiPlan && plan === 'launch';
                const canAccessAdvancedAnalytics = canAccessPremium || isTheDersiPro;
                const groupActive = isGroupActive(group);
                const isOpen = openGroups.has(group.id) || collapsed;

                if (group.label === null) {
                  return (
                    <SidebarMenu key={group.id}>
                      {group.items
                        .filter(item => !(item.href === '/dashboard/dropshipping' && isTheDersiPlan))
                        .map(item => {
                          const Icon = item.icon;
                          const active = isItemActive(item);
                          return (
                            <SidebarMenuItem key={item.href}>
                              <SidebarMenuButton asChild isActive={active} tooltip={collapsed ? item.label : undefined}
                                className={active ? 'bg-indigo-500/10 text-indigo-400 font-semibold hover:bg-indigo-500/10 hover:text-indigo-400' : 'text-sidebar-muted-foreground'}>
                                <Link href={item.href}>
                                  <Icon className="w-5 h-5 flex-shrink-0" />
                                  <span className="font-medium text-sm">{item.label}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                    </SidebarMenu>
                  );
                }

                return (
                  <div key={group.id} className="pt-0.5">
                    {!collapsed && (
                      <button type="button" onClick={() => toggleGroup(group.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left hover:bg-sidebar-accent/40 ${
                          groupActive ? 'text-sidebar-foreground' : 'text-sidebar-muted-foreground hover:text-sidebar-foreground'
                        }`}>
                        {group.icon && <group.icon className={`w-4 h-4 shrink-0 ${group.accent ?? ''}`} />}
                        <span className="flex-1 text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                        {locked && (isTheDersiRestricted ? (
                          // "PRO" would read as TheDersi's own Pro tier, which
                          // doesn't get these either — say what it actually is.
                          <span title="Not available on TheDersi plans" aria-label="Not available on TheDersi plans"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                            {isPremiumGroup(group.id) ? 'PRO' : 'LOCKED'}
                          </span>
                        ))}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                      </button>
                    )}

                    {(isOpen || collapsed) && (
                      // Indented + a left guide line when expanded, so a
                      // sub-item reads as nested under its group header
                      // instead of continuing the same flush-left line —
                      // collapsed (icon-only) mode skips both since there's
                      // no room and no header row to nest under.
                      <SidebarMenu className={collapsed ? 'space-y-0.5 mt-0.5' : 'mt-1 space-y-0.5 ml-4 pl-2 border-l border-sidebar-border/60'}>
                        {group.items.map(item => {
                          const Icon = item.icon;
                          const active = isItemActive(item);
                          const isAdvancedAnalyticsItem = ANALYTICS_ADVANCED_HREFS.has(item.href);
                          const blockedForFreeForever = isFreeForever && THEDERSI_FREE_FOREVER_BLOCKED_HREFS.has(item.href);
                          const blockedForTheDersi = isTheDersiRestricted && isTheDersiBlockedHref(item.href);
                          const blockedSms = item.href === '/dashboard/sms-marketing' && THEDERSI_NO_SMS_PLANS.has(plan);
                          const itemLocked = locked || (isAdvancedAnalyticsItem && !canAccessAdvancedAnalytics)
                            || blockedForTheDersi || blockedForFreeForever || blockedSms;

                          if (itemLocked) {
                            const modalCopy = blockedSms ? THEDERSI_SMS_PRO_ONLY
                              : blockedForFreeForever ? THEDERSI_NOT_ON_FREE_FOREVER
                              : (isAdvancedAnalyticsItem && !canAccessAdvancedAnalytics) ? THEDERSI_PRO_ONLY
                              : THEDERSI_NOT_AVAILABLE;
                            const lockMessage = isTheDersiPlan
                              ? (blockedSms ? 'Only for TheDersi Pro & Official'
                                : blockedForFreeForever ? 'Not available on Free Forever'
                                : (isAdvancedAnalyticsItem && !canAccessAdvancedAnalytics) ? 'Only for TheDersi Pro & Official'
                                : 'Not available on TheDersi plans')
                              : 'Only for Growth & Scale';
                            return (
                              <SidebarMenuItem key={item.href} className="relative group/lock">
                                <SidebarMenuButton
                                  onClick={() => isTheDersiBasicPlan ? setTheDersiModal(modalCopy) : setShowUpgradeModal(true)}
                                  tooltip={collapsed ? item.label : undefined}
                                  className="text-sidebar-muted-foreground/50 hover:bg-sidebar-accent/50"
                                >
                                  <Icon className="w-4 h-4 flex-shrink-0" />
                                  {!collapsed && <span className="font-medium flex-1">{item.label}</span>}
                                  {!collapsed && <Shield className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                                </SidebarMenuButton>
                                {!collapsed && (
                                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-[60] hidden group-hover/lock:block pointer-events-none">
                                    <div className="bg-foreground text-background text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                                      {lockMessage}
                                    </div>
                                  </div>
                                )}
                              </SidebarMenuItem>
                            );
                          }
                          if (item.nestedKey && !collapsed) {
                            const nestedOpen = openNested.has(item.href);
                            const list = item.nestedKey === 'channels' ? connectedChannels : connectedSuppliers;
                            return (
                              <div key={item.href}>
                                <SidebarMenuItem>
                                  <SidebarMenuButton
                                    onClick={() => toggleNested(item.href)}
                                    isActive={active}
                                    className={active ? 'bg-indigo-500/10 text-indigo-400 font-semibold hover:bg-indigo-500/10 hover:text-indigo-400' : 'text-sidebar-muted-foreground'}
                                  >
                                    <Icon className="w-4 h-4 flex-shrink-0" />
                                    <span className="font-medium flex-1 text-left">{item.label}</span>
                                    {list.length > 0 && (
                                      <span className="text-[10px] text-sidebar-muted-foreground/70">{list.length}</span>
                                    )}
                                    <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${nestedOpen ? '' : '-rotate-90'}`} />
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                                {nestedOpen && (
                                  <SidebarMenu className="mt-0.5 space-y-0.5 ml-4 pl-2 border-l border-sidebar-border/60">
                                    {list.length === 0 ? (
                                      <p className="px-2 py-1.5 text-xs text-sidebar-muted-foreground/60">
                                        None connected yet
                                      </p>
                                    ) : item.nestedKey === 'channels' ? (
                                      (list as { channel_type: string }[]).map((c) => {
                                        const meta = channelMeta(c.channel_type);
                                        return (
                                          <SidebarMenuItem key={c.channel_type}>
                                            <SidebarMenuButton asChild className="text-sidebar-muted-foreground">
                                              <Link href={`/dashboard/channels/integrations/${channelIntegrationPath(c.channel_type)}`}>
                                                <ChannelLogo channelType={c.channel_type} size={16} />
                                                <span className="font-medium">{meta.label}</span>
                                              </Link>
                                            </SidebarMenuButton>
                                          </SidebarMenuItem>
                                        );
                                      })
                                    ) : (
                                      (list as { supplier_type: string; name: string }[]).map((s) => {
                                        const style = SUPPLIER_STYLE[s.supplier_type];
                                        const SupplierIcon = style?.icon ?? Package;
                                        return (
                                          <SidebarMenuItem key={s.supplier_type}>
                                            <SidebarMenuButton asChild className="text-sidebar-muted-foreground">
                                              <Link href="/dashboard/dropshipping?view=connected">
                                                {/* Real brand logo where one exists (same asset
                                                    SupplierCard's own header uses) — plain icon
                                                    fallback for suppliers with no logo file yet,
                                                    never a made-up mark. Rendered on an explicit
                                                    white chip (not the dark sidebar background)
                                                    since these source files carry their own light
                                                    backdrop — on the navy sidebar that backdrop
                                                    read as a mismatched patch rather than a logo. */}
                                                {style?.logo ? (
                                                  <span className="w-5 h-5 rounded-md overflow-hidden shrink-0 flex items-center justify-center bg-white p-0.5 ring-1 ring-black/5">
                                                    <Image src={style.logo} alt={s.name} width={20} height={20}
                                                      className="w-full h-full object-contain" />
                                                  </span>
                                                ) : (
                                                  <SupplierIcon className={`w-4 h-4 flex-shrink-0 ${style?.color ?? ''}`} />
                                                )}
                                                <span className="font-medium">{s.name}</span>
                                              </Link>
                                            </SidebarMenuButton>
                                          </SidebarMenuItem>
                                        );
                                      })
                                    )}
                                  </SidebarMenu>
                                )}
                              </div>
                            );
                          }
                          return (
                            <SidebarMenuItem key={item.href}>
                              <SidebarMenuButton asChild isActive={active} tooltip={collapsed ? item.label : undefined}
                                className={active ? 'bg-indigo-500/10 text-indigo-400 font-semibold hover:bg-indigo-500/10 hover:text-indigo-400' : 'text-sidebar-muted-foreground'}>
                                <Link href={item.href}>
                                  <Icon className="w-4 h-4 flex-shrink-0" />
                                  <span className="font-medium">{item.label}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    )}
                  </div>
                );
              })}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          {!collapsed && (
            // Hidden on short screens so it never pushes the menu into a scroll.
            <div className="overflow-hidden rounded-xl bg-gradient-to-br from-[#1B1146] to-[#3B23A8] p-3 ring-1 ring-white/10 [@media(max-height:760px)]:hidden">
              <div className="flex items-center gap-2.5">
                <img src="/prodora-logo.png" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight text-white">Prodora</p>
                  <p className="text-[11px] leading-tight text-indigo-200">AI Product Sourcing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-prodora'))}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-500 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
              >
                Explore Prodora <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {/* Icon only, on the right - the menu itself reads from the left, so the
              collapse control sits opposite it. Centered once collapsed (no room). */}
          <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
            <button
              type="button"
              onClick={toggleSidebar}
              title={collapsed ? 'Show menu' : 'Hide menu'}
              aria-label={collapsed ? 'Show menu' : 'Hide menu'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Upgrade modal — for free_trial / starter users */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowUpgradeModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/15 mb-4 mx-auto">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground text-center mb-2">Growth &amp; Scale Feature</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              HR, Payroll, Fleet, Projects, Helpdesk and Appointments are available on <span className="text-amber-400 font-semibold">Growth and Scale</span> plans.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowUpgradeModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition">
                Cancel
              </button>
              <Link href="/dashboard/billing" onClick={() => setShowUpgradeModal(false)}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold text-center transition">
                Upgrade Now
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TheDersi upgrade modal — for TheDersi sellers not on the Pro tier */}
      {theDersiModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setTheDersiModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/15 mb-4 mx-auto">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground text-center mb-2">{theDersiModal.title}</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">{theDersiModal.body}</p>
            <button type="button" onClick={() => setTheDersiModal(null)}
              className="w-full py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
