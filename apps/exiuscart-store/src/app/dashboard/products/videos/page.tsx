'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Sparkles, AlertCircle, Lock, RefreshCw, Film } from 'lucide-react';
import Image from 'next/image';
import { productsApi, videoGenApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ProductRow {
  id: number;
  name: string;
  image_url?: string;
}

interface VideoRow {
  id: number;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  model: string;
  prompt: string | null;
  video_url: string | null;
  error_message: string | null;
  created_at: string | null;
}

const MODELS: { value: string; label: string; hint: string }[] = [
  { value: 'veo3.1/image-to-video', label: 'Veo 3.1 (best quality)', hint: 'Slower, most cinematic result' },
  { value: 'veo3.1/fast/image-to-video', label: 'Veo 3.1 Fast', hint: 'Faster, slightly lower quality' },
  { value: 'bytedance/seedance-lite/image-to-video', label: 'Seedance Lite', hint: 'Cheapest, quick turnaround' },
];

export default function ProductVideosPage() {
  const [shopId, setShopId] = useState('');
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);

  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selected, setSelected] = useState<ProductRow | null>(null);

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(MODELS[0].value);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    setChecking(true);
    // A generate attempt with no product selected yet would 404 the plan
    // check indirectly — instead just try loading products; if the shop
    // isn't Premium, the actual /videos/generate call surfaces that 403
    // once they try, same lazy-gate pattern as the dropshipping suppliers.
    setChecking(false);
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    const t = setTimeout(() => {
      setLoadingProducts(true);
      productsApi.getAll(shopId, { search: query || undefined })
        .then((r) => setProducts((r.data?.products ?? r.data ?? []).slice(0, 30)))
        .catch(() => {})
        .finally(() => setLoadingProducts(false));
    }, 350);
    return () => clearTimeout(t);
  }, [shopId, query]);

  const loadVideos = (productId: number) => {
    setLoadingVideos(true);
    videoGenApi.list(shopId, productId)
      .then((r) => setVideos(r.data?.videos ?? []))
      .catch(() => {})
      .finally(() => setLoadingVideos(false));
  };

  useEffect(() => {
    if (!selected) { setVideos([]); return; }
    loadVideos(selected.id);
    // Poll while anything for this product is still in flight — same
    // "don't make the seller manually refresh" pattern as order tracking.
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      setVideos((current) => {
        const stillPending = current.some((v) => v.status === 'queued' || v.status === 'processing');
        if (stillPending && selected) loadVideos(selected.id);
        return current;
      });
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, shopId]);

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    setGenerateError('');
    setLocked(false);
    try {
      await videoGenApi.generate(shopId, selected.id, {
        prompt: prompt.trim() || undefined,
        model,
        aspect_ratio: aspectRatio,
      });
      loadVideos(selected.id);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail?.error === 'upgrade_required') {
        setLocked(true);
      } else {
        setGenerateError(detail?.message ?? detail ?? 'Could not start generation. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  if (checking) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">AI Product Videos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Turn a product photo into a ready-to-run ad video.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        {/* Product picker */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your products…"
              className="w-full pl-9 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div className="border border-border rounded-xl bg-card max-h-[520px] overflow-y-auto divide-y divide-border">
            {loadingProducts && (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
              </div>
            )}
            {!loadingProducts && products.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">No products found.</div>
            )}
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setGenerateError(''); setLocked(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition ${selected?.id === p.id ? 'bg-primary/10' : ''}`}
              >
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                  {p.image_url
                    ? <Image src={p.image_url} alt={p.name} fill className="object-cover" unoptimized />
                    : <div className="absolute inset-0 flex items-center justify-center"><Film className="w-4 h-4 text-muted-foreground/40" /></div>}
                </div>
                <span className="text-sm text-foreground truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate + history */}
        <div className="space-y-5">
          {!selected ? (
            <div className="border border-border rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground">
              Pick a product on the left to generate a video for it.
            </div>
          ) : (
            <>
              <div className="border border-border rounded-2xl bg-card p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
                    {selected.image_url
                      ? <Image src={selected.image_url} alt={selected.name} fill className="object-cover" unoptimized />
                      : <div className="absolute inset-0 flex items-center justify-center"><Film className="w-5 h-5 text-muted-foreground/40" /></div>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">Generating from this product&apos;s photo</p>
                  </div>
                </div>

                {locked && (
                  <div className="flex items-start gap-2 text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2.5">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>AI product video generation is a Premium feature. Upgrade to unlock it.</span>
                  </div>
                )}

                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Prompt <span className="opacity-60 font-normal">— optional, leave blank and AI will look at the photo and write one for you</span></label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    placeholder="e.g. Slow zoom on the product, soft studio lighting, floating sparkle particles"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none resize-none"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Quality / model</label>
                    <select value={model} onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none">
                      {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">{MODELS.find((m) => m.value === model)?.hint}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Aspect ratio</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none">
                      <option value="9:16">9:16 — Reels / TikTok / Stories</option>
                      <option value="16:9">16:9 — YouTube / landscape</option>
                      <option value="1:1">1:1 — Feed post</option>
                    </select>
                  </div>
                </div>

                {generateError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {generateError}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? 'Starting…' : 'Generate video'}
                </button>
              </div>

              {/* History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Generated videos</h2>
                  <button onClick={() => loadVideos(selected.id)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {loadingVideos && videos.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
                  </div>
                )}
                {!loadingVideos && videos.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">No videos generated for this product yet.</div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  {videos.map((v) => (
                    <div key={v.id} className="border border-border rounded-xl bg-card overflow-hidden">
                      <div className="relative aspect-[9/16] bg-muted flex items-center justify-center">
                        {v.status === 'ready' && v.video_url ? (
                          <video src={v.video_url} controls className="w-full h-full object-cover" />
                        ) : v.status === 'failed' ? (
                          <div className="flex flex-col items-center gap-1.5 px-4 text-center">
                            <AlertCircle className="w-6 h-6 text-destructive" />
                            <p className="text-xs text-destructive">{v.error_message || 'Generation failed'}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            <p className="text-xs text-muted-foreground capitalize">{v.status}…</p>
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{v.prompt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
