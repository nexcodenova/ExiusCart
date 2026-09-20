// Prodora's own blog. Posts are written in Admin > Blogs > Prodora and read
// here from the public API; nothing from the other sites' blogs appears.
const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';
const SITE = 'prodora-website';

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content?: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  author_name: string | null;
  tags: string[];
  cta_text: string | null;
  cta_url: string | null;
}

export async function fetchPosts(): Promise<BlogPost[]> {
  try {
    const r = await fetch(`${API}/api/v1/public/store/${SITE}/blog`, { next: { revalidate: 60 } });
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

export async function fetchPost(slug: string): Promise<BlogPost | null> {
  try {
    const r = await fetch(`${API}/api/v1/public/store/${SITE}/blog/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
