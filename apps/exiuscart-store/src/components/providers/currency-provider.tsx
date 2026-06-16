'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Currency = 'AED' | 'USD' | 'LKR';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  fmt: (amount: number, decimals?: number) => string;
  sym: string;
  flag: string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  setCurrency: () => {},
  fmt: (n) => `$${n}`,
  sym: '$',
  flag: '🌍',
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

function symFor(c: Currency) {
  if (c === 'AED') return 'AED';
  if (c === 'LKR') return 'LKR';
  return '$';
}
function flagFor(c: Currency) {
  if (c === 'AED') return '🇦🇪';
  if (c === 'LKR') return '🇱🇰';
  return '🌍';
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('USD');

  useEffect(() => {
    const saved = localStorage.getItem('billing_currency') as Currency | null;
    if (saved && (['AED', 'USD', 'LKR'] as string[]).includes(saved)) {
      setCurrencyState(saved as Currency);
    } else {
      const country = localStorage.getItem('user_country') || '';
      if (country === 'AE') setCurrencyState('AED');
      else if (country === 'LK') setCurrencyState('LKR');
    }
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'billing_currency' && e.newValue) {
        const v = e.newValue as Currency;
        if ((['AED', 'USD', 'LKR'] as string[]).includes(v)) setCurrencyState(v as Currency);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem('billing_currency', c);
    const countryMap: Record<Currency, string> = { AED: 'AE', USD: 'OTHER', LKR: 'LK' };
    localStorage.setItem('user_country', countryMap[c]);
    window.dispatchEvent(new StorageEvent('storage', { key: 'billing_currency', newValue: c }));
  }, []);

  const fmt = useCallback((amount: number, decimals = 2): string => {
    const n = amount.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    if (currency === 'USD') return `$${n}`;
    if (currency === 'LKR') return `LKR ${n}`;
    return `AED ${n}`;
  }, [currency]);

  const value: CurrencyContextValue = {
    currency,
    setCurrency,
    fmt,
    sym: symFor(currency),
    flag: flagFor(currency),
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}
