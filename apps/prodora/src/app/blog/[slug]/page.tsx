import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import PostBody from '@/components/PostBody';
import { fetchPost, fmtDate } from '@/lib/blog';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  return post
    ? { title: `${post.title} | Prodora`, description: post.excerpt ?? undefined }
    : { title: 'Resources | Prodora' };
}

export default async function ResourcePostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-background">
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
