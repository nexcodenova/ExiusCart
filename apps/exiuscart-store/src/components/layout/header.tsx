'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bell, Search, User, Sun, Moon, GitBranch, ChevronDown,
  Settings, CreditCard, LogOut, UserCircle,
} from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import { useCurrency, type Currency } from '@/components/providers/currency-provider';

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
  const [showProfile, setShowProfile] = useState(false);
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

  function openProdora() {
    if (isTheDersiShop) { setShowProdoraBlocked('thedersi'); return; }
    if (planType === 'free_trial') { setShowProdoraBlocked('free_trial'); return; }
    // Pass the account email through so Prodora can open straight into its
    // "confirm to continue" login step pre-filled, same as the old sidebar link.
    const url = userEmail
      ? `https://prodora.exiuscart.com?email=${encodeURIComponent(userEmail)}`
      : 'https://prodora.exiuscart.com';
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
      {/* Mobile logo (replaces hamburger — sidebar is desktop-only) */}
      <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
        <Image src="/logo.svg" alt="ExiusCart" width={26} height={26} />
        <span className="text-lg font-bold">
          <span className="text-indigo-600 dark:text-indigo-400">Exius</span><span className="text-foreground">Cart</span>
        </span>
      </Link>

      {/* Search */}
      <div className="hidden md:flex items-center flex-1 max-w-md ml-4">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search products, orders..."
            className="w-full pl-11 pr-4 py-2.5 bg-muted/60 border border-transparent rounded-xl focus:bg-background focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 outline-none text-foreground placeholder:text-muted-foreground transition" />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5 lg:gap-2">
        {/* Mobile search */}
        <button type="button" aria-label="Search"
          className="md:hidden p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
          <Search className="w-5 h-5" />
        </button>

        {/* Prodora cross-sell — moved here from the sidebar so it reads as
            an invitation to a separate product, not a regular nav link.
            Mobile: just the logo (matches the other icon-only mobile
            header buttons). sm+: full box with the "Prodora" label. */}
        <button type="button" onClick={openProdora} aria-label="Prodora"
          className="sm:hidden p-1.5 hover:bg-muted rounded-lg transition">
          <img src="/prodora-logo.png" alt="" className="w-5 h-5 rounded-md" />
        </button>
        <button type="button" onClick={openProdora}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition">
          <img src="/prodora-logo.png" alt="" className="w-4 h-4 shrink-0 rounded-md" />
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Prodora</span>
        </button>

        {/* Active branch — also carries the shop's plan + days left, moved
            here from the sidebar's old shop-info block */}
        {activeBranchName && (
          <Link href="/dashboard/branches"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-xl text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition">
            <GitBranch className="w-3.5 h-3.5" />
            <span className="max-w-[120px] truncate">{activeBranchName}</span>
            {planLabel && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-[10px]">{planLabel}</span>
              </>
            )}
            {daysLeft != null && (
              <>
                <span className="opacity-40">·</span>
                <span className="opacity-70">{daysLeft}d</span>
              </>
            )}
          </Link>
        )}

        {/* Currency */}
        <div ref={currencyRef} className="relative">
          <button type="button" onClick={() => !isTheDersiShop && setShowCurrencyDrop(v => !v)}
            title={isTheDersiShop ? 'LKR — TheDersi marketplace' : 'Change currency'}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition">
            <span>{currency}</span>
            {!isTheDersiShop && <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showCurrencyDrop ? 'rotate-180' : ''}`} />}
          </button>
          {showCurrencyDrop && !isTheDersiShop && (
            <div className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-xl z-50 w-32 max-h-80 overflow-y-auto">
              <div className="sticky top-0 bg-card px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currency</p>
              </div>
              {CURRENCIES.map(c => (
                <button key={c} type="button"
                  onClick={() => { setCurrency(c); setShowCurrencyDrop(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted transition text-left ${currency === c ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-500/10' : 'text-foreground'}`}>
                  <span>{c}</span>
                  {currency === c && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button type="button" onClick={toggleTheme}
          aria-label={resolvedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
          {resolvedTheme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button type="button" onClick={() => setShowNotif(v => !v)} aria-label="Notifications"
            className="relative p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
            <Bell className="w-5 h-5" />
          </button>
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="font-semibold text-foreground">Notifications</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <div className="px-4 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
                  <p className="text-xs text-muted-foreground">No new notifications</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button type="button" onClick={() => setShowProfile(v => !v)} aria-label="Account menu"
            className="flex items-center gap-2 p-1 pr-2 hover:bg-muted rounded-xl transition">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-semibold text-white">
              {initials || <User className="w-4 h-4" />}
            </div>
            {userName && <span className="hidden md:block max-w-[140px] truncate text-sm font-medium text-foreground">{userName}</span>}
            <ChevronDown className={`hidden md:block w-4 h-4 text-muted-foreground transition-transform ${showProfile ? 'rotate-180' : ''}`} />
          </button>
          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="truncate text-sm font-medium text-foreground">{userName || 'Account'}</p>
                {userEmail && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
              </div>
              <div className="py-1">
                <MenuLink href="/dashboard/profile" icon={UserCircle} label="My Profile" onClick={() => setShowProfile(false)} />
                <MenuLink href="/dashboard/settings" icon={Settings} label="Settings" onClick={() => setShowProfile(false)} />
                <MenuLink href="/dashboard/billing" icon={CreditCard} label="Billing & Plan" onClick={() => setShowProfile(false)} />
              </div>
              <div className="border-t border-border py-1">
                <button type="button" onClick={logout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition">
                  <LogOut className="h-4 w-4" /> Log out
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

function MenuLink({ href, icon: Icon, label, onClick }: { href: string; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition">
      <Icon className="h-4 w-4 text-muted-foreground" /> {label}
    </Link>
  );
}
