'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Users,
  CreditCard,
  Package,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
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
// (above) stays flat because the mobile bottom nav reads it directly.
const PRODORA_CHILDREN = [
  { href: '/dashboard/shopping', label: 'Products', exact: true },
  { href: '/dashboard/shopping/categories', label: 'Categories', exact: false },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function AdminSidebar({ collapsed, onCollapsedChange }: AdminSidebarProps) {
  const pathname = usePathname();
  const onProdora = pathname.startsWith('/dashboard/shopping');
  const [prodoraOpen, setProdoraOpen] = useState(onProdora);

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#0B1121] border-r border-gray-800 transition-all duration-300 z-50 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="ExiusCart" width={32} height={32} className="flex-shrink-0" />
          {!collapsed && (
            <span className="text-xl font-bold text-white tracking-tight">
              <span className="text-[#6B3FD9]">Exius</span>Cart
            </span>
          )}
        </Link>
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition hidden lg:block"
        >
          <ChevronLeft
            className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Admin Badge */}
      {!collapsed && (
        <div className="shrink-0 px-4 py-3 border-b border-gray-800">
          <span className="text-xs font-semibold text-[#6B3FD9] bg-[#6B3FD9]/10 px-2.5 py-1 rounded">
            ADMIN PANEL
          </span>
        </div>
      )}

      {/* Navigation — scrolls on its own when the menu is taller than the
          screen, instead of running underneath the Admin Info block below
          (which used to sit on top via absolute positioning and covered
          the last couple of items on any laptop-height screen). */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          if (item.href === '/dashboard/shopping') {
            return (
              <div key={item.href}>
                <div className={`flex items-stretch rounded-lg transition-all ${onProdora ? 'bg-[#151F32] text-white' : 'text-gray-400 hover:bg-[#151F32] hover:text-white'}`}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setProdoraOpen(true)}
                    className="flex flex-1 items-center gap-3 px-3 py-2.5"
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`} />
                    {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
                  </Link>
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
                  <div className="mt-1 space-y-1 pl-4">
                    {PRODORA_CHILDREN.map((child) => {
                      const active = child.exact ? pathname === child.href : pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href} href={child.href}
                          className={`block rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                            active ? 'bg-[#6B3FD9] text-black' : 'text-gray-400 hover:bg-[#151F32] hover:text-white'
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
                  ? 'bg-[#6B3FD9] text-black'
                  : 'text-gray-400 hover:bg-[#151F32] hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`} />
              {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Admin Info */}
      <div className="shrink-0 p-3 border-t border-gray-800">
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-10 h-10 bg-[#6B3FD9] rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-black">SA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Super Admin</p>
              <p className="text-xs text-gray-500 truncate">admin@exiuscart.com</p>
            </div>
          </div>
        )}
        <button
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 w-full transition ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

