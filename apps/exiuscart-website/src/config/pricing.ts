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

export const plans: Plan[] = [
  {
    id: 'free_trial',
    name: 'Free Trial',
    description: 'Test everything basic for 14 days',
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For small shops ready to grow',
    badge: 'Most Popular',
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'For growing businesses, everything unlimited',
    highlighted: true,
  },
];

export const pricing: Record<CurrencyCode, Record<string, PlanPricing>> = {
  USD: {
    free_trial: { monthly: 0,  yearly: 0    },
    starter:    { monthly: 12, yearly: 120,  originalMonthly: 24,  originalYearly: 240  },
    premium:    { monthly: 29, yearly: 290,  originalMonthly: 49,  originalYearly: 490  },
  },
};

export const defaultCurrency: CurrencyCode = 'USD';

export function formatPrice(amount: number): string {
  return `$${amount}`;
}

export function yearlySavings(monthly: number, yearly: number): number {
  return monthly * 12 - yearly;
}
