import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { fetchPosts, fmtDate } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Ecommerce & Product Sourcing Guides',
  description: 'Guides on finding winning products, comparing suppliers, and sourcing for dropshipping and ecommerce — from the team building Prodora.',
  alternates: { canonical: '/blog' },
};

export const revalidate = 60;

export default async function ResourcesPage() {
  const posts = await fetchPosts();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">Resources</h1>
          <p className="mt-3 text-muted-foreground">Guides and tips for finding winning products and selling them on your store.</p>
        </div>

        {posts.length === 0 ? (
          <div className="mx-auto mt-16 max-w-sm text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            New articles are on the way. Check back soon.
          </div>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-md">
                <div className="relative aspect-video bg-muted">
                  {p.cover_image_url ? (
                    <Image src={p.cover_image_url} alt="" fill className="object-cover transition duration-300 group-hover:scale-105" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><FileText className="h-8 w-8 text-muted-foreground/40" /></div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  {p.tags[0] && <span className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{p.tags[0]}</span>}
                  <h2 className="text-lg font-bold leading-snug text-foreground">{p.title}</h2>
                  {p.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{p.excerpt}</p>}
                  <p className="mt-auto pt-4 text-xs text-muted-foreground">{[fmtDate(p.published_at), p.author_name].filter(Boolean).join(' · ')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
