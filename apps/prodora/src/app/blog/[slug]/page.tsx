import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import PostBody from '@/components/PostBody';
import { fetchPost, fmtDate } from '@/lib/blog';

export const revalidate = 60;

const SITE_URL = 'https://prodora.exiuscart.com';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return { title: 'Resources' };

  const description = post.excerpt ?? undefined;
  const image = post.cover_image_url ?? '/og-image.png';
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    // Redeclaring openGraph here is intentional (unlike the homepage) —
    // each article gets its own title/description/image instead of
    // inheriting the site-wide default from the root layout.
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/blog/${slug}`,
      siteName: 'Prodora',
      title: post.title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: post.title }],
      publishedTime: post.published_at ?? undefined,
      authors: post.author_name ? [post.author_name] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [image],
    },
  };
}

export default async function ResourcePostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  // Article schema - tells Google this is a real article (byline, publish
  // date, image), not just an arbitrary page - a factor in getting a rich
  // result / better preview in search. BreadcrumbList mirrors the actual
  // on-page trail (Home > Blog > this post).
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.cover_image_url ?? `${SITE_URL}/og-image.png`,
    datePublished: post.published_at ?? undefined,
    author: post.author_name ? { '@type': 'Person', name: post.author_name } : { '@type': 'Organization', name: 'Prodora' },
    publisher: { '@type': 'Organization', name: 'Prodora', logo: { '@type': 'ImageObject', url: `${SITE_URL}/prodora-logo.png` } },
    mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/blog/${slug}` },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Navbar />
      <main className="container py-10 sm:py-14">
        <article className="mx-auto max-w-3xl">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All resources
          </Link>
          {post.tags[0] && <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-primary">{post.tags[0]}</p>}
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">{post.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{[fmtDate(post.published_at), post.author_name].filter(Boolean).join(' · ')}</p>
          {post.cover_image_url && (
            <div className="relative mt-8 aspect-video overflow-hidden rounded-xl bg-muted">
              <Image src={post.cover_image_url} alt="" fill priority className="object-cover" sizes="(max-width: 768px) 100vw, 768px" />
            </div>
          )}
          <PostBody html={post.content ?? ''} />
          {post.cta_url && post.cta_text && (
            <a href={post.cta_url} target="_blank" rel="noopener noreferrer" className="mt-10 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
              {post.cta_text}
            </a>
          )}
        </article>
      </main>
    </div>
  );
}
