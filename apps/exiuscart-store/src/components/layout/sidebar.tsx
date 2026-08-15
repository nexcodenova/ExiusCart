'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, FileText, Users, Package, Boxes,
  Truck, Store, ClipboardList, BookOpen, Wallet, BarChart3,
  Settings, LogOut, ChevronLeft, X, CreditCard,
  UserCheck, Paintbrush, GitBranch, Shield, ChevronDown,
  Megaphone, Mail, MessageSquare, Calendar, ClipboardCheck,
  UserPlus, Clock, Car, Kanban, Headphones, CalendarCheck, Briefcase,
  DollarSign, Target, Sparkles, Link2, BookmarkCheck, Receipt, RefreshCw, ListChecks,
  Star, MapPin, ShoppingBag, LayoutGrid, FormInput, Coins,
} from 'lucide-react';
import { shopApi, subscriptionApi, channelsApi } from '@/lib/api';

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
      { href: '/dashboard/customers',    label: 'Customers',     icon: Users         },
      { href: '/dashboard/quotations',   label: 'Quotations',    icon: ClipboardList },
      { href: '/dashboard/reservations', label: 'Reservations',  icon: BookmarkCheck },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
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
    id: 'channels',
    label: 'Channels',
    items: [
      { href: '/dashboard/channels',         label: 'Channels',         icon: Link2      },
      { href: '/dashboard/channel-listings', label: 'Channel Listings', icon: ListChecks },
      { href: '/dashboard/storefront-categories', label: 'Storefront Categories', icon: LayoutGrid },
      { href: '/dashboard/dropshipping',        label: 'Dropshipping',    icon: Truck       },
      { href: '/dashboard/dropshipping/import', label: 'Import Products', icon: ShoppingBag },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    accent: 'text-purple-500',
    items: [
      { href: '/dashboard/leads',             label: 'Lead Management', icon: Target         },
      { href: '/dashboard/signup-forms',      label: 'Signup Forms',    icon: FormInput      },
      { href: '/dashboard/drip-flows',        label: 'Drip Flows',      icon: GitBranch      },
      { href: '/dashboard/email-marketing',   label: 'Email Marketing', icon: Mail           },
      { href: '/dashboard/sms-marketing',    label: 'SMS Marketing',   icon: MessageSquare  },
      { href: '/dashboard/popups',           label: 'Smart Upsells',   icon: Sparkles       },
      { href: '/dashboard/reviews',          label: 'Reviews',         icon: Star           },
      { href: '/dashboard/events',           label: 'Events',          icon: Calendar       },
      { href: '/dashboard/surveys',          label: 'Surveys',         icon: ClipboardCheck },
      { href: '/dashboard/ai-seo',           label: 'AI SEO Tools',    icon: Sparkles       },
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
      { href: '/dashboard/reports',    label: 'Reports',    icon: BarChart3},
      { href: '/dashboard/payout',     label: 'Payout',     icon: CreditCard },
      { href: '/dashboard/billing',    label: 'Billing',    icon: CreditCard },
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
      { href: '/dashboard/branches',           label: 'Branches',      icon: GitBranch  },
      { href: '/dashboard/staff',              label: 'Staff & Roles', icon: Shield     },
      { href: '/dashboard/customization',      label: 'Customization', icon: Paintbrush },
      { href: '/dashboard/settings',           label: 'Settings',      icon: Settings   },
    ],
  },
];

// Flat list for mobile bottom nav / external use
export const menuItems = GROUPS.flatMap(g => g.items);

// Premium-only hrefs — used by mobile nav to gate these items
export const PREMIUM_HREFS = new Set(
  GROUPS.filter(g => g.id === 'hr' || g.id === 'services').flatMap(g => g.items.map(i => i.href))
);

const PREMIUM_GROUPS = new Set(['hr', 'services']);

function isPremiumGroup(groupId: string): boolean {
  return PREMIUM_GROUPS.has(groupId);
}

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (c: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function ShopSidebar({ collapsed, onCollapsedChange, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
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
        // Detected via an active TheDersi connection, not plan_type —
        // TheDersi's Growth/Premium tier maps to plan_type='starter', same
        // as a direct customer, so a plan-string check alone misses them.
        isTheDersi: ((connRes as any)?.data ?? []).some((c: any) => c.channel_type === 'thedersi'),
      });
    }).catch(() => {});
  }, []);

  // Auto-dismiss coming soon banner after 3 s
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

  function isGroupActive(group: MenuGroup) {
    return group.items.some(item =>
      item.href === '/dashboard'
        ? pathname === item.href
        : pathname.startsWith(item.href)
    );
  }

  function isItemActive(item: MenuItem) {
    if (item.href === '/dashboard') return pathname === item.href;
    if (!(pathname === item.href || pathname.startsWith(item.href + '/'))) return false;
    // Nested routes (e.g. /dashboard/dropshipping and /dashboard/dropshipping/import)
    // both prefix-match on the import page — only the longest (most specific) wins.
    const allHrefs = GROUPS.flatMap(g => g.items.map(i => i.href));
    const longestMatch = allHrefs
      .filter(h => pathname === h || pathname.startsWith(h + '/'))
      .sort((a, b) => b.length - a.length)[0];
    return item.href === longestMatch;
  }

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
      )}

      <aside className={`fixed left-0 top-0 h-full flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50
        ${collapsed ? 'w-[72px]' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <Image src="/logo.svg" alt="ExiusCart" width={28} height={28} className="flex-shrink-0" />
            {!collapsed && (
              <span className="text-xl font-bold tracking-tight">
                <span className="text-indigo-400">Exius</span><span className="text-sidebar-foreground">Cart</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={onMobileClose} aria-label="Close sidebar"
            className="p-1.5 rounded-lg text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition lg:hidden">
            <X className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition hidden lg:block">
            <ChevronLeft className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-0.5">
            {GROUPS.map(group => {
              const plan = (shopData?.plan || '').toLowerCase();
              const canAccessPremium = plan === 'premium' || plan === 'thedersi_pro';
              const isTheDersiBasicPlan = plan === 'thedersi_basic';
              const locked = isPremiumGroup(group.id) && !canAccessPremium;
              // Premium/TheDersi Pro users see HR & Services as "Coming Soon"
              const isComingSoonGroup = isPremiumGroup(group.id) && canAccessPremium;
              const groupActive = isGroupActive(group);
              const isOpen = openGroups.has(group.id) || collapsed;

              const isTheDersiPlan = shopData?.isTheDersi ?? false;
              if (group.label === null) {
                return group.items
                  .filter(item => !(item.href === '/dashboard/dropshipping' && isTheDersiPlan))
                  .map(item => {
                  const Icon = item.icon;
                  const active = isItemActive(item);
                  return (
                    <Link key={item.href} href={item.href} onClick={onMobileClose}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        active ? 'bg-indigo-500/10 text-indigo-400 font-semibold' : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      }`}>
                      <Icon className={`w-5 h-5 flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`} />
                      {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
                    </Link>
                  );
                });
              }

              return (
                <div key={group.id} className="pt-4 first:pt-1">
                  {!collapsed && (
                    <button type="button" onClick={() => toggleGroup(group.id)}
                      className={`w-full flex items-center gap-2 px-3 py-1 rounded-lg transition-all text-left ${
                        groupActive ? 'text-sidebar-foreground' : 'text-sidebar-muted-foreground hover:text-sidebar-foreground'
                      }`}>
                      <span className="flex-1 text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                      {locked && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">PRO</span>}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                    </button>
                  )}

                  {(isOpen || collapsed) && (
                    <div className={collapsed ? 'space-y-0.5 mt-0.5' : 'mt-1 space-y-0.5'}>
                      {group.items.map(item => {
                        const Icon = item.icon;
                        const active = isItemActive(item);
                        if (locked) {
                          return (
                            <div key={item.href} className="relative group/lock">
                              <button type="button"
                                onClick={() => isTheDersiBasicPlan ? setShowTheDersiModal(true) : setShowUpgradeModal(true)}
                                title={collapsed ? item.label : undefined}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm w-full text-left text-sidebar-muted-foreground/50 hover:bg-sidebar-accent/50 cursor-pointer">
                                <Icon className={`w-4 h-4 flex-shrink-0 ${collapsed ? 'mx-auto w-5 h-5' : ''}`} />
                                {!collapsed && <span className="font-medium flex-1">{item.label}</span>}
                                {!collapsed && <Shield className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                              </button>
                              {/* Hover tooltip */}
                              {!collapsed && (
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-[60] hidden group-hover/lock:block pointer-events-none">
                                  <div className="bg-foreground text-background text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                                    {isTheDersiBasicPlan ? 'Only for TheDersi Pro' : 'Only for Premium plan'}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (isComingSoonGroup) {
                          return (
                            <button key={item.href} type="button"
                              onClick={() => { setShowComingSoon(true); onMobileClose(); }}
                              title={collapsed ? item.label : undefined}
                              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-sm w-full text-left ${
                                active ? 'bg-indigo-500/10 text-indigo-400 font-semibold' : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                              }`}>
                              <Icon className={`w-4 h-4 flex-shrink-0 ${collapsed ? 'mx-auto w-5 h-5' : ''}`} />
                              {!collapsed && <span className="font-medium flex-1">{item.label}</span>}
                              {!collapsed && <Sparkles className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
                            </button>
                          );
                        }
                        return (
                          <Link key={item.href} href={item.href} onClick={onMobileClose}
                            title={collapsed ? item.label : undefined}
                            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-sm ${
                              active ? 'bg-indigo-500/10 text-indigo-400 font-semibold' : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                            }`}>
                            <Icon className={`w-4 h-4 flex-shrink-0 ${collapsed ? 'mx-auto w-5 h-5' : ''}`} />
                            {!collapsed && <span className="font-medium">{item.label}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-sidebar-border bg-sidebar">
          <div className="p-3">
            <button
              type="button"
              aria-label="Logout"
              onClick={() => {
                localStorage.removeItem('access_token');
                localStorage.removeItem('user');
                window.location.href = '/login';
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition ${collapsed ? 'justify-center' : ''}`}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium text-sm">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

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
