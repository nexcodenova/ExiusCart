'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, FileText, Users, Package, Boxes,
  Truck, Store, ClipboardList, BookOpen, Wallet, BarChart3,
  Settings, LogOut, ChevronLeft, X, CreditCard,
  UserCheck, Paintbrush, GitBranch, Shield, ChevronDown,
  Megaphone, Mail, MessageSquare, Calendar, ClipboardCheck,
  UserPlus, Clock, Car, Kanban, Headphones, CalendarCheck, Briefcase,
  DollarSign, Target, Sparkles, Link2, BookmarkCheck, Receipt, RefreshCw, ListChecks,
  Star, MapPin, ShoppingBag, LayoutGrid, FormInput, Coins, Share2, MessageCircle, CheckCircle2,
  Percent, Gift, MapPinned, Undo2, Search, Palette, Layers, Image as ImageIcon, ImagePlus,
  LayoutTemplate, FolderOpen, Shapes, Bot, Wand2, FileEdit, LineChart, Workflow,
  History, Rocket, Users2, Plug, Network, Cable, Wrench, KeyRound, FileClock,
  TrendingUp, Bell,
} from 'lucide-react';
import { shopApi, subscriptionApi, channelsApi } from '@/lib/api';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';

interface MenuItem {
  href: string;
  label: string;
  icon: React.ElementType;
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
      { href: '/dashboard/gift-cards',  label: 'Gift Cards',  icon: Gift    },
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
      { href: '/dashboard/channels?status=Connected',   label: 'Connected Channels', icon: CheckCircle2 },
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
      { href: '/dashboard/dropshipping?view=connected', label: 'Connected Suppliers',    icon: CheckCircle2 },
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
    id: 'integrations',
    label: 'Integrations',
    icon: Plug,
    items: [
      { href: '/dashboard/integrations',            label: 'All Integrations', icon: Plug     },
      { href: '/dashboard/channels',                 label: 'Sales Channels',   icon: Link2    },
      { href: '/dashboard/dropshipping',              label: 'Fulfillment',     icon: Truck    },
      { href: '/dashboard/integrations/marketing',    label: 'Marketing',       icon: Megaphone },
      { href: '/dashboard/integrations/payments',     label: 'Payments',        icon: CreditCard },
      { href: '/dashboard/integrations/shipping',     label: 'Shipping',        icon: Truck     },
      { href: '/dashboard/settings/webhooks',         label: 'Developer',       icon: Wrench    },
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
      { href: '/dashboard/staff',                        label: 'Roles & Permissions', icon: Shield     },
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

// Premium-only hrefs — used by mobile nav to gate these items
export const PREMIUM_HREFS = new Set(
  GROUPS.filter(g => g.id === 'hr' || g.id === 'services').flatMap(g => g.items.map(i => i.href))
);

const PREMIUM_GROUPS = new Set(['hr', 'services']);

function isPremiumGroup(groupId: string): boolean {
  return PREMIUM_GROUPS.has(groupId);
}

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
  const [showTheDersiModal, setShowTheDersiModal] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [shopData, setShopData] = useState<{ name: string; plan: string; planLabel: string; daysLeft: number | null; isTheDersi: boolean } | null>(null);
  // Every group always starts collapsed — just the group name, nothing
  // expanded — on every page load and every login, no exceptions. Clicking
  // a group only opens it for the current session; it's not remembered.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') : null;
    Promise.all([
      shopApi.getMyShop().catch(() => null),
      shopId ? subscriptionApi.getCurrent(shopId).catch(() => null) : Promise.resolve(null),
      shopId ? channelsApi.getConnections(shopId).catch(() => null) : Promise.resolve(null),
    ]).then(([shopRes, subRes, connRes]) => {
      const plan = subRes?.data?.plan;
      setShopData({
        name: shopRes?.data?.name || '',
        plan: plan?.plan_type || 'free_trial',
        planLabel: plan?.name || 'Free Trial',
        daysLeft: plan?.daysLeft ?? null,
        isTheDersi: ((connRes as any)?.data ?? []).some((c: any) => c.channel_type === 'thedersi'),
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showComingSoon) return;
    const t = setTimeout(() => setShowComingSoon(false), 3000);
    return () => clearTimeout(t);
  }, [showComingSoon]);

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        {/* Logo — collapsed is icon-width only, so logo + toggle stack
            vertically instead of fighting for horizontal space, same
            layout the old fixed <aside> version used. */}
        <SidebarHeader className={`border-b border-sidebar-border ${collapsed ? 'flex flex-col items-center justify-center gap-1.5 py-3' : 'h-16 flex-row flex items-center justify-between px-4'}`}>
          <Link href="/dashboard" className={`flex items-center gap-2 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
            <Image src="/logo.svg" alt="ExiusCart" width={28} height={28} className="flex-shrink-0" />
            {!collapsed && (
              <span className="text-xl font-bold tracking-tight">
                <span className="text-indigo-400">Exius</span><span className="text-sidebar-foreground">Cart</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1 rounded-lg text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition">
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="p-2 space-y-0.5">
            <SidebarGroupContent>
              {GROUPS.map(group => {
                const plan = (shopData?.plan || '').toLowerCase();
                const canAccessPremium = plan === 'premium' || plan === 'thedersi_pro';
                const isTheDersiBasicPlan = plan === 'thedersi_basic';
                const locked = isPremiumGroup(group.id) && !canAccessPremium;
                const isComingSoonGroup = isPremiumGroup(group.id) && canAccessPremium;
                const groupActive = isGroupActive(group);
                const isOpen = openGroups.has(group.id) || collapsed;
                const isTheDersiPlan = shopData?.isTheDersi ?? false;

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
                  <div key={group.id} className="pt-4 first:pt-1">
                    {!collapsed && (
                      <button type="button" onClick={() => toggleGroup(group.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1 rounded-lg transition-all text-left ${
                          groupActive ? 'text-sidebar-foreground' : 'text-sidebar-muted-foreground hover:text-sidebar-foreground'
                        }`}>
                        {group.icon && <group.icon className={`w-4 h-4 shrink-0 ${group.accent ?? ''}`} />}
                        <span className="flex-1 text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                        {locked && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">PRO</span>}
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

                          if (locked) {
                            return (
                              <SidebarMenuItem key={item.href} className="relative group/lock">
                                <SidebarMenuButton
                                  onClick={() => isTheDersiBasicPlan ? setShowTheDersiModal(true) : setShowUpgradeModal(true)}
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
                                      {isTheDersiBasicPlan ? 'Only for TheDersi Pro' : 'Only for Premium plan'}
                                    </div>
                                  </div>
                                )}
                              </SidebarMenuItem>
                            );
                          }
                          if (isComingSoonGroup) {
                            return (
                              <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton
                                  isActive={active}
                                  tooltip={collapsed ? item.label : undefined}
                                  onClick={() => setShowComingSoon(true)}
                                  className={active ? 'bg-indigo-500/10 text-indigo-400 font-semibold hover:bg-indigo-500/10 hover:text-indigo-400' : 'text-sidebar-muted-foreground'}
                                >
                                  <Icon className="w-4 h-4 flex-shrink-0" />
                                  {!collapsed && <span className="font-medium flex-1">{item.label}</span>}
                                  {!collapsed && <Sparkles className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
                                </SidebarMenuButton>
                              </SidebarMenuItem>
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
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={collapsed ? 'Logout' : undefined}
                onClick={() => {
                  localStorage.removeItem('access_token');
                  localStorage.removeItem('user');
                  window.location.href = '/login';
                }}
                className="text-sidebar-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="font-medium text-sm">Logout</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Coming Soon top banner — for premium/thedersi_pro clicking HR & Services */}
      {showComingSoon && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-max max-w-[calc(100vw-2rem)]">
          <div className="flex items-center gap-3 bg-foreground text-background px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-top-2 duration-200">
            <Sparkles className="w-4 h-4 flex-shrink-0 text-indigo-400" />
            <div>
              <p className="font-semibold text-sm">Coming Soon</p>
              <p className="text-xs opacity-60">This feature is currently in development</p>
            </div>
            <button onClick={() => setShowComingSoon(false)} className="ml-2 p-1 hover:opacity-60 transition rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Upgrade modal — for free_trial / starter users */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowUpgradeModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/15 mb-4 mx-auto">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground text-center mb-2">Premium Feature</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              HR, Payroll, Fleet, Projects, Helpdesk and Appointments are available on the <span className="text-amber-400 font-semibold">Premium</span> plan.
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

      {/* TheDersi upgrade modal — for thedersi_basic users */}
      {showTheDersiModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowTheDersiModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/15 mb-4 mx-auto">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground text-center mb-2">TheDersi Pro Feature</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              HR, Payroll, Fleet, Projects, Helpdesk and Appointments are only available on <span className="text-indigo-400 font-semibold">TheDersi Pro</span>.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowTheDersiModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition">
                Cancel
              </button>
              <Link href="/dashboard/billing" onClick={() => setShowTheDersiModal(false)}
                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold text-center transition">
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
