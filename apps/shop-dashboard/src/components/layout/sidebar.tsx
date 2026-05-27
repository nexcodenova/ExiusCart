'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, FileText, Users, Package, Boxes,
  Truck, Store, ClipboardList, BookOpen, Wallet, BarChart3,
  Settings, LogOut, ChevronLeft, X, CreditCard, MessageCircle,
  UserCheck, Paintbrush, GitBranch, Shield, ChevronDown,
  Megaphone, Mail, MessageSquare, Calendar, ClipboardCheck,
  UserPlus, Clock, Car, Kanban, Headphones, CalendarCheck, Briefcase,
  DollarSign, Target, Sparkles, Link2,
} from 'lucide-react';
import { shopApi } from '@/lib/api';

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
      { href: '/dashboard/pos',        label: 'Point of Sale', icon: ShoppingCart },
      { href: '/dashboard/orders',     label: 'Orders',        icon: FileText      },
      { href: '/dashboard/customers',  label: 'Customers',     icon: Users         },
      { href: '/dashboard/quotations', label: 'Quotations',    icon: ClipboardList },
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
      { href: '/dashboard/suppliers',  label: 'Suppliers',  icon: Store   },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    accent: 'text-orange-500',
    items: [
      { href: '/dashboard/accounting', label: 'Accounting', icon: BookOpen },
      { href: '/dashboard/expenses',   label: 'Expenses',   icon: Wallet   },
      { href: '/dashboard/reports',    label: 'Reports',    icon: BarChart3},
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    accent: 'text-purple-500',
    items: [
      { href: '/dashboard/email-marketing',   label: 'Email Marketing', icon: Mail           },
      { href: '/dashboard/sms-marketing',    label: 'SMS Marketing',   icon: MessageSquare  },
      { href: '/dashboard/whatsapp',         label: 'WhatsApp',        icon: MessageCircle  },
      { href: '/dashboard/events',           label: 'Events',          icon: Calendar       },
      { href: '/dashboard/surveys',          label: 'Surveys',         icon: ClipboardCheck },
      { href: '/dashboard/ai-seo',           label: 'AI SEO Tools',    icon: Sparkles       },
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
      { href: '/dashboard/shopify-integration', label: 'Shopify Sync',  icon: Link2      },
      { href: '/dashboard/branches',           label: 'Branches',      icon: GitBranch  },
      { href: '/dashboard/staff',              label: 'Staff & Roles', icon: Shield     },
      { href: '/dashboard/customization',      label: 'Customization', icon: Paintbrush },
      { href: '/dashboard/billing',            label: 'Billing',       icon: CreditCard },
      { href: '/dashboard/settings',           label: 'Settings',      icon: Settings   },
    ],
  },
];

// Flat list for mobile bottom nav / external use
export const menuItems = GROUPS.flatMap(g => g.items);

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (c: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const STORAGE_KEY = 'sidebar_open_groups';

export function ShopSidebar({ collapsed, onCollapsedChange, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [shopData, setShopData] = useState<{ name: string; plan: string; daysLeft: number | null } | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(GROUPS.map(g => g.id)) // all open by default
  );

  // Load open/closed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOpenGroups(new Set(JSON.parse(saved)));
      else {
        // default: all open except settings
        const defaults = GROUPS.map(g => g.id).filter(id => id !== 'settings');
        setOpenGroups(new Set(defaults));
      }
    } catch {}
  }, []);

  useEffect(() => {
    shopApi.getMyShop().then((res) => {
      const shop = res.data;
      const sub = shop.subscription;
      let daysLeft: number | null = null;
      if (sub?.expires_at) {
        const diff = new Date(sub.expires_at).getTime() - Date.now();
        daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }
      setShopData({
        name: shop.name || '',
        plan: sub?.plan ? (sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)) : 'Free',
        daysLeft,
      });
    }).catch(() => {});
  }, []);

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))); } catch {}
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
    return item.href === '/dashboard'
      ? pathname === item.href
      : pathname.startsWith(item.href);
  }

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
      )}

      <aside className={`fixed left-0 top-0 h-full bg-card border-r border-border transition-all duration-300 z-50
        ${collapsed ? 'w-[72px]' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            {!collapsed
              ? <span className="text-xl font-bold text-foreground tracking-tight"><span className="text-primary">Exius</span>Cart</span>
              : <span className="text-xl font-bold text-primary">E</span>
            }
          </Link>
          <button type="button" onClick={onMobileClose} aria-label="Close sidebar"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition lg:hidden">
            <X className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition hidden lg:block">
            <ChevronLeft className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Shop Info */}
        {!collapsed && (
          <Link href="/dashboard/profile" onClick={onMobileClose}
            className="block px-4 py-3 border-b border-border hover:bg-muted/50 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{shopData?.name || '...'}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-primary font-medium">{shopData?.plan || ''}</span>
                  {shopData?.daysLeft != null && (
                    <span className="text-xs text-muted-foreground">• {shopData.daysLeft}d</span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Nav */}
        <nav className="overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
          <div className="p-2 space-y-0.5">
            {GROUPS.map(group => {
              const groupActive = isGroupActive(group);
              const isOpen = openGroups.has(group.id) || collapsed;

              if (group.label === null) {
                // Standalone items (Dashboard)
                return group.items.map(item => {
                  const Icon = item.icon;
                  const active = isItemActive(item);
                  return (
                    <Link key={item.href} href={item.href} onClick={onMobileClose}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}>
                      <Icon className={`w-5 h-5 flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`} />
                      {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
                    </Link>
                  );
                });
              }

              const GroupIcon = group.icon!;

              return (
                <div key={group.id} className="pt-1">
                  {/* Group header — hidden when icon-only */}
                  {!collapsed && (
                    <button type="button" onClick={() => toggleGroup(group.id)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-left ${
                        groupActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}>
                      <GroupIcon className={`w-4 h-4 flex-shrink-0 ${group.accent || ''}`} />
                      <span className="flex-1 text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                    </button>
                  )}

                  {/* Group items */}
                  {(isOpen || collapsed) && (
                    <div className={collapsed ? 'space-y-0.5 mt-0.5' : 'ml-2 mt-0.5 space-y-0.5'}>
                      {group.items.map(item => {
                        const Icon = item.icon;
                        const active = isItemActive(item);
                        return (
                          <Link key={item.href} href={item.href} onClick={onMobileClose}
                            title={collapsed ? item.label : undefined}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
        <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card">
          <div className="p-3">
            <button type="button" aria-label="Logout"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition ${collapsed ? 'justify-center' : ''}`}>
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium text-sm">Logout</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
