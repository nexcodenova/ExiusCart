'use client';

import { createContext, useContext, ReactNode } from 'react';
import { CurrencyCode, currencies, defaultCurrency, CurrencyConfig } from '@/config/pricing';

interface CurrencyContextType {
  currency: CurrencyCode;
  currencyConfig: CurrencyConfig;
  isLoading: boolean;
  detectedCountry: string | null;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// USD is the only currency now (see config/pricing.ts) — no IP lookup, no
// loading state, nothing to detect. Kept as a context/provider rather than
// a plain import so every existing useCurrency() call site keeps working
// unchanged.
const value: CurrencyContextType = {
  currency: defaultCurrency,
  currencyConfig: currencies[defaultCurrency],
  isLoading: false,
  detectedCountry: null,
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
