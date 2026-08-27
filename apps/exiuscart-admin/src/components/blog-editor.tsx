'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Loader2, Upload, X, CheckCircle2, Eye } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { RichTextEditor } from '@/components/rich-text-editor';

const IMAGE_LIMIT = 15;

export function AdminBlogEditor({ postId }: { postId?: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!postId);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [authorName, setAuthorName] = useState('ExiusCart Team');
  const [tags, setTags] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!postId) return;
    adminApi.getWebsiteBlogPost(postId).then((r) => {
      const p = r.data;
      setTitle(p.title ?? '');
      setExcerpt(p.excerpt ?? '');
      setContent(p.content ?? '');
      setCoverImage(p.cover_image_url ?? '');
      setAuthorName(p.author_name ?? '');
      setTags((p.tags ?? []).join(', '));
      setCtaText(p.cta_text ?? '');
      setCtaUrl(p.cta_url ?? '');
      setStatus(p.status ?? 'draft');
    }).catch(() => setError('Could not load this post.')).finally(() => setLoading(false));
  }, [postId]);

  const buildPayload = () => ({
    title: title.trim(),
    excerpt: excerpt.trim() || undefined,
    content: content || undefined,
    cover_image_url: coverImage || undefined,
    author_name: authorName.trim() || undefined,
    tags: tags.trim() || undefined,
    cta_text: ctaText.trim() || undefined,
    cta_url: ctaUrl.trim() || undefined,
  });

  const save = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      if (postId) {
        await adminApi.updateWebsiteBlogPost(postId, buildPayload());
      } else {
        const r = await adminApi.createWebsiteBlogPost(buildPayload());
        router.replace(`/dashboard/blogs/${r.data.id}`);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not save. Try again.');
    } finally { setSaving(false); }
  };

  const publish = async (published: boolean) => {
    if (published && !title.trim()) { setError('Title is required.'); return; }
    setPublishing(true); setError('');
    try {
      let id = postId;
      if (!id) {
        const r = await adminApi.createWebsiteBlogPost(buildPayload());
        id = r.data.id;
      } else {
        await adminApi.updateWebsiteBlogPost(id, buildPayload());
      }
      const res = await adminApi.publishWebsiteBlogPost(id!, published);
      setStatus(res.data.status);
      if (!postId) router.replace(`/dashboard/blogs/${id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not publish. Try again.');
    } finally { setPublishing(false); }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingCover(true); setError('');
    try {
      const r = await adminApi.uploadWebsiteBlogImage(file);
      setCoverImage(r.data.url);
    } catch {
      setError("Couldn't upload cover image — try again.");
    } finally { setUploadingCover(false); }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center py-24 text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => router.push('/dashboard/blogs')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </button>
        <div className="flex items-center gap-2">
          {status === 'published' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Published
            </span>
          )}
          <button onClick={save} disabled={saving || publishing}
            className="px-4 py-2 border border-gray-700 rounded-lg text-sm font-medium text-gray-200 hover:bg-gray-800 transition disabled:opacity-60 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saved && !saving && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Draft'}
          </button>
          {status === 'published' ? (
            <button onClick={() => publish(false)} disabled={saving || publishing}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-60">
              Unpublish
            </button>
          ) : (
            <button onClick={() => publish(true)} disabled={saving || publishing}
              className="px-4 py-2 bg-[#6B3FD9] text-white rounded-lg text-sm font-medium hover:bg-[#5A2EC9] transition disabled:opacity-60 flex items-center gap-2">
              {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Live preview — shows exactly what exiuscart.com/blog will render */}
      <div className="bg-[#151F32] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-900/40 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-medium text-gray-400">Live Preview</p>
        </div>
        <div className="p-6 sm:p-8 max-w-2xl mx-auto">
          {coverImage && (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-6 bg-gray-900">
              <Image src={coverImage} alt="" fill className="object-cover" unoptimized />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{title || 'Your post title'}</h1>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-3">
            {authorName && <span>{authorName}</span>}
            {tags && <span className="flex gap-1">{tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
              <span key={t} className="px-2 py-0.5 bg-gray-800 rounded-full">{t}</span>
            ))}</span>}
          </div>
          {excerpt && <p className="text-gray-400 mt-4 leading-relaxed">{excerpt}</p>}
          <div
            className="text-gray-200 text-sm sm:text-base leading-relaxed mt-6 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4"
            dangerouslySetInnerHTML={{ __html: content || '<p class="text-gray-500 italic">Start writing below — it\'ll appear here as you go.</p>' }}
          />
          {ctaText && (
            <a href={ctaUrl || '#'} className="inline-block mt-6 px-5 py-2.5 bg-[#6B3FD9] text-white rounded-lg text-sm font-medium">
              {ctaText}
            </a>
          )}
        </div>
      </div>

      {/* Editor fields */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to pick the right POS for a UAE small business"
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-[#6B3FD9]" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Excerpt <span className="opacity-60">— short teaser shown on the blog list</span></label>
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} maxLength={500}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-[#6B3FD9] resize-none" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">
              Content <span className="opacity-60">— up to {IMAGE_LIMIT} images</span>
            </label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Write your post…"
              rows={14}
              maxImages={IMAGE_LIMIT}
              onUploadImage={async (file) => (await adminApi.uploadWebsiteBlogImage(file)).data.url}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Cover Image</label>
            {coverImage ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-900 group">
                <Image src={coverImage} alt="" fill className="object-cover" unoptimized />
                <button onClick={() => setCoverImage('')}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}
                className="w-full aspect-video border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#6B3FD9]/40 hover:text-[#6B3FD9] transition">
                {uploadingCover ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                <span className="text-xs">{uploadingCover ? 'Uploading…' : 'Upload cover image'}</span>
              </button>
            )}
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Author</label>
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="e.g. ExiusCart Team"
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-[#6B3FD9]" />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Tags <span className="opacity-60">— comma separated</span></label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="pos, uae, guides"
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-[#6B3FD9]" />
          </div>

          <div className="border-t border-gray-800 pt-4 space-y-3">
            <p className="text-sm font-medium text-white">Call to Action</p>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Button text</label>
              <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Start Free Trial"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-[#6B3FD9]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Button link</label>
              <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/register"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-[#6B3FD9]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
