import type { MetadataRoute } from 'next';

const BASE = 'https://exiuscart.com';

// No robots.txt existed at all before this — search engines and AI
// crawlers were relying on defaults with no explicit guidance, no sitemap
// pointer, and no llms.txt pointer. Named AI crawlers are listed explicitly
// (rather than left to the generic '*' rule) so a future tightening of the
// generic rule doesn't accidentally block them too.
export default function robots(): MetadataRoute.Robots {
  const disallow = ['/checkout', '/login', '/download/', '/p/', '/r/'];

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      // Search
      { userAgent: 'Googlebot', allow: '/', disallow },
      { userAgent: 'Bingbot', allow: '/', disallow },
      // AI assistants / answer engines
      { userAgent: 'GPTBot', allow: '/', disallow },
      { userAgent: 'ChatGPT-User', allow: '/', disallow },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow },
      { userAgent: 'ClaudeBot', allow: '/', disallow },
      { userAgent: 'Claude-Web', allow: '/', disallow },
      { userAgent: 'Anthropic-AI', allow: '/', disallow },
      { userAgent: 'PerplexityBot', allow: '/', disallow },
      { userAgent: 'Google-Extended', allow: '/', disallow },
      { userAgent: 'Applebot-Extended', allow: '/', disallow },
      { userAgent: 'Bytespider', allow: '/', disallow },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
