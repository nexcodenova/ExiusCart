'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, Search, Menu, User, Sun, Moon, GitBranch, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import { useCurrency, type Currency } from '@/components/providers/currency-provider';

const CURRENCIES: Currency[] = ['USD', 'AED', 'LKR', 'EUR', 'INR'];
const LKR_ONLY_CURRENCIES: Currency[] = ['LKR'];

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const [activeBranchName, setActiveBranchName] = useState<string | null>(null);
  const [showCurrencyDrop, setShowCurrencyDrop] = useState(false);
  const [userName, setUserName] = useState('');
  const [isTheDersiShop, setIsTheDersiShop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUserName(u.full_name || u.email || '');
    } catch {}
  }, []);

  useEffect(() => {
    import('@/lib/api').then(({ shopApi, channelsApi }) => {
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
          if (hasTheDersi) {
            setCurrency('LKR');
          }
        }).catch(() => {});
      }
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowCurrencyDrop(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleTheme = () => setTheme(resolvedTheme === 'light' ? 'dark' : 'light');

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
      {/* Mobile Menu */}
      <button type="button" onClick={onMenuClick} aria-label="Open menu" title="Open menu"
        className="lg:hidden p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
        <Menu className="w-6 h-6" />
      </button>

      {/* Search */}
      <div className="hidden md:flex items-center flex-1 max-w-md ml-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder="Search products, orders..."
            className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Mobile Search */}
        <button type="button" aria-label="Search" title="Search"
          className="md:hidden p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
          <Search className="w-5 h-5" />
        </button>

        {/* Active Branch */}
        {activeBranchName && (
          <Link href="/dashboard/branches"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition">
            <GitBranch className="w-3.5 h-3.5" />
            <span className="max-w-[120px] truncate">{activeBranchName}</span>
          </Link>
        )}

        {/* Currency / Region Switcher */}
        <div ref={dropRef} className="relative">
          <button type="button" onClick={() => !isTheDersiShop && setShowCurrencyDrop(!showCurrencyDrop)}
            title={isTheDersiShop ? 'LKR — TheDersi marketplace' : 'Change currency'}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition">
            <span>{currency}</span>
            {!isTheDersiShop && <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showCurrencyDrop ? 'rotate-180' : ''}`} />}
          </button>

          {showCurrencyDrop && !isTheDersiShop && (
            <div className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-xl z-50 w-32 overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currency</p>
              </div>
              {CURRENCIES.map(c => (
                <button key={c} type="button"
                  onClick={() => { setCurrency(c); setShowCurrencyDrop(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted transition text-left ${currency === c ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}>
                  <span>{c}</span>
                  {currency === c && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button type="button" onClick={toggleTheme}
          aria-label={resolvedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={resolvedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
          {resolvedTheme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <button type="button" aria-label="Notifications" title="Notifications"
          className="relative p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        {/* Profile */}
        <Link href="/dashboard/profile" aria-label="Profile" title="Profile"
          className="flex items-center gap-2 p-2 hover:bg-muted rounded-lg transition">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          {userName && <span className="hidden md:block text-sm font-medium text-foreground">{userName}</span>}
        </Link>
      </div>
    </header>
  );
}
