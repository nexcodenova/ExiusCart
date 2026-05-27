'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Currency = 'AED' | 'LKR' | 'USD';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** e.g. "AED 1,250.00" or "LKR 12,500" or "$340.00" */
  fmt: (amount: number, decimals?: number) => string;
  /** Short symbol for inline use: "AED" / "LKR" / "$" */
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
  return 'USD';
}
function flagFor(c: Currency) {
  if (c === 'AED') return '🇦🇪';
  if (c === 'LKR') return '🇱🇰';
  return '🌍';
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('USD');

  // Read from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('billing_currency') as Currency | null;
    if (saved && ['AED', 'LKR', 'USD'].includes(saved)) {
      setCurrencyState(saved);
    } else {
      const country = localStorage.getItem('user_country') || '';
      if (country === 'AE') setCurrencyState('AED');
      else if (country === 'LK') setCurrencyState('LKR');
    }
  }, []);

  // Listen for localStorage changes (header switcher, billing page switcher)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'billing_currency' && e.newValue) {
        const v = e.newValue as Currency;
        if (['AED', 'LKR', 'USD'].includes(v)) setCurrencyState(v);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem('billing_currency', c);
    const countryMap: Record<Currency, string> = { AED: 'AE', LKR: 'LK', USD: 'OTHER' };
    localStorage.setItem('user_country', countryMap[c]);
    // Broadcast so other tabs / components hear it
    window.dispatchEvent(new StorageEvent('storage', { key: 'billing_currency', newValue: c }));
  }, []);

  const fmt = useCallback((amount: number, decimals = 2): string => {
    const n = amount.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    if (currency === 'USD') return `$${n}`;
    return `${currency} ${n}`;
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
