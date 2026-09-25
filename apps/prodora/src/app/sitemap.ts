import type { MetadataRoute } from 'next';
import { fetchPosts } from '@/lib/blog';

const BASE = 'https://prodora.exiuscart.com';

// Only the genuinely public, server-rendered pages belong here — browse/
// marketplace/product/cart/digital/instructions/academy are all 'use
// client' app screens gated behind login (see robots.ts), not real
// crawlable content, so they're deliberately left out.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const posts = await fetchPosts();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1.0, changeFrequency: 'weekly' },
    { url: `${BASE}/blog`, priority: 0.8, changeFrequency: 'weekly' },
  ];

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
    lastModified: post.published_at ? new Date(post.published_at) : lastModified,
  }));

  return [...staticPages, ...blogPages].map((entry) => ({ lastModified, ...entry }));
}
