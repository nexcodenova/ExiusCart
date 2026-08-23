'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, Loader2, Eye, Pencil, Trash2, FileText, CheckCircle2, ExternalLink, Lock, AlertTriangle } from 'lucide-react';
import { blogApi } from '@/lib/api';
import { useBlogChannelStatus } from '@/lib/use-blog-channel-status';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface BlogPostRow {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  view_count: number;
  shopify_article_id: string | null;
  updated_at: string | null;
}

export default function BlogListPage() {
  const [shopId, setShopId] = useState('');
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'published' | 'draft'>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { checking, isTheDersiUser, hasAnyChannel } = useBlogChannelStatus(shopId);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    setLoading(true);
    blogApi.list(shopId)
      .then((r) => setPosts(r.data?.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId]);

  const remove = async (id: number) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await blogApi.remove(shopId, id);
      load();
    } finally { setDeletingId(null); }
  };

  const filtered = tab === 'all' ? posts : posts.filter((p) => p.status === tab);

  if (checking) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (isTheDersiUser) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Blog</h1>
        </div>
        <div className="border border-border rounded-2xl bg-card p-8 sm:p-10 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Not available for TheDersi sellers</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Your storefront is managed by <strong className="text-foreground">TheDersi</strong>, which has no blog feature to publish into.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Blog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publishes to your <strong className="text-foreground">Custom Website</strong> and, if connected, <strong className="text-foreground">Shopify</strong> — that's it. Not eBay, Daraz, Noon, or any other marketplace; none of them have a blog to publish into.
          </p>
        </div>
        <Link href="/dashboard/blog/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> New Post
        </Link>
      </div>

      {!hasAnyChannel && (
        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            You haven&apos;t connected a Custom Website or Shopify yet — a published post won&apos;t be visible anywhere until you do.
            {' '}<Link href="/dashboard/channels" className="underline font-medium">Connect one first</Link>.
          </p>
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        {(['all', 'published', 'draft'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition capitalize ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-sm text-muted-foreground max-w-md mx-auto">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          {tab === 'all' ? 'No posts yet — write your first one.' : `No ${tab} posts.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-primary/40 transition">
              <div className="relative aspect-video bg-muted">
                {p.cover_image_url ? (
                  <Image src={p.cover_image_url} alt={p.title} fill className="object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center"><FileText className="w-8 h-8 text-muted-foreground/30" /></div>
                )}
                <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full ${
                  p.status === 'published' ? 'bg-green-500/90 text-white' : 'bg-amber-500/90 text-white'
                }`}>
                  {p.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <p className="font-semibold text-foreground text-sm line-clamp-2">{p.title}</p>
                {p.excerpt && <p className="text-xs text-muted-foreground line-clamp-2">{p.excerpt}</p>}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto pt-2">
                  {p.status === 'published' && (
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {p.view_count}</span>
                  )}
                  {p.shopify_article_id && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="w-3 h-3" /> Shopify</span>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Link href={`/dashboard/blog/${p.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Link>
                  <button onClick={() => remove(p.id)} disabled={deletingId === p.id}
                    className="p-1.5 rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition disabled:opacity-50">
                    {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
