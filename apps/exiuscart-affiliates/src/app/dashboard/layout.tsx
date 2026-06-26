'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Megaphone,
  User,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/dashboard',           label: 'Overview',   icon: LayoutDashboard },
  { href: '/dashboard/referrals', label: 'Referrals',  icon: Users },
  { href: '/dashboard/payouts',   label: 'Payouts',    icon: Wallet },
  { href: '/dashboard/marketing', label: 'Marketing',  icon: Megaphone },
  { href: '/dashboard/profile',   label: 'Profile',    icon: User },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) {
      router.replace('/login');
    } else {
      setAuthChecked(true);
    }
  }, [router]);

  if (!authChecked) return null;

  return (
    <div className="min-h-screen bg-[#0B1121] flex">

      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-60 bg-[#0D1526] border-r border-gray-800 fixed inset-y-0 left-0 z-30">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Sidebar — mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-60 bg-[#0D1526] border-r border-gray-800 flex flex-col z-50">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent pathname={pathname} onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:ml-60 flex-1 flex flex-col min-h-screen">
        {/* Top bar — mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0D1526] border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#7B4FE9] flex items-center justify-center">
              <span className="text-white font-black text-xs">E</span>
            </div>
            <span className="text-white font-bold text-sm">Affiliates</span>
          </div>
          <button onClick={() => setMobileOpen(true)} className="text-gray-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  onNav,
}: {
  pathname: string;
  onNav?: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="ExiusCart" width={32} height={32} className="flex-shrink-0" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">ExiusCart</p>
            <p className="text-[#7B4FE9] text-xs font-medium">Affiliates</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNav}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-[#7B4FE9]/20 text-[#7B4FE9]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#7B4FE9]" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={() => {
            localStorage.removeItem('affiliate_token');
            localStorage.removeItem('affiliate_id');
            localStorage.removeItem('affiliate_name');
            localStorage.removeItem('affiliate_code');
            window.location.href = '/login';
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );
}
