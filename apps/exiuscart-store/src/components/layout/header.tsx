'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bell, Search, User, Sun, Moon, ChevronDown, Crown,
  Settings, CreditCard, LogOut, UserCircle, LifeBuoy, Check, CheckCheck, ArrowRight,
} from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import { useCurrency, type Currency } from '@/components/providers/currency-provider';
import { ordersApi } from '@/lib/api';
import { FeedbackPopover } from '@/components/feedback-dialog';
import { GlobalSearch } from '@/components/layout/global-search';
import {
  type ActivityEvent, ACTIVITY_EVENT_META, DEFAULT_ACTIVITY_EVENT_META, activityTimeAgo,
} from '@/lib/activity-event-meta';

// Dropdown shows a short, glanceable preview only — the full history lives
// on its own page (see the "View all" footer link below).
const HEADER_NOTIF_PREVIEW_COUNT = 4;

// Same full list Settings → Regional Settings offers, so switching currency
// from the header never gives a narrower choice than Settings does.
const CURRENCIES: Currency[] = [
  'AED', 'SAR', 'USD', 'EUR', 'GBP', 'INR', 'LKR', 'BDT', 'PKR', 'MYR',
  'SGD', 'CAD', 'AUD', 'QAR', 'KWD', 'BHD', 'OMR', 'EGP', 'NGN', 'KES',
  'ZAR', 'TRY', 'IDR', 'PHP', 'THB', 'JPY', 'CNY',
];

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { currency, setCurrency, syncCurrency } = useCurrency();
  const [activeBranchName, setActiveBranchName] = useState<string | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [showCurrencyDrop, setShowCurrencyDrop] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifEvents, setNotifEvents] = useState<ActivityEvent[]>([]);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const unreadNotifCount = notifEvents.filter((e) => !e.is_read).length;
  const [notifTab, setNotifTab] = useState<'all' | 'unread'>('all');
  const notifShown = notifTab === 'unread' ? notifEvents.filter((e) => !e.is_read) : notifEvents;
  const [showProfile, setShowProfile] = useState(false);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isTheDersiShop, setIsTheDersiShop] = useState(false);
  const [planType, setPlanType] = useState('');
  const [showProdoraBlocked, setShowProdoraBlocked] = useState<'thedersi' | 'free_trial' | null>(null);

  const currencyRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUserName(u.full_name || u.email || '');
      setUserEmail(u.email || '');
    } catch {}
  }, []);

  // Store logo for the avatar; refreshed when the profile page changes it.
  useEffect(() => {
    const loadLogo = () => import('@/lib/api').then(({ shopApi }) => shopApi.getMyShop().then((r) => setStoreLogo(r.data?.logo_url ?? null)).catch(() => {}));
    loadLogo();
    window.addEventListener('store-updated', loadLogo);
    return () => window.removeEventListener('store-updated', loadLogo);
  }, []);

  useEffect(() => {
    import('@/lib/api').then(({ shopApi, channelsApi, subscriptionApi }) => {
      const shopId = localStorage.getItem('shop_id');
      shopApi.getAllBranches().then((res) => {
        if (shopId) {
          const active = res.data?.find((b: any) => String(b.id) === shopId);
          if (active) setActiveBranchName(active.name);
        }
      }).catch(() => {});
      if (shopId) {
        channelsApi.getConnections(shopId).then((res) => {
          const hasTheDersi = res.data?.some((c: any) => c.channel_type === 'thedersi') ?? false;
          setIsTheDersiShop(hasTheDersi);
          if (hasTheDersi) syncCurrency('LKR');
        }).catch(() => {});
        subscriptionApi.getCurrent(shopId).then((res) => {
          const plan = res.data?.plan;
          setPlanLabel(plan?.name || null);
          setDaysLeft(plan?.daysLeft ?? null);
          setPlanType((plan?.plan_type || 'free_trial').toLowerCase());
        }).catch(() => {});
      }
    });
  }, []);

  const loadNotifications = () => {
    const shopId = localStorage.getItem('shop_id');
    if (!shopId) { setNotifLoaded(true); return; }
    ordersApi.getActivityLog(shopId, HEADER_NOTIF_PREVIEW_COUNT)
      .then((res) => setNotifEvents(res.data?.events ?? []))
      .catch(() => {})
      .finally(() => setNotifLoaded(true));
  };

  useEffect(() => { loadNotifications(); }, []);

  const markNotifRead = (id: number) => {
    const shopId = localStorage.getItem('shop_id');
    if (!shopId) return;
    setNotifEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)));
    ordersApi.markActivityRead(shopId, id).catch(() => loadNotifications());
  };

  const markAllNotifRead = () => {
    const shopId = localStorage.getItem('shop_id');
    if (!shopId) return;
    setNotifEvents((prev) => prev.map((e) => ({ ...e, is_read: true })));
    ordersApi.markAllActivityRead(shopId).catch(() => loadNotifications());
  };

  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (currencyRef.current && !currencyRef.current.contains(t)) setShowCurrencyDrop(false);
      if (notifRef.current && !notifRef.current.contains(t)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(t)) setShowProfile(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleTheme = () => setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  const initials = userName ? userName.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '';

  function openProdora(path?: string) {
    if (isTheDersiShop) { setShowProdoraBlocked('thedersi'); return; }
    if (planType === 'free_trial') { setShowProdoraBlocked('free_trial'); return; }
    // Pass the account email through so Prodora can open straight into its
    // "confirm to continue" login step pre-filled, same as the old sidebar link.
    const next = path && /^\/[a-z0-9/_-]*$/i.test(path) ? `&next=${encodeURIComponent(path)}` : '';
    const url = userEmail
      ? `https://prodora.exiuscart.com?email=${encodeURIComponent(userEmail)}${next}`
      : `https://prodora.exiuscart.com${path && next ? path : ''}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // The sidebar's Prodora card asks the header to open Prodora, so both entry
  // points share one set of access rules (TheDersi / free-trial popups).
  const openProdoraRef = useRef(openProdora);
  openProdoraRef.current = openProdora;
  useEffect(() => {
    const handler = (e: Event) => openProdoraRef.current((e as CustomEvent<{ path?: string }>).detail?.path);
    window.addEventListener('open-prodora', handler);
    return () => window.removeEventListener('open-prodora', handler);
  }, []);

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
      {/* Mobile logo (replaces hamburger — sidebar is desktop-only) */}
      <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
        <Image src="/logo-ec.png" alt="ExiusCart" width={33} height={26} />
        <span className="text-lg font-bold">
          <span className="text-indigo-600 dark:text-indigo-400">Exius</span><span className="text-foreground">Cart</span>
        </span>
      </Link>

      {/* Search (desktop box + phone button) */}
      <GlobalSearch />

      {/* Right side */}
      <div className="flex shrink-0 items-center gap-1.5 lg:gap-2 ml-3">
        {/* Feedback — goes to the admin Reviews queue */}
        <FeedbackPopover />

        {/* Active branch — also carries the shop's plan + days left, moved
            here from the sidebar's old shop-info block */}
        {(planLabel || daysLeft != null) && (
          <Link href="/dashboard/billing"
            title={activeBranchName ? `Branch: ${activeBranchName}` : undefined}
            className="hidden xl:flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground">
            {planLabel && (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Crown className="h-3.5 w-3.5 text-indigo-500" /> {planLabel}
              </span>
            )}
            {daysLeft != null && (
              <>
                {planLabel && <span className="h-3 w-px bg-border" />}
                <span className="whitespace-nowrap">{daysLeft} days left</span>
              </>
            )}
          </Link>
        )}

        {/* Currency — quiet text button, Apify-style */}
        <div ref={currencyRef} className="relative">
          <button type="button" onClick={() => !isTheDersiShop && setShowCurrencyDrop(v => !v)}
            title={isTheDersiShop ? 'LKR — TheDersi marketplace' : 'Change currency'}
            className={`hidden sm:flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:bg-muted ${showCurrencyDrop ? 'bg-muted' : ''}`}>
            <span>{currency}</span>
            {!isTheDersiShop && <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showCurrencyDrop ? 'rotate-180' : ''}`} />}
          </button>
          {showCurrencyDrop && !isTheDersiShop && (
            <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Currency</p>
              <div className="max-h-72 overflow-y-auto p-1">
                {CURRENCIES.map(c => (
                  <button key={c} type="button"
                    onClick={() => { setCurrency(c); setShowCurrencyDrop(false); }}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition hover:bg-muted ${currency === c ? 'bg-muted font-medium text-foreground' : 'text-foreground'}`}>
                    <span>{c}</span>
                    {currency === c && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button type="button" onClick={() => setShowNotif(v => !v)} aria-label="Notifications"
            className={`relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground ${showNotif ? 'bg-muted text-foreground' : ''}`}>
            <Bell className="h-[18px] w-[18px]" />
            {unreadNotifCount > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-background" />
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                {unreadNotifCount > 0 && (
                  <button type="button" onClick={markAllNotifRead}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground">
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
                  </button>
                )}
              </div>
              {/* All / Unread tabs, underlined like the Apify console */}
              <div className="flex gap-4 border-b border-border px-4 text-xs">
                {(['all', 'unread'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setNotifTab(t)}
                    className={`-mb-px border-b-2 pb-2 font-medium capitalize transition ${notifTab === t ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                    {t}{t === 'unread' && unreadNotifCount > 0 ? ` (${unreadNotifCount})` : ''}
                  </button>
                ))}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {!notifLoaded ? (
                  <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</div>
                ) : notifShown.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <Bell className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{notifTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {notifShown.map((e) => {
                      const meta = ACTIVITY_EVENT_META[e.event_type] ?? DEFAULT_ACTIVITY_EVENT_META;
                      const Icon = meta.icon;
                      return (
                        <li key={e.id}>
                          <button type="button" onClick={() => !e.is_read && markNotifRead(e.id)}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/50">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-sm ${e.is_read ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>{e.title}</span>
                              {e.description && <span className="block truncate text-xs text-muted-foreground">{e.description}</span>}
                              <span className="mt-1 block text-[11px] text-muted-foreground/80">{activityTimeAgo(e.created_at)}</span>
                            </span>
                            {!e.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <Link href="/dashboard/notifications" onClick={() => setShowNotif(false)}
                className="flex items-center justify-center gap-1 border-t border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-foreground transition hover:bg-muted">
                View all notifications <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button type="button" onClick={() => setShowProfile(v => !v)} aria-label="Account menu"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted">
            <Avatar storeLogo={storeLogo} initials={initials} onError={() => setStoreLogo(null)} className="h-7 w-7" />
          </button>
          {showProfile && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              <div className="flex items-center gap-3 px-4 py-3">
                <Avatar storeLogo={storeLogo} initials={initials} onError={() => setStoreLogo(null)} className="h-10 w-10" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{userName || 'Account'}</p>
                  {userEmail && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
                </div>
              </div>
              {planLabel && (
                <Link href="/dashboard/billing" onClick={() => setShowProfile(false)}
                  className="mx-3 mb-2 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs transition hover:bg-muted">
                  <span className="flex items-center gap-1.5 font-medium text-foreground"><Crown className="h-3.5 w-3.5 text-indigo-500" /> {planLabel} plan</span>
                  {daysLeft != null && <span className="text-muted-foreground">{daysLeft} days left</span>}
                </Link>
              )}
              <div className="border-t border-border p-1">
                <MenuLink href="/dashboard/profile" icon={UserCircle} label="Store profile" onClick={() => setShowProfile(false)} />
                <MenuLink href="/dashboard/settings" icon={Settings} label="Settings" onClick={() => setShowProfile(false)} />
                <MenuLink href="/dashboard/billing" icon={CreditCard} label="Billing & subscription" onClick={() => setShowProfile(false)} />
                <MenuLink href="/dashboard/support" icon={LifeBuoy} label="Support" onClick={() => setShowProfile(false)} />
              </div>
              {/* Theme as a two-way switch, so the current mode is visible at a glance */}
              <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                <span className="text-sm text-foreground">Theme</span>
                <div className="flex rounded-md border border-border p-0.5">
                  {(['light', 'dark'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => resolvedTheme !== m && toggleTheme()} aria-label={`${m} mode`}
                      className={`flex h-6 w-7 items-center justify-center rounded transition ${resolvedTheme === m ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      {m === 'light' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-border p-1">
                <button type="button" onClick={logout}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition hover:bg-muted">
                  <LogOut className="h-4 w-4 text-muted-foreground" /> Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prodora access blocked — TheDersi sellers never get it; free trial needs to upgrade */}
      {showProdoraBlocked && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowProdoraBlocked(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/15 mb-4 mx-auto overflow-hidden">
              <img src="/prodora-logo.png" alt="" className="w-7 h-7 rounded-sm" />
            </div>
            <h3 className="text-lg font-bold text-foreground text-center mb-2">Prodora</h3>
            <p className="text-sm text-muted-foreground text-center mb-3">
              Thousands of winning products to sell — each comes with ready-made marketing videos, product images, and real customer reviews, so you can list and start selling right away.
            </p>
            <p className="text-sm font-medium text-foreground text-center mb-6">
              {showProdoraBlocked === 'thedersi'
                ? 'This is only for ExiusCart direct users.'
                : 'This is only for paid users.'}
            </p>
            {showProdoraBlocked === 'thedersi' ? (
              <button type="button" onClick={() => setShowProdoraBlocked(null)}
                className="w-full py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition">
                Got it
              </button>
            ) : (
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowProdoraBlocked(null)}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition">
                  Cancel
                </button>
                <Link href="/dashboard/billing" onClick={() => setShowProdoraBlocked(null)}
                  className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold text-center transition">
                  Upgrade
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

// Round avatar: the store logo when there is one, otherwise the owner's initials.
function Avatar({ storeLogo, initials, onError, className }: { storeLogo: string | null; initials: string; onError: () => void; className?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-xs font-semibold text-white ${className ?? ''}`}>
      {storeLogo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={storeLogo} alt="" className="h-full w-full object-cover" onError={onError} />
        : (initials || <User className="h-4 w-4" />)}
    </div>
  );
}

function MenuLink({ href, icon: Icon, label, onClick }: { href: string; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition hover:bg-muted">
      <Icon className="h-4 w-4 text-muted-foreground" /> {label}
    </Link>
  );
}
