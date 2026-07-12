'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { menuItems, PREMIUM_HREFS } from './sidebar';
import { MoreHorizontal, X, LogOut, Lock } from 'lucide-react';
import { shopApi } from '@/lib/api';

export function MobileBottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [plan, setPlan] = useState('');

  useEffect(() => {
    shopApi.getMyShop()
      .then((res) => {
        const sub = res.data?.subscription;
        setPlan((sub?.plan || '').toLowerCase());
      })
      .catch(() => {});
  }, []);

  const canAccessPremium = plan === 'premium' || plan === 'thedersi_pro';

  const mainItems = menuItems.slice(0, 4);
  const moreItems = menuItems.slice(4);

  const handlePremiumClick = () => {
    setShowMore(false);
    setShowUpgrade(true);
    setTimeout(() => setShowUpgrade(false), 3500);
  };

  return (
    <>
      {/* More Menu Overlay */}
      {showMore && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setShowMore(false)} />
      )}

      {/* Upgrade toast */}
      {showUpgrade && (
        <div className="fixed top-4 left-4 right-4 z-[60] lg:hidden">
          <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3">
            <Lock className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Premium Feature</p>
              <p className="text-xs text-muted-foreground">Upgrade to Premium to access HR, Projects & more.</p>
            </div>
            <button onClick={() => setShowUpgrade(false)} className="text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* More Menu Panel */}
      {showMore && (
        <div className="fixed bottom-16 left-0 right-0 bg-card border-t border-border z-50 lg:hidden rounded-t-2xl animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">More Options</span>
            <button type="button" onClick={() => setShowMore(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="p-3 grid grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const isPremium = PREMIUM_HREFS.has(item.href);
              const locked = isPremium && !canAccessPremium;
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

              if (locked) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={handlePremiumClick}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl text-muted-foreground/50 relative"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                    <Lock className="w-2.5 h-2.5 absolute top-1.5 right-1.5 text-amber-500" />
                  </button>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
            {/* Logout */}
            <button
              type="button"
              onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('shop_id'); window.location.href = '/login'; }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[10px] font-medium">Logout</span>
            </button>
          </nav>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 lg:hidden">
        <div className="flex items-center justify-around px-2 py-1 safe-area-pb">
          {mainItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all min-w-[60px] ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                {isActive && <div className="w-1 h-1 bg-primary rounded-full mt-0.5" />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all min-w-[60px] ${
              showMore ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
