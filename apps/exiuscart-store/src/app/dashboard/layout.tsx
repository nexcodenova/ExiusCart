'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ShopSidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { TrialBanner } from '@/components/layout/trial-banner';
import { CurrencyProvider } from '@/components/providers/currency-provider';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { applyBrandColor } from '@/lib/brand-color';
import { WelcomeSplash } from '@/components/welcome-splash';
import { ProfileCompletionDialog } from '@/components/profile-completion-dialog';
import { AccessProvider, useAccess } from '@/components/providers/access-provider';
import { AccessLoading, NoAccess, PlanEnded, StaffHome } from '@/components/dashboard/access-screens';

// Only page an expired account can still reach. Everywhere else (Quotations,
// POS, Add Product, every sidebar link) sends the owner to Billing instead of
// showing the real page. Blocking specific actions one-by-one kept missing
// things (Quotations wasn't gated at all); redirecting the whole dashboard is
// the version that can't be missed.
const ALLOWED_WHEN_EXPIRED = ['/dashboard/billing', '/dashboard/support'];

// Standalone printable documents (invoice, quotation print, payment
// receipt, packing slip, barcode sheet) — each is a fully self-contained
// page with its own print stylesheet and an auto-triggered window.print(),
// never meant to sit inside the dashboard shell. Without this, the
// Header/Sidebar/MobileBottomNav were rendering right into the printed
// page and the PDF export, which is what this checks skip.
const PRINT_ONLY_PATTERN = /\/(invoice|print|payment-receipt|packing-slip|barcode)(\/|$)/;

// Splash sits outside the auth gate so it mounts on the very first render —
// otherwise the dashboard shell would flash for a frame before it appeared.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WelcomeSplash />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}

// What a signed-in person actually gets to see. The owner is untouched
// (children render exactly as before). A team member gets: nothing while we
// find out who they are, a "plan ended" notice if the owner's plan lapsed, a
// shortcut home instead of the stats dashboard if their role has no
// Reports & analytics, and a plain "no access" page for anything their role
// doesn't include. The API refuses all of these itself - this is only so
// nobody stares at a screen of failed requests.
function AccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const access = useAccess();
  if (access.loading) return <AccessLoading />;
  if (access.isOwner) return <>{children}</>;
  if (access.planExpired) return <PlanEnded />;
  if (pathname === '/dashboard' && !access.can('analytics', 'view')) return <StaffHome />;
  if (!access.canPath(pathname)) return <NoAccess />;
  return <>{children}</>;
}

function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
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

  // Re-check the subscription now, whenever the tab is focused again, and
  // every minute. A plan an admin changes (or a card payment that clears) then
  // unlocks the account by itself, and one that expires locks it, without the
  // owner having to reload the page.
  useEffect(() => {
    if (!authed) return;
    let stopped = false;
    const check = () => {
      import('@/lib/api').then(async ({ subscriptionApi, shopApi }) => {
        let shopId = localStorage.getItem('shop_id');
        if (!shopId) {
          try { shopId = String((await shopApi.getMyShop()).data?.id ?? ''); } catch { return; }
          if (!shopId) return;
        }
        subscriptionApi.getCurrent(shopId)
          .then((res: any) => { if (!stopped) setTrialExpired(!!res.data?.plan?.is_expired || !!res.data?.awaiting_payment); })
          .catch(() => {});
      });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, 60_000);
    return () => {
      stopped = true;
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [authed]);

  // An expired trial, a failed first payment or a lapsed plan can only use Billing.
  const blocked = trialExpired && !ALLOWED_WHEN_EXPIRED.includes(pathname);
  useEffect(() => {
    if (blocked) router.replace('/dashboard/billing');
  }, [blocked, router]);

  if (!authed) return <div className="min-h-screen bg-background" />;

  if (PRINT_ONLY_PATTERN.test(pathname)) {
    return <CurrencyProvider>{children}</CurrencyProvider>;
  }

  if (blocked) return <div className="min-h-screen bg-background" />;

  return (
    <CurrencyProvider>
      <AccessProvider>
      <ConfirmProvider>
        {/* SidebarProvider now owns collapse state itself (cookie-persisted
            — a real improvement over the old plain useState, which reset
            on every reload). Mobile is untouched: SidebarInset's own
            min-h-screen + the pb-20 here still reserve the same room for
            MobileBottomNav as before; nothing here ever opens the
            sidebar's mobile Sheet, so mobile keeps looking exactly as it
            did pre-rebuild. */}
        <SidebarProvider>
          <ShopSidebar />
          <SidebarInset className="min-h-screen pb-20 lg:pb-0">
            <Header onMenuClick={() => {}} />
            <TrialBanner />
            {/* Small top padding (pt-3): a bigger one reads as dead space between
                the header and each page's own heading. */}
            <main className="px-4 pb-4 pt-3 lg:px-5 lg:pb-5 lg:pt-3"><AccessGate>{children}</AccessGate></main>
            <ProfileCompletionDialog />
          </SidebarInset>
        </SidebarProvider>
        <MobileBottomNav />
      </ConfirmProvider>
      </AccessProvider>
    </CurrencyProvider>
  );
}
