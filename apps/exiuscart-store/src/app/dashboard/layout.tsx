'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { ShopSidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { TrialBanner } from '@/components/layout/trial-banner';
import { CurrencyProvider } from '@/components/providers/currency-provider';
import { applyBrandColor } from '@/lib/brand-color';

// Only page an expired trial can still reach — everywhere else (Quotations,
// POS, Add Product, every sidebar link) shows the lock screen below instead
// of its real content. Blocking specific actions one-by-one kept missing
// things (Quotations wasn't gated at all); replacing the whole dashboard is
// the version that can't be missed.
const ALLOWED_WHEN_EXPIRED = ['/dashboard/billing'];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mobileMenuOpen = false; // sidebar is desktop-only; mobile uses bottom nav
  const [authed, setAuthed] = useState(false);
  const [trialExpired, setTrialExpired] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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
          // Apply brand color as CSS custom property so each seller sees their own accent color
          applyBrandColor(res.data?.brand_color, res.data?.accent_color);
        }).catch(() => {});
      });
    }
  }, [router]);

  useEffect(() => {
    const shopId = localStorage.getItem('shop_id');
    if (!shopId) return;
    import('@/lib/api').then(({ subscriptionApi }) => {
      subscriptionApi.getCurrent(shopId)
        .then((res: any) => setTrialExpired(!!res.data?.plan?.is_expired))
        .catch(() => {});
    });
  }, []);

  if (!authed) return <div className="min-h-screen bg-background" />;

  if (trialExpired && !ALLOWED_WHEN_EXPIRED.includes(pathname)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl border border-border w-full max-w-md p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-red-600" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">Your free trial has ended</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Upgrade to Starter or Premium to keep selling, adding products, and using ExiusCart.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard/billing')}
            className="w-full bg-red-600 text-white font-bold px-4 py-2.5 rounded-lg hover:bg-red-700 transition mb-3"
          >
            Upgrade Now
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('access_token');
              localStorage.removeItem('shop_id');
              router.replace('/login');
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

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
