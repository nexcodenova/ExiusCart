'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  CurrencyCode,
  currencies,
  countryToCurrency,
  defaultCurrency,
  CurrencyConfig,
} from '@/config/pricing';

interface CurrencyContextType {
  currency: CurrencyCode;
  currencyConfig: CurrencyConfig;
  isLoading: boolean;
  detectedCountry: string | null;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_LOCK_KEY = 'exiuscart_currency_lock';
const validCurrencies: CurrencyCode[] = ['AED', 'USD'];

async function detectCountryFromIP(): Promise<string | null> {
  const apis = [
    {
      url: 'https://ip-api.com/json/?fields=countryCode',
      getCountry: (data: { countryCode?: string }) => data.countryCode,
    },
    {
      url: 'https://ipapi.co/json/',
      getCountry: (data: { country_code?: string }) => data.country_code,
    },
    {
      url: 'https://ipwho.is/',
      getCountry: (data: { country_code?: string }) => data.country_code,
    },
  ];

  for (const api of apis) {
    try {
      const response = await fetch(api.url, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        const countryCode = api.getCountry(data);
        if (countryCode) return countryCode;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [isLoading, setIsLoading] = useState(true);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);

  useEffect(() => {
    const initCurrency = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const previewCurrency = urlParams.get('preview_currency') as CurrencyCode | null;

      if (previewCurrency && validCurrencies.includes(previewCurrency)) {
        setCurrency(previewCurrency);
        setDetectedCountry('PREVIEW');
        setIsLoading(false);
        return;
      }

      const countryCode = await detectCountryFromIP();

      if (countryCode) {
        setDetectedCountry(countryCode);
        const detectedCurrency = countryToCurrency[countryCode] || defaultCurrency;
        setCurrency(detectedCurrency);
        sessionStorage.setItem(CURRENCY_LOCK_KEY, JSON.stringify({
          currency: detectedCurrency,
          country: countryCode,
          timestamp: Date.now(),
        }));
      } else {
        setCurrency(defaultCurrency);
      }

      setIsLoading(false);
    };

    initCurrency();
  }, []);

  const value: CurrencyContextType = {
    currency,
    currencyConfig: currencies[currency],
    isLoading,
    detectedCountry,
  };

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
