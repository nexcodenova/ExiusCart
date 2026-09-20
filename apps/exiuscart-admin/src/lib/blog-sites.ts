'use client';

import { useSearchParams } from 'next/navigation';

// Each site has its own blog: posts written under one site only appear on that
// site. They are stored against a hidden system shop per site.
export const BLOG_SITES = [
  { key: 'exiuscart', label: 'ExiusCart', where: 'exiuscart.com/blog', live: true },
  { key: 'prodora', label: 'Prodora', where: 'prodora.exiuscart.com/blog', live: true },
  // The affiliate portal is a login-only dashboard with no blog page yet, so
  // posts can be written here but are not displayed anywhere.
  { key: 'affiliate', label: 'Affiliate', where: 'the affiliate portal', live: false },
] as const;

export type BlogSite = (typeof BLOG_SITES)[number]['key'];

export function parseBlogSite(value: string | null | undefined): BlogSite {
  return BLOG_SITES.some((s) => s.key === value) ? (value as BlogSite) : 'exiuscart';
}

// Reads ?site= from the URL. Must be used under a <Suspense> boundary.
export function useBlogSite(): BlogSite {
  return parseBlogSite(useSearchParams().get('site'));
}
