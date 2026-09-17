// Single currency, on purpose — checkout (Lemon Squeezy) only ever charges
// USD, so showing a region-detected AED price that doesn't match what's
// actually billed was misleading. Kept as a type (not a bare constant) so
// every previous AED/USD branch below still type-checks against something
// real, rather than silently rotting into dead code.
export type CurrencyCode = 'USD';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  country: string;
  flag: string;
}

export interface PlanPricing {
  monthly: number;
  yearly: number;
  originalMonthly?: number;
  originalYearly?: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  highlighted?: boolean;
  badge?: string;
}

export const currencies: Record<CurrencyCode, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    country: 'International',
    flag: '🌍',
  },
};

// id == name == backend plan_type, on purpose — "launch"/"growth"/"scale"
// everywhere (frontend, backend, database), so there's never a second name
// for the same plan to keep track of.
export const plans: Plan[] = [
  {
    id: 'launch',
    name: 'Launch',
    description: 'For small stores ready to grow',
    badge: 'Most Popular',
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'More channels, more suppliers, more room to grow',
  },
  {
    id: 'scale',
    name: 'Scale',
    description: 'For growing businesses, everything unlimited',
    highlighted: true,
  },
];

// Yearly = 9x monthly (pay for 9 months, get 12 — 3 months free, 25% off)
// everywhere prices are quoted. See pricing/page.tsx's yearlyPrice() for the
// same multiplier applied consistently on the pricing page.
export const pricing: Record<CurrencyCode, Record<string, PlanPricing>> = {
  USD: {
    free_trial: { monthly: 0,     yearly: 0      },
    launch:     { monthly: 14.99, yearly: 134.91, originalMonthly: 30, originalYearly: 270 },
    growth:     { monthly: 24.99, yearly: 224.91, originalMonthly: 50, originalYearly: 450 },
    scale:      { monthly: 39.99, yearly: 359.91, originalMonthly: 80, originalYearly: 720 },
  },
};

export const defaultCurrency: CurrencyCode = 'USD';

export function formatPrice(amount: number): string {
  return `$${amount}`;
}

export function yearlySavings(monthly: number, yearly: number): number {
  return monthly * 12 - yearly;
}
