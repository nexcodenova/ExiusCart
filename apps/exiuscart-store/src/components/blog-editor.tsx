'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Loader2, Upload, X, CheckCircle2, Eye, Lock, AlertTriangle } from 'lucide-react';
import { blogApi, shopifyApi, BlogPostIn } from '@/lib/api';
import { RichTextEditor } from '@/components/rich-text-editor';
import { useBlogChannelStatus } from '@/lib/use-blog-channel-status';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

export function BlogEditor({ postId }: { postId?: number }) {
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const [loading, setLoading] = useState(!!postId);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const { checking: checkingChannels, isTheDersiUser, hasAnyChannel } = useBlogChannelStatus(shopId);

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [tags, setTags] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  const [imageLimit, setImageLimit] = useState(3);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [pushToShopify, setPushToShopify] = useState(false);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    // image_limit comes back on the list endpoint (plan-derived) — cheap
    // enough to call here too rather than adding a separate endpoint just
    // for this one number.
    blogApi.list(shopId).then((r) => setImageLimit(r.data?.image_limit ?? 3)).catch(() => {});
    shopifyApi.getStatus(shopId).then((r) => setShopifyConnected(!!r.data?.connected)).catch(() => {});

    if (postId) {
      blogApi.get(shopId, postId).then((r) => {
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
    }
  }, [shopId, postId]);

  const buildPayload = (): BlogPostIn => ({
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
        await blogApi.update(shopId, postId, buildPayload());
      } else {
        const r = await blogApi.create(shopId, buildPayload());
        router.replace(`/dashboard/blog/${r.data.id}`);
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
        const r = await blogApi.create(shopId, buildPayload());
        id = r.data.id;
      } else {
        await blogApi.update(shopId, id, buildPayload());
      }
      const res = await blogApi.publish(shopId, id!, published, pushToShopify);
      setStatus(res.data.post.status);
      if (res.data.shopify && !res.data.shopify.ok) {
        setError(`Saved, but Shopify push failed: ${res.data.shopify.error}`);
      }
      if (!postId) router.replace(`/dashboard/blog/${id}`);
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
      const r = await blogApi.uploadImage(shopId, file);
      setCoverImage(r.data.url);
    } catch {
      setError("Couldn't upload cover image — try again.");
    } finally { setUploadingCover(false); }
  };

  if (loading || checkingChannels) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (isTheDersiUser) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
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
        <button onClick={() => router.push('/dashboard/blog')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </button>
        <div className="flex items-center gap-2">
          {status === 'published' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Published
            </span>
          )}
          <button onClick={save} disabled={saving || publishing}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition disabled:opacity-60 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saved && !saving && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Draft'}
          </button>
          {status === 'published' ? (
            <button onClick={() => publish(false)} disabled={saving || publishing}
              className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/70 transition disabled:opacity-60">
              Unpublish
            </button>
          ) : (
            <button onClick={() => publish(true)} disabled={saving || publishing}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center gap-2">
              {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {!hasAnyChannel && (
        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            No Custom Website or Shopify connected — this post won&apos;t be visible anywhere once published.
            {' '}<Link href="/dashboard/channels" className="underline font-medium">Connect one first</Link>.
          </p>
        </div>
      )}

      {/* Live preview — on top, as requested: shows exactly what the storefront will render */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">Live Preview</p>
        </div>
        <div className="p-6 sm:p-8 max-w-2xl mx-auto">
          {coverImage && (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-6 bg-muted">
              <Image src={coverImage} alt="" fill className="object-cover" unoptimized />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">{title || 'Your post title'}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
            {authorName && <span>{authorName}</span>}
            {tags && <span className="flex gap-1">{tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
              <span key={t} className="px-2 py-0.5 bg-muted rounded-full">{t}</span>
            ))}</span>}
          </div>
          {excerpt && <p className="text-muted-foreground mt-4 leading-relaxed">{excerpt}</p>}
          <div
            className="prose prose-sm sm:prose-base dark:prose-invert max-w-none mt-6 [&_img]:rounded-lg [&_img]:max-w-full"
            dangerouslySetInnerHTML={{ __html: content || '<p class="text-muted-foreground italic">Start writing below — it\'ll appear here as you go.</p>' }}
          />
          {ctaText && (
            <a href={ctaUrl || '#'} className="inline-block mt-6 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              {ctaText}
            </a>
          )}
        </div>
      </div>

      {/* Editor fields */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How we picked our best sellers this month"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Excerpt <span className="opacity-60">— short teaser shown on the blog list</span></label>
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} maxLength={500}
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">
              Content <span className="opacity-60">— up to {imageLimit} images{imageLimit <= 3 ? ' (upgrade your plan for more)' : ''}</span>
            </label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Write your post…"
              rows={14}
              maxImages={imageLimit}
              onUploadImage={async (file) => (await blogApi.uploadImage(shopId, file)).data.url}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Cover Image</label>
            {coverImage ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted group">
                <Image src={coverImage} alt="" fill className="object-cover" unoptimized />
                <button onClick={() => setCoverImage('')}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}
                className="w-full aspect-video border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition">
                {uploadingCover ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                <span className="text-xs">{uploadingCover ? 'Uploading…' : 'Upload cover image'}</span>
              </button>
            )}
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Author</label>
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="e.g. Your Store Team"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Tags <span className="opacity-60">— comma separated</span></label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="gadgets, gift-guide"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Call to Action</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Button text</label>
              <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Shop the Collection"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Button link</label>
              <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/products?category=gadgets"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          {shopifyConnected && (
            <div className="border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={pushToShopify} onChange={(e) => setPushToShopify(e.target.checked)} className="w-4 h-4" />
                Also publish to Shopify
              </label>
              <p className="text-xs text-muted-foreground mt-1">Creates or updates a real Article on your connected Shopify store's blog.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
