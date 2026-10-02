// Public Meta Ad Library links — open for anyone, no token or Meta account
// needed. Mirrors ad_library_keyword / ad_library_search_url in the
// backend's app/core/meta_ad_library.py; keep the two in step.

const TITLE_NOISE = new Set([
  'new', 'hot', 'sale', 'best', 'top', 'quality', 'high', 'free', 'shipping',
  'fashion', 'style', 'arrival', 'arrivals', 'selling', 'seller', 'premium',
  'for', 'with', 'and', 'the', 'a', 'an', 'of', 'in', 'to', 'on', 'by', 'set',
  'pcs', 'pc', 'piece', 'pieces', 'women', 'womens', 'men', 'mens', 'kids',
  'unisex', 'portable', 'mini', 'upgraded', 'original', 'wholesale',
]);

// Short searchable keyword from a long supplier title — "2024 New Hot Sale
// Adjustable Posture Corrector For Women" → "Adjustable Posture Corrector".
export function adLibraryKeyword(name: string, maxWords = 3): string {
  const words = (name || '').replace(/[([{].*?[)\]}]|[^\w\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !TITLE_NOISE.has(w.toLowerCase()) && !/\d/.test(w));
  return kept.slice(0, maxWords).join(' ') || (name || '').trim();
}

export function adLibrarySearchUrl(query: string, country = 'ALL', platform?: 'facebook' | 'instagram'): string {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: country || 'ALL',
    q: query,
    search_type: 'keyword_unordered',
    media_type: 'all',
  });
  if (platform) params.set('publisher_platforms[0]', platform);
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

// A bare Library ID ("1234567890123456") pasted from "See ad details" →
// the full link to that one ad. Anything else is left as typed.
export function normalizeAdLink(value: string): string {
  const v = value.trim();
  return /^\d{8,20}$/.test(v) ? `https://www.facebook.com/ads/library/?id=${v}` : v;
}

export function isAdLibrarySearchLink(url?: string | null): boolean {
  return !!url && url.includes('facebook.com/ads/library') && url.includes('search_type=');
}
