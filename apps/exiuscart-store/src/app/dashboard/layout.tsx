'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShopSidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { TrialBanner } from '@/components/layout/trial-banner';
import { CurrencyProvider } from '@/components/providers/currency-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mobileMenuOpen = false; // sidebar is desktop-only; mobile uses bottom nav
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
    } else {
      setAuthed(true);
      // Always sync shop_id from the API so stale localStorage values (e.g. from a
      // previous user session or a setup-link login) are corrected immediately.
      import('@/lib/api').then(({ shopApi }) => {
        shopApi.getMyShop().then((res) => {
          if (res.data?.id) localStorage.setItem('shop_id', String(res.data.id));
        }).catch(() => {});
      });
    }
  }, [router]);

  if (!authed) return null;

  return (
    <CurrencyProvider>
      <div className="min-h-screen bg-background">
        <ShopSidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => {}}
        />
        <div
          className={`min-h-screen transition-all duration-300 pb-20 lg:pb-0 ${
            sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
          }`}
        >
          <Header onMenuClick={() => {}} />
          <TrialBanner />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
        <MobileBottomNav />
      </div>
    </CurrencyProvider>
  );
}
