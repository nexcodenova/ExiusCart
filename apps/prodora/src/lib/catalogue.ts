import type { Product } from '@/lib/api';

export type SortKey = 'default' | 'profit' | 'price_asc' | 'price_desc' | 'winning' | 'orders' | 'trend';

export const SORT_LABEL: Record<SortKey, string> = {
  default: 'Newest',
  profit: 'Highest profit',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  winning: 'Winning score',
  orders: 'Most orders',
  trend: 'Fastest growing',
};

export const profitOf = (p: Product) => (p.cost_price != null ? p.price - p.cost_price : -Infinity);

// "Newest" keeps the API's own order (products carry no created date).
export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const sorted = [...products];
  if (sort === 'profit') sorted.sort((a, b) => profitOf(b) - profitOf(a));
  else if (sort === 'price_asc') sorted.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') sorted.sort((a, b) => b.price - a.price);
  else if (sort === 'winning') sorted.sort((a, b) => (b.winning_score ?? -1) - (a.winning_score ?? -1));
  else if (sort === 'orders') sorted.sort((a, b) => (b.orders_count ?? -1) - (a.orders_count ?? -1));
  else if (sort === 'trend') sorted.sort((a, b) => (b.trend_percent ?? -Infinity) - (a.trend_percent ?? -Infinity));
  return sorted;
}
