import type { SegmentRules } from './SegmentRuleBuilder';

export function describeRules(rules: SegmentRules, fmt: (n: number) => string): string {
  const parts: string[] = [];
  if (rules.tags?.length) parts.push(`Tags: ${rules.tags.join(', ')}`);
  if (rules.sources?.length) parts.push(`Source: ${rules.sources.join(', ')}`);
  if (rules.min_orders != null) parts.push(`≥${rules.min_orders} orders`);
  if (rules.max_orders != null) parts.push(`≤${rules.max_orders} orders`);
  if (rules.min_ltv != null) parts.push(`LTV ≥ ${fmt(rules.min_ltv)}`);
  if (rules.max_ltv != null) parts.push(`LTV ≤ ${fmt(rules.max_ltv)}`);
  return parts.length ? parts.join(' · ') : 'Everyone (no filters set)';
}
