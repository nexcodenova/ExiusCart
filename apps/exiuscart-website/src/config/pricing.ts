export type CurrencyCode = 'AED' | 'USD';

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
  AED: {
    code: 'AED',
    symbol: 'AED',
    name: 'UAE Dirham',
    country: 'United Arab Emirates',
    flag: '🇦🇪',
  },
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
  AED: {
    free_trial: { monthly: 0,  yearly: 0    },
    starter:    { monthly: 45, yearly: 459,  originalMonthly: 89,  originalYearly: 890  },
    premium:    { monthly: 99, yearly: 999,  originalMonthly: 149, originalYearly: 1490 },
  },
  USD: {
    free_trial: { monthly: 0,  yearly: 0    },
    starter:    { monthly: 12, yearly: 120,  originalMonthly: 24,  originalYearly: 240  },
    premium:    { monthly: 29, yearly: 290,  originalMonthly: 49,  originalYearly: 490  },
  },
};

export const countryToCurrency: Record<string, CurrencyCode> = {
  AE: 'AED',
};

export const defaultCurrency: CurrencyCode = 'USD';

export function formatPrice(amount: number, currency: CurrencyCode): string {
  if (currency === 'USD') return `$${amount}`;
  return `AED ${amount}`;
}

export function yearlySavings(monthly: number, yearly: number): number {
  return monthly * 12 - yearly;
}
