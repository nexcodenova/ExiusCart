'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Suspense, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { BLOG_SITES, parseBlogSite } from '@/lib/blog-sites';
import {
  LayoutDashboard,
  Store,
  Users,
  CreditCard,
  Package,
  BarChart3,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  Link2,
  ShoppingBag,
  Key,
  Newspaper,
  Star,
  Download,
  ChevronDown,
} from 'lucide-react';

export const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/leads', label: 'Leads', icon: UserPlus },
  { href: '/dashboard/affiliates', label: 'Affiliates', icon: Link2 },
  { href: '/dashboard/shopping', label: 'Prodora', icon: ShoppingBag },
  { href: '/dashboard/digital-bundles', label: 'Digital Bundles', icon: Download },
  { href: '/dashboard/blogs', label: 'Blogs', icon: Newspaper },
  { href: '/dashboard/reviews', label: 'Reviews', icon: Star },
  { href: '/dashboard/shops', label: 'Stores', icon: Store },
  { href: '/dashboard/users', label: 'Users', icon: Users },
  { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: Package },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/client-codes', label: 'Client Codes', icon: Key },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

// Sub-pages under Prodora — shown as a dropdown in this sidebar. menuItems
// (above) stays flat because the mobile bottom nav reads it directly, so the
// Digital Bundles entry there is skipped when the sidebar draws its own list.
const PRODORA_CHILDREN = [
  { href: '/dashboard/shopping', match: '/dashboard/shopping', label: 'All Products', exact: true },
  { href: '/dashboard/shopping/add', match: '/dashboard/shopping/add', label: 'Add Products', exact: true },
  { href: '/dashboard/digital-bundles', match: '/dashboard/digital-bundles', label: 'Digital Products', exact: false },
  { href: '/dashboard/shopping/categories', match: '/dashboard/shopping/categories', label: 'Categories', exact: false },
];
const IN_PRODORA_GROUP = ['/dashboard/digital-bundles'];

// Sub-pages under Affiliates.
const AFFILIATE_CHILDREN = [
  { href: '/dashboard/affiliates', match: '/dashboard/affiliates', label: 'Overview', exact: true },
  { href: '/dashboard/affiliates/payouts', match: '/dashboard/affiliates/payouts', label: 'Payouts', exact: false },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

// One link per site under Blogs. Reads ?site= to highlight the current one, so
// it has to sit inside a Suspense boundary.
function BlogSiteLinks({ onBlogs }: { onBlogs: boolean }) {
  const current = parseBlogSite(useSearchParams().get('site'));
  return (
    <div className="mt-0.5 space-y-0.5">
      {BLOG_SITES.map((s) => {
        const active = onBlogs && current === s.key;
        return (
          <Link
            key={s.key} href={`/dashboard/blogs?site=${s.key}`}
            className={`block rounded-lg py-2 pl-[44px] pr-3 text-sm font-medium transition-all ${
              active ? 'bg-white text-[#5A2EC9] shadow-sm' : 'text-gray-500 hover:bg-white/70 hover:text-gray-900'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AdminSidebar({ collapsed, onCollapsedChange }: AdminSidebarProps) {
  const pathname = usePathname();
  const onProdora = pathname.startsWith('/dashboard/shopping') || PRODORA_CHILDREN.some((c) => pathname.startsWith(c.match));
  const [prodoraOpen, setProdoraOpen] = useState(onProdora);
  const onAffiliates = pathname.startsWith('/dashboard/affiliates');
  const [affiliatesOpen, setAffiliatesOpen] = useState(onAffiliates);
  const onBlogs = pathname.startsWith('/dashboard/blogs');
  const [blogsOpen, setBlogsOpen] = useState(onBlogs);

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#EFEDF8] border-r border-[#E0DCF0] transition-all duration-300 z-50 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className={`h-16 shrink-0 flex items-center border-b border-[#E0DCF0] ${collapsed ? 'justify-center' : 'px-4'}`}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="ExiusCart" width={32} height={32} className="flex-shrink-0" />
          {!collapsed && (
            <span className="text-xl font-bold tracking-tight text-gray-900">Admin</span>
          )}
        </Link>
      </div>

      {/* Navigation — scrolls on its own when the menu is taller than the
          screen, instead of running underneath the Admin Info block below
          (which used to sit on top via absolute positioning and covered
          the last couple of items on any laptop-height screen). */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {menuItems.filter((item) => !IN_PRODORA_GROUP.includes(item.href)).map((item) => {
          const Icon = item.icon;
          if (item.href === '/dashboard/shopping') {
            return (
              <div key={item.href}>
                <div className={`flex items-stretch rounded-lg transition-all ${onProdora ? 'bg-white/70 text-gray-900' : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'}`}>
                  {collapsed ? (
                    <Link href="/dashboard/shopping" title={item.label} className="flex flex-1 items-center gap-3 px-3 py-2.5">
                      <Icon className="w-5 h-5 flex-shrink-0 mx-auto" />
                    </Link>
                  ) : (
                    // Expanded: only opens or closes the dropdown, it does not change the page.
                    <button
                      type="button" onClick={() => setProdoraOpen((v) => !v)} aria-expanded={prodoraOpen}
                      className="flex flex-1 items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </button>
                  )}
                  {!collapsed && (
                    <button
                      type="button" aria-label={prodoraOpen ? 'Collapse Prodora' : 'Expand Prodora'}
                      onClick={() => setProdoraOpen((v) => !v)}
                      className="flex w-10 items-center justify-center"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${prodoraOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {prodoraOpen && !collapsed && (
                  // Text only, lined up with the "Prodora" label above: 12px padding
                  // + 20px icon + 12px gap = 44px.
                  <div className="mt-0.5 space-y-0.5">
                    {PRODORA_CHILDREN.map((child) => {
                      const active = child.exact ? pathname === child.match : pathname.startsWith(child.match);
                      return (
                        <Link
                          key={child.href} href={child.href}
                          className={`block rounded-lg py-2 pl-[44px] pr-3 text-sm font-medium transition-all ${
                            active ? 'bg-white text-[#5A2EC9] shadow-sm' : 'text-gray-500 hover:bg-white/70 hover:text-gray-900'
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          if (item.href === '/dashboard/affiliates') {
            return (
              <div key={item.href}>
                <div className={`flex items-stretch rounded-lg transition-all ${onAffiliates ? 'bg-white/70 text-gray-900' : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'}`}>
                  {collapsed ? (
                    <Link href="/dashboard/affiliates" title={item.label} className="flex flex-1 items-center gap-3 px-3 py-2.5">
                      <Icon className="w-5 h-5 flex-shrink-0 mx-auto" />
                    </Link>
                  ) : (
                    <button
                      type="button" onClick={() => setAffiliatesOpen((v) => !v)} aria-expanded={affiliatesOpen}
                      className="flex flex-1 items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </button>
                  )}
                  {!collapsed && (
                    <button
                      type="button" aria-label={affiliatesOpen ? 'Collapse Affiliates' : 'Expand Affiliates'}
                      onClick={() => setAffiliatesOpen((v) => !v)}
                      className="flex w-10 items-center justify-center"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${affiliatesOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {affiliatesOpen && !collapsed && (
                  <div className="mt-0.5 space-y-0.5">
                    {AFFILIATE_CHILDREN.map((child) => {
                      const active = child.exact ? pathname === child.match : pathname.startsWith(child.match);
                      return (
                        <Link
                          key={child.href} href={child.href}
                          className={`block rounded-lg py-2 pl-[44px] pr-3 text-sm font-medium transition-all ${
                            active ? 'bg-white text-[#5A2EC9] shadow-sm' : 'text-gray-500 hover:bg-white/70 hover:text-gray-900'
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          if (item.href === '/dashboard/blogs') {
            return (
              <div key={item.href}>
                <div className={`flex items-stretch rounded-lg transition-all ${onBlogs ? 'bg-white/70 text-gray-900' : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'}`}>
                  {collapsed ? (
                    <Link href="/dashboard/blogs?site=exiuscart" title={item.label} className="flex flex-1 items-center gap-3 px-3 py-2.5">
                      <Icon className="w-5 h-5 flex-shrink-0 mx-auto" />
                    </Link>
                  ) : (
                    <button
                      type="button" onClick={() => setBlogsOpen((v) => !v)} aria-expanded={blogsOpen}
                      className="flex flex-1 items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </button>
                  )}
                  {!collapsed && (
                    <button
                      type="button" aria-label={blogsOpen ? 'Collapse Blogs' : 'Expand Blogs'}
                      onClick={() => setBlogsOpen((v) => !v)}
                      className="flex w-10 items-center justify-center"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${blogsOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {blogsOpen && !collapsed && (
                  <Suspense fallback={null}><BlogSiteLinks onBlogs={onBlogs} /></Suspense>
                )}
              </div>
            );
          }
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-white text-[#5A2EC9] shadow-sm'
                  : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`} />
              {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Admin Info */}
      <div className="shrink-0 p-3 border-t border-[#E0DCF0]">
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-10 h-10 bg-[#6B3FD9] rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-white">SA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Super Admin</p>
              <p className="text-xs text-gray-500 truncate">admin@exiuscart.com</p>
            </div>
          </div>
        )}
        <button
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-red-500/10 hover:text-red-600 w-full transition ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          title={collapsed ? 'Show menu' : undefined}
          className={`hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-white/70 hover:text-gray-900 w-full transition ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? <PanelLeftOpen className="w-5 h-5 flex-shrink-0" /> : <PanelLeftClose className="w-5 h-5 flex-shrink-0" />}
          {!collapsed && <span className="font-medium text-sm">Hide menu</span>}
        </button>
      </div>
    </aside>
  );
}

