'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export type Currency = string;

interface CurrencyContextValue {
  // Display currency — freely changeable, every read-only amount shown
  // across the app is live-converted into this. Safe to flip back and
  // forth any number of times; nothing in the database ever changes.
  currency: Currency;
  // Base currency — fixed at shop creation (LKR always, for TheDersi
  // sellers). This is what prices are actually entered and stored in.
  // Price ENTRY fields should format/label against this, not `currency`,
  // so what a seller types is never ambiguous about which currency it's in.
  baseCurrency: Currency;
  // Changes the currency AND persists it as the shop's real currency
  // (same field Settings → General → Regional Settings edits) — use this
  // for standalone quick-changes, like the header's currency dropdown.
  setCurrency: (c: Currency) => void;
  // Updates the displayed currency locally only, no backend write — for
  // callers that already saved it themselves (Settings' combined save) or
  // that are just enforcing a known value (TheDersi's locked LKR), so we
  // don't fire a redundant/conflicting API call.
  syncCurrency: (c: Currency) => void;
  // Converts a raw base-currency amount into the display currency and
  // formats it with the right symbol — use for read-only amounts
  // (product prices shown to browse, order totals, dashboard stats).
  fmt: (amount: number, decimals?: number) => string;
  // Same conversion, no formatting — for callers doing their own math/layout.
  convert: (amount: number) => number;
  // Formats a raw amount as-is in the BASE currency, no conversion — use
  // for price entry fields (Cost Price, Selling Price) so what the seller
  // types is unambiguous, regardless of what display currency is active.
  fmtBase: (amount: number, decimals?: number) => string;
  // Converts an amount between any two currencies (not just base↔display)
  // using the same rates the rest of the provider already fetches — for a
  // price-entry field that lets the seller type in a currency other than
  // baseCurrency and has the actual saved value converted to baseCurrency
  // right before it's sent to the backend.
  convertBetween: (amount: number, from: Currency, to: Currency) => number;
  sym: string;       // display currency's symbol
  baseSym: string;    // base currency's symbol — use for entry field labels
  ratesLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  baseCurrency: 'USD',
  setCurrency: () => {},
  syncCurrency: () => {},
  fmt: (n) => `$${n}`,
  convert: (n) => n,
  fmtBase: (n) => `$${n}`,
  convertBetween: (n) => n,
  sym: '$',
  baseSym: '$',
  ratesLoading: false,
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

// Same currency list Settings → Regional Settings offers. Real symbols
// where one is commonly used; anything without a distinct glyph falls back
// to its ISO code, which is always unambiguous on its own.
const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'AED', SAR: 'SAR',
  LKR: 'Rs', EGP: 'E£', PKR: 'Rs', BDT: '৳', CNY: '¥', JPY: '¥',
  MYR: 'RM', SGD: 'S$', CAD: 'C$', AUD: 'A$', QAR: 'QAR', KWD: 'KWD',
  BHD: 'BHD', OMR: 'OMR', NGN: '₦', KES: 'KSh', ZAR: 'R', TRY: '₺',
  IDR: 'Rp', PHP: '₱', THB: '฿',
};

// Exported so standalone pages that don't render under the normal dashboard
// layout (print-only pages: invoice, packing slip, payment receipt) can
// derive the right symbol straight from a fetched shop object without
// needing the full provider context — same lookup, not a second copy of it.
export function symFor(c: Currency) {
  return SYMBOLS[c] ?? c;
}

const STORAGE_KEY = 'billing_currency';
const RATES_CACHE_KEY_PREFIX = 'fx_rates_';
const RATES_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — matches the backend's own cache window

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // Instant paint from whatever was cached last time, while the real value
  // (the shop's actual saved currency) loads in the background below.
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === 'undefined') return 'USD';
    return localStorage.getItem(STORAGE_KEY) || 'USD';
  });
  const [baseCurrency, setBaseCurrency] = useState<Currency>('USD');
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const ratesBaseRef = useRef<string | null>(null);

  // The shop's real currency (Settings → Regional Settings) is the single
  // source of truth — fetch it on mount so every page agrees with Settings
  // instead of each maintaining its own separate localStorage guess.
  useEffect(() => {
    import('@/lib/api').then(({ shopApi }) => {
      shopApi.getMyShop().then((res) => {
        const c = res.data?.currency;
        const base = res.data?.base_currency || c;
        if (c) {
          setCurrencyState(c);
          try { localStorage.setItem(STORAGE_KEY, c); } catch {}
        }
        if (base) setBaseCurrency(base);
      }).catch(() => {});
    });
  }, []);

  // Live exchange rates, fetched relative to the shop's base currency —
  // only actually needed once `currency` (display) diverges from
  // `baseCurrency`, but fetched eagerly so switching feels instant rather
  // than waiting on a network round-trip at the moment of the switch.
  useEffect(() => {
    if (!baseCurrency) return;
    if (ratesBaseRef.current === baseCurrency) return;
    ratesBaseRef.current = baseCurrency;

    const cacheKey = RATES_CACHE_KEY_PREFIX + baseCurrency;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.rates && Date.now() - parsed.fetchedAt < RATES_CACHE_TTL_MS) {
          setRates(parsed.rates);
          return;
        }
      }
    } catch {}

    setRatesLoading(true);
    import('@/lib/api').then(({ shopApi }) => {
      shopApi.getExchangeRates(baseCurrency)
        .then((res) => {
          const r = res.data?.rates;
          if (r) {
            setRates(r);
            try { localStorage.setItem(cacheKey, JSON.stringify({ rates: r, fetchedAt: Date.now() })); } catch {}
          }
        })
        .catch(() => {})
        .finally(() => setRatesLoading(false));
    });
  }, [baseCurrency]);

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

  const convert = useCallback((amount: number): number => {
    // Prices can arrive as strings (Decimal fields serialize that way) —
    // Number.isFinite doesn't coerce, so a raw string would silently become 0.
    const parsed = Number(amount);
    const n = Number.isFinite(parsed) ? parsed : 0;
    if (currency === baseCurrency || !rates) return n;
    const rate = rates[currency];
    return rate ? n * rate : n;
  }, [currency, baseCurrency, rates]);

  const formatWith = useCallback((n: number, c: Currency, decimals: number) => {
    const formatted = n.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const s = symFor(c);
    // Symbols like $/€/£/¥ read naturally glued to the number; multi-letter
    // codes (AED, LKR, ISO fallbacks) read better with a space.
    return s.length <= 1 ? `${s}${formatted}` : `${s} ${formatted}`;
  }, []);

  const fmt = useCallback((amount: number, decimals = 2): string => {
    return formatWith(convert(amount), currency, decimals);
  }, [convert, currency, formatWith]);

  const fmtBase = useCallback((amount: number, decimals = 2): string => {
    const parsed = Number(amount);
    return formatWith(Number.isFinite(parsed) ? parsed : 0, baseCurrency, decimals);
  }, [baseCurrency, formatWith]);

  // `rates` maps baseCurrency -> every other currency (that's the shape
  // /shops/exchange-rates always returns, relative to baseCurrency — see
  // the fetch effect above). Converting between two arbitrary currencies
  // routes through baseCurrency: from -> base -> to. Best-effort — returns
  // the raw amount unconverted if rates haven't loaded yet rather than
  // blocking on it, same fallback philosophy as `convert` above.
  const convertBetween = useCallback((amount: number, from: Currency, to: Currency): number => {
    const parsed = Number(amount);
    const n = Number.isFinite(parsed) ? parsed : 0;
    if (from === to) return n;
    if (!rates) return n;
    const toBase = from === baseCurrency ? n : (rates[from] ? n / rates[from] : n);
    return to === baseCurrency ? toBase : (rates[to] ? toBase * rates[to] : toBase);
  }, [rates, baseCurrency]);

  const value: CurrencyContextValue = {
    currency,
    baseCurrency,
    setCurrency,
    syncCurrency,
    fmt,
    convert,
    fmtBase,
    convertBetween,
    sym: symFor(currency),
    baseSym: symFor(baseCurrency),
    ratesLoading,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}
