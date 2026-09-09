'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Share2, Facebook, Instagram, Loader2, Upload, X, Calendar, AlertCircle,
  CheckCircle2, XCircle, Clock, Trash2, ExternalLink, Lock,
} from 'lucide-react';
import { socialPostingApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

// TikTok has no dedicated lucide icon — a simple monochrome glyph matching
// the other platform icons' 16px footprint.
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M16.6 5.82c-.9-.98-1.4-2.26-1.4-3.57h-3.02v13.68c0 1.5-1.22 2.72-2.72 2.72a2.72 2.72 0 0 1 0-5.44c.27 0 .53.04.78.11V10.3a5.9 5.9 0 0 0-.78-.05A5.75 5.75 0 0 0 3.7 16a5.75 5.75 0 0 0 5.76 5.75A5.75 5.75 0 0 0 15.2 16V9.01a8.6 8.6 0 0 0 5.02 1.6V7.6c-1.36 0-2.6-.5-3.62-1.78Z" />
    </svg>
  );
}

interface Connection { id: number; platform: 'facebook' | 'instagram' | 'tiktok'; account_id: string; account_name: string | null; connected_at: string | null; }
interface FbPage { id: string; name: string; has_instagram: boolean; }
interface PostResult { success: boolean; post_id?: string; error?: string; }
interface Post {
  id: number; platforms: string[]; caption: string | null; media_url: string; media_type: 'image' | 'video';
  status: 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed' | 'canceled';
  scheduled_at: string | null; published_at: string | null; results: Record<string, PostResult> | null; error_message: string | null;
}

const PLATFORM_META = {
  facebook: { label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-600' },
  tiktok: { label: 'TikTok', icon: TikTokIcon, color: 'text-foreground' },
} as const;

const STATUS_META: Record<Post['status'], { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'bg-blue-500/10 text-blue-600' },
  publishing: { label: 'Publishing…', className: 'bg-amber-500/10 text-amber-600' },
  published: { label: 'Published', className: 'bg-green-500/10 text-green-600' },
  partial: { label: 'Partially published', className: 'bg-amber-500/10 text-amber-600' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
  canceled: { label: 'Canceled', className: 'bg-muted text-muted-foreground' },
};

export default function SocialPostingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [shopId, setShopId] = useState('');

  const [connections, setConnections] = useState<Connection[]>([]);
  const [fbConfigured, setFbConfigured] = useState(true);
  const [tiktokConfigured, setTiktokConfigured] = useState(true);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [pagePicker, setPagePicker] = useState<FbPage[] | null>(null);
  const [connectingPage, setConnectingPage] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [scheduledAt, setScheduledAt] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [locked, setLocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const loadConnections = (sid: string) => {
    setLoadingConnections(true);
    socialPostingApi.getConnections(sid)
      .then((r) => {
        setConnections(r.data?.connections ?? []);
        setFbConfigured(r.data?.facebook_configured ?? true);
        setTiktokConfigured(r.data?.tiktok_configured ?? true);
      })
      .catch(() => {})
      .finally(() => setLoadingConnections(false));
  };

  const loadPosts = (sid: string) => {
    setLoadingPosts(true);
    socialPostingApi.listPosts(sid).then((r) => setPosts(r.data?.posts ?? [])).catch(() => {}).finally(() => setLoadingPosts(false));
  };

  useEffect(() => {
    if (!shopId) return;
    loadConnections(shopId);
    loadPosts(shopId);
  }, [shopId]);

  // Handle redirects back from Facebook/TikTok OAuth.
  useEffect(() => {
    if (!shopId) return;
    const fb = searchParams.get('fb');
    const tiktok = searchParams.get('tiktok');
    if (fb === 'select-page') {
      socialPostingApi.facebookPages(shopId).then((r) => setPagePicker(r.data?.pages ?? [])).catch(() => setBanner({ type: 'error', text: 'Could not load your Facebook Pages. Try connecting again.' }));
    } else if (fb === 'denied') {
      setBanner({ type: 'error', text: 'Facebook connection was canceled.' });
    } else if (fb === 'pending' || fb === 'invalid_state') {
      setBanner({ type: 'error', text: 'Facebook connection could not be completed. Please try again.' });
    } else if (tiktok === 'connected') {
      setBanner({ type: 'success', text: 'TikTok connected.' });
      loadConnections(shopId);
    } else if (tiktok === 'denied') {
      setBanner({ type: 'error', text: 'TikTok connection was canceled.' });
    } else if (tiktok === 'pending' || tiktok === 'invalid_state') {
      setBanner({ type: 'error', text: 'TikTok connection could not be completed. Please try again.' });
    }
    if (fb || tiktok) router.replace('/dashboard/social-posting');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, searchParams]);

  const connectFacebook = async () => {
    try {
      const r = await socialPostingApi.facebookAuthorize(shopId);
      window.location.href = r.data.authorize_url;
    } catch (e: any) {
      if (e?.response?.data?.detail?.error === 'upgrade_required') setLocked(true);
      else setBanner({ type: 'error', text: e?.response?.data?.detail ?? 'Facebook posting is not available yet.' });
    }
  };

  const connectTiktok = async () => {
    try {
      const r = await socialPostingApi.tiktokAuthorize(shopId);
      window.location.href = r.data.authorize_url;
    } catch (e: any) {
      if (e?.response?.data?.detail?.error === 'upgrade_required') setLocked(true);
      else setBanner({ type: 'error', text: e?.response?.data?.detail ?? 'TikTok posting is not available yet.' });
    }
  };

  const pickPage = async (pageId: string) => {
    setConnectingPage(true);
    try {
      await socialPostingApi.facebookConnectPage(shopId, pageId);
      setPagePicker(null);
      setBanner({ type: 'success', text: 'Facebook connected.' });
      loadConnections(shopId);
    } catch (e: any) {
      setBanner({ type: 'error', text: e?.response?.data?.detail ?? 'Could not connect that Page.' });
    } finally {
      setConnectingPage(false);
    }
  };

  const disconnect = async (conn: Connection) => {
    if (!confirm(`Disconnect ${PLATFORM_META[conn.platform].label}${conn.account_name ? ` (${conn.account_name})` : ''}?`)) return;
    await socialPostingApi.disconnect(shopId, conn.id);
    loadConnections(shopId);
  };

  const connectedPlatforms = new Set(connections.map((c) => c.platform));

  const handleFilePick = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : '');
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const submitPost = async () => {
    if (!file) { setPostError('Choose an image or video first.'); return; }
    if (selectedPlatforms.size === 0) { setPostError('Pick at least one connected platform.'); return; }
    setPosting(true);
    setPostError('');
    try {
      await socialPostingApi.createPost(shopId, {
        file, caption, platforms: Array.from(selectedPlatforms),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      handleFilePick(null);
      setCaption('');
      setSelectedPlatforms(new Set());
      setScheduledAt('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadPosts(shopId);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail?.error === 'upgrade_required') setLocked(true);
      else setPostError(detail ?? 'Could not create this post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const cancelPost = async (id: number) => {
    await socialPostingApi.cancelPost(shopId, id);
    loadPosts(shopId);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Share2 className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Social Posting</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Post product photos and videos to Facebook, Instagram and TikTok — right from your own connected accounts.</p>
        </div>
      </div>

      {locked && (
        <div className="flex items-start gap-2 text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2.5">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Social posting is a Premium feature. Upgrade to unlock it.</span>
        </div>
      )}

      {banner && (
        <div className={`flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2.5 ${banner.type === 'error' ? 'bg-destructive/10 text-destructive' : banner.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Connections */}
      <div className="border border-border rounded-2xl bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Connected accounts</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {/* Facebook */}
          {(() => {
            const conn = connections.find((c) => c.platform === 'facebook');
            return (
              <div className="border border-border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2"><Facebook className="w-4 h-4 text-blue-600" /><span className="text-sm font-medium text-foreground">Facebook</span></div>
                {conn ? (
                  <>
                    <p className="text-xs text-muted-foreground truncate">{conn.account_name}</p>
                    <button onClick={() => disconnect(conn)} className="text-xs text-destructive hover:underline text-left mt-1">Disconnect</button>
                  </>
                ) : loadingConnections ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <button onClick={connectFacebook} disabled={!fbConfigured}
                    className="text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 mt-1 w-fit">
                    {fbConfigured ? 'Connect' : 'Not available yet'}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Instagram */}
          {(() => {
            const conn = connections.find((c) => c.platform === 'instagram');
            return (
              <div className="border border-border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2"><Instagram className="w-4 h-4 text-pink-600" /><span className="text-sm font-medium text-foreground">Instagram</span></div>
                {conn ? (
                  <>
                    <p className="text-xs text-muted-foreground truncate">@{conn.account_name}</p>
                    <button onClick={() => disconnect(conn)} className="text-xs text-destructive hover:underline text-left mt-1">Disconnect</button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Connects automatically with a linked Facebook Page.</p>
                )}
              </div>
            );
          })()}

          {/* TikTok */}
          {(() => {
            const conn = connections.find((c) => c.platform === 'tiktok');
            return (
              <div className="border border-border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2"><TikTokIcon className="w-4 h-4 text-foreground" /><span className="text-sm font-medium text-foreground">TikTok</span></div>
                {conn ? (
                  <>
                    <p className="text-xs text-muted-foreground truncate">{conn.account_name}</p>
                    <button onClick={() => disconnect(conn)} className="text-xs text-destructive hover:underline text-left mt-1">Disconnect</button>
                  </>
                ) : loadingConnections ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <button onClick={connectTiktok} disabled={!tiktokConfigured}
                    className="text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 mt-1 w-fit">
                    {tiktokConfigured ? 'Connect' : 'Not available yet'}
                  </button>
                )}
              </div>
            );
          })()}
        </div>
        {(!fbConfigured || !tiktokConfigured) && (
          <p className="text-[11px] text-muted-foreground">
            {!fbConfigured && !tiktokConfigured ? 'Facebook/Instagram and TikTok posting are' : !fbConfigured ? 'Facebook/Instagram posting is' : 'TikTok posting is'} still pending platform approval — the composer below will work as soon as it's live.
          </p>
        )}
      </div>

      {/* Composer */}
      <div className="border border-border rounded-2xl bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">New post</h2>

        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
          onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)} />
        {!preview ? (
          <button onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-xl py-10 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition">
            <Upload className="w-6 h-6" />
            <span className="text-sm">Click to upload a photo or video</span>
          </button>
        ) : (
          <div className="relative w-full max-w-xs">
            {file?.type.startsWith('video/') ? (
              <video src={preview} controls className="w-full rounded-xl bg-muted" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="w-full rounded-xl bg-muted" />
            )}
            <button onClick={() => { handleFilePick(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 text-muted-foreground hover:text-foreground shadow">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Caption</label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3}
            placeholder="Write something for this post…"
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none resize-none" />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Post to</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PLATFORM_META) as (keyof typeof PLATFORM_META)[]).map((p) => {
              const meta = PLATFORM_META[p];
              const Icon = meta.icon;
              const connected = connectedPlatforms.has(p);
              const active = selectedPlatforms.has(p);
              return (
                <button key={p} type="button" disabled={!connected} onClick={() => togglePlatform(p)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition
                    ${!connected ? 'opacity-40 cursor-not-allowed border-border' : active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-muted'}`}>
                  <Icon className={`w-4 h-4 ${active ? '' : meta.color}`} />
                  {meta.label}
                  {!connected && <span className="text-[10px] opacity-70">(not connected)</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-xs">
          <label className="text-sm text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Schedule for later <span className="opacity-60 font-normal">(optional)</span></label>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {postError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" /> {postError}
          </div>
        )}

        <button onClick={submitPost} disabled={posting}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
          {posting && <Loader2 className="w-4 h-4 animate-spin" />}
          {posting ? 'Posting…' : scheduledAt ? 'Schedule post' : 'Post now'}
        </button>
      </div>

      {/* History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Post history</h2>
        {loadingPosts ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="border border-border rounded-2xl bg-card py-10 text-center text-sm text-muted-foreground">No posts yet.</div>
        ) : (
          <div className="space-y-2.5">
            {posts.map((p) => {
              const statusMeta = STATUS_META[p.status];
              return (
                <div key={p.id} className="border border-border rounded-xl bg-card p-3.5 flex gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                    {p.media_type === 'video' ? (
                      <video src={p.media_url} className="w-full h-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.media_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusMeta.className}`}>{statusMeta.label}</span>
                      {p.platforms.map((pl) => {
                        const meta = PLATFORM_META[pl as keyof typeof PLATFORM_META];
                        const result = p.results?.[pl];
                        const Icon = meta?.icon;
                        return (
                          <span key={pl} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            {Icon && <Icon className={`w-3 h-3 ${meta.color}`} />}
                            {result?.success === true && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                            {result?.success === false && <XCircle className="w-3 h-3 text-destructive" />}
                          </span>
                        );
                      })}
                    </div>
                    {p.caption && <p className="text-sm text-foreground line-clamp-2">{p.caption}</p>}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {p.status === 'scheduled' ? `Scheduled for ${new Date(p.scheduled_at!).toLocaleString()}` : p.published_at ? new Date(p.published_at).toLocaleString() : ''}
                    </div>
                    {p.results && Object.entries(p.results).some(([, r]) => !r.success) && (
                      <p className="text-[11px] text-destructive">
                        {Object.entries(p.results).filter(([, r]) => !r.success).map(([pl, r]) => `${pl}: ${r.error}`).join(' · ')}
                      </p>
                    )}
                  </div>
                  {p.status === 'scheduled' && (
                    <button onClick={() => cancelPost(p.id)} className="text-muted-foreground hover:text-destructive self-start" title="Cancel">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Facebook Page picker */}
      {pagePicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <p className="font-semibold text-foreground">Choose a Facebook Page</p>
              <button onClick={() => setPagePicker(null)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
              {pagePicker.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No Pages found on your Facebook account.</p>
              )}
              {pagePicker.map((page) => (
                <button key={page.id} onClick={() => pickPage(page.id)} disabled={connectingPage}
                  className="w-full flex items-center justify-between px-4 py-3 border border-border rounded-lg hover:bg-muted transition text-left disabled:opacity-60">
                  <div>
                    <p className="text-sm font-medium text-foreground">{page.name}</p>
                    {page.has_instagram && <p className="text-[11px] text-pink-600 flex items-center gap-1"><Instagram className="w-3 h-3" /> Instagram will connect too</p>}
                  </div>
                  {connectingPage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
