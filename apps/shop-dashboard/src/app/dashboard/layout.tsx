'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShopSidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { CurrencyProvider } from '@/components/providers/currency-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
    } else {
      setAuthed(true);
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
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <div
          className={`min-h-screen transition-all duration-300 pb-20 lg:pb-0 ${
            sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
          }`}
        >
          <Header onMenuClick={() => setMobileMenuOpen(true)} />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
        <MobileBottomNav />
      </div>
    </CurrencyProvider>
  );
}
