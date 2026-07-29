'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Currency = string;

interface CurrencyContextValue {
  currency: Currency;
  // Changes the currency AND persists it as the shop's real currency
  // (same field Settings → General → Regional Settings edits) — use this
  // for standalone quick-changes, like the header's currency dropdown.
  setCurrency: (c: Currency) => void;
  // Updates the displayed currency locally only, no backend write — for
  // callers that already saved it themselves (Settings' combined save) or
  // that are just enforcing a known value (TheDersi's locked LKR), so we
  // don't fire a redundant/conflicting API call.
  syncCurrency: (c: Currency) => void;
  fmt: (amount: number, decimals?: number) => string;
  sym: string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  setCurrency: () => {},
  syncCurrency: () => {},
  fmt: (n) => `$${n}`,
  sym: '$',
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

function symFor(c: Currency) {
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  if (c === 'INR') return '₹';
  return c;
}

const STORAGE_KEY = 'billing_currency';

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // Instant paint from whatever was cached last time, while the real value
  // (the shop's actual saved currency) loads in the background below.
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === 'undefined') return 'USD';
    return localStorage.getItem(STORAGE_KEY) || 'USD';
  });

  // The shop's real currency (Settings → Regional Settings) is the single
  // source of truth — fetch it on mount so every page agrees with Settings
  // instead of each maintaining its own separate localStorage guess.
  useEffect(() => {
    import('@/lib/api').then(({ shopApi }) => {
      shopApi.getMyShop().then((res) => {
        const c = res.data?.currency;
        if (c) {
          setCurrencyState(c);
          try { localStorage.setItem(STORAGE_KEY, c); } catch {}
        }
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) setCurrencyState(e.newValue);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const syncCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: c }));
    } catch {}
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    syncCurrency(c);
    import('@/lib/api').then(({ shopApi }) => {
      shopApi.updateShop({ currency: c }).catch(() => {});
    });
  }, [syncCurrency]);

  const fmt = useCallback((amount: number, decimals = 2): string => {
    const n = (Number.isFinite(amount) ? amount : 0).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    if (currency === 'USD') return `$${n}`;
    if (currency === 'EUR') return `€${n}`;
    if (currency === 'INR') return `₹${n}`;
    return `${currency} ${n}`;
  }, [currency]);

  const value: CurrencyContextValue = {
    currency,
    setCurrency,
    syncCurrency,
    fmt,
    sym: symFor(currency),
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}
