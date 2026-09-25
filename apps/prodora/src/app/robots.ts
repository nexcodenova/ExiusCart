import type { MetadataRoute } from 'next';

const BASE = 'https://prodora.exiuscart.com';

// browse/marketplace/product/cart/digital/instructions/academy are all
// gated app screens behind login, not public content — deliberately kept
// out of the index rather than left to Google to figure out on its own.
// This is also the correct place to draw the line on the "expose the
// curated product database publicly" question raised separately: it stays
// un-indexed until/unless that's a deliberate decision, not a default.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/blog'],
      disallow: ['/browse', '/marketplace', '/product/', '/cart', '/digital', '/instructions', '/academy'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
