'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, Loader2, Eye, Pencil, Trash2, FileText } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface BlogPostRow {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  view_count: number;
  updated_at: string | null;
}

export default function AdminBlogListPage() {
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'published' | 'draft'>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.listWebsiteBlogPosts()
      .then((r) => setPosts(r.data?.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: number) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await adminApi.deleteWebsiteBlogPost(id);
      load();
    } finally { setDeletingId(null); }
  };

  const filtered = tab === 'all' ? posts : posts.filter((p) => p.status === tab);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Blog</h1>
          <p className="text-sm text-gray-400 mt-1">
            Publishes live to <strong className="text-gray-200">exiuscart.com/blog</strong>.
          </p>
        </div>
        <Link href="/dashboard/blogs/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6B3FD9] text-white rounded-lg text-sm font-medium hover:bg-[#5A2EC9] transition">
          <Plus className="w-4 h-4" /> New Post
        </Link>
      </div>

      <div className="flex gap-1 border-b border-gray-800">
        {(['all', 'published', 'draft'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition capitalize ${
              tab === t ? 'border-[#6B3FD9] text-[#6B3FD9]' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-sm text-gray-400 max-w-md mx-auto">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          {tab === 'all' ? 'No posts yet — write your first one.' : `No ${tab} posts.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-[#151F32] border border-gray-800 rounded-xl overflow-hidden flex flex-col hover:border-[#6B3FD9]/40 transition">
              <div className="relative aspect-video bg-gray-900">
                {p.cover_image_url ? (
                  <Image src={p.cover_image_url} alt={p.title} fill className="object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center"><FileText className="w-8 h-8 text-gray-700" /></div>
                )}
                <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full ${
                  p.status === 'published' ? 'bg-green-500/90 text-white' : 'bg-amber-500/90 text-white'
                }`}>
                  {p.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <p className="font-semibold text-white text-sm line-clamp-2">{p.title}</p>
                {p.excerpt && <p className="text-xs text-gray-400 line-clamp-2">{p.excerpt}</p>}
                {p.status === 'published' && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-400 mt-auto pt-2"><Eye className="w-3 h-3" /> {p.view_count}</span>
                )}
                <div className="flex gap-2 pt-2">
                  <Link href={`/dashboard/blogs/${p.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-gray-700 rounded-lg text-xs font-medium text-gray-200 hover:bg-gray-800 transition">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Link>
                  <button onClick={() => remove(p.id)} disabled={deletingId === p.id}
                    className="p-1.5 rounded-lg border border-gray-700 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition disabled:opacity-50">
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
