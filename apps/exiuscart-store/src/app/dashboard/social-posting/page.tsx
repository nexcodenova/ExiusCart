'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Share2, Loader2, Upload, X, Calendar, AlertCircle,
  CheckCircle2, XCircle, Clock, Trash2, ExternalLink, Lock, Eye, Link2,
  MoreHorizontal, ThumbsUp, MessageCircle, Sparkles, Image as ImageIcon,
  Globe2, Rocket, Send, Clock3, ChevronDown,
} from 'lucide-react';
import { socialPostingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

// Real brand mark files (apps/exiuscart-store/public/social media icons/) —
// self-contained images (own color/background), not tinted glyphs, so they're
// rendered directly rather than boxed in an extra colored background.
const PLATFORM_ICON_SRC = {
  facebook: '/social%20media%20icons/2023_Facebook_icon.svg',
  instagram: '/social%20media%20icons/Instagram_logo_2022.svg',
  tiktok: '/social%20media%20icons/brand-tiktok-sq-svgrepo-com.svg',
} as const;

function PlatformImg({ platform, className }: { platform: keyof typeof PLATFORM_ICON_SRC; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={PLATFORM_ICON_SRC[platform]} alt="" className={className} />
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
  facebook: { label: 'Facebook' },
  instagram: { label: 'Instagram' },
  tiktok: { label: 'TikTok' },
} as const;

const STATUS_META: Record<Post['status'], { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'bg-blue-500/10 text-blue-600' },
  publishing: { label: 'Publishing…', className: 'bg-amber-500/10 text-amber-600' },
  published: { label: 'Published', className: 'bg-green-500/10 text-green-600' },
  partial: { label: 'Partially published', className: 'bg-amber-500/10 text-amber-600' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
  canceled: { label: 'Canceled', className: 'bg-muted text-muted-foreground' },
};

function StepBadge({ n }: { n: number }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
      {n}
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-14 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <Rocket className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">{label} is coming soon</p>
        <p className="mt-1 text-xs text-muted-foreground">We're still building this — check back shortly.</p>
      </CardContent>
    </Card>
  );
}

export default function SocialPostingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const [tab, setTab] = useState('compose');
  const [composeTab, setComposeTab] = useState('media');
  const [showPreview, setShowPreview] = useState(true);

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

  const submit = async (schedule: boolean) => {
    if (!file) { setPostError('Choose an image or video first.'); return; }
    if (selectedPlatforms.size === 0) { setPostError('Pick at least one connected platform.'); return; }
    if (schedule && !scheduledAt) { setPostError('Pick a date and time to schedule for.'); return; }
    setPosting(true);
    setPostError('');
    try {
      await socialPostingApi.createPost(shopId, {
        file, caption, platforms: Array.from(selectedPlatforms),
        scheduledAt: schedule && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      handleFilePick(null);
      setCaption('');
      setSelectedPlatforms(new Set());
      setScheduledAt('');
      setComposeTab('media');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadPosts(shopId);
      setTab(schedule ? 'scheduled' : 'published');
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

  const scheduledPosts = posts.filter((p) => p.status === 'scheduled' || p.status === 'publishing');
  const publishedPosts = posts.filter((p) => p.status === 'published' || p.status === 'partial' || p.status === 'failed' || p.status === 'canceled');
  const previewPlatform = (Array.from(selectedPlatforms)[0] as keyof typeof PLATFORM_META) || 'facebook';
  const connectedCount = connections.length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-7 py-7">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Marketing
            </div>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground">Social Media Auto Posting</h1>
            <p className="mt-1 text-base font-medium text-foreground/80">Create once. Share everywhere.</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Automatically post your product photos, videos and promotions to Facebook, Instagram
              and TikTok — directly from your own connected accounts.
            </p>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            {/* Floating brand marks */}
            <div className="relative hidden h-24 w-32 shrink-0 md:block">
              <img src="/social%20media%20icons/Instagram_logo_2022.svg" alt="" className="absolute left-0 top-0 h-12 w-12 -rotate-6 rounded-2xl shadow-xl ring-4 ring-background" />
              <div className="absolute right-0 top-1 h-12 w-12 rotate-6 rounded-2xl shadow-xl ring-4 ring-background overflow-hidden">
                <img src="/social%20media%20icons/brand-tiktok-sq-svgrepo-com.svg" alt="" className="h-full w-full" />
              </div>
              <img src="/social%20media%20icons/2023_Facebook_icon.svg" alt="" className="absolute left-8 bottom-0 h-12 w-12 rotate-3 shadow-xl ring-4 ring-background rounded-full" />
            </div>

            <div className="hidden items-center gap-2 rounded-2xl border border-border bg-card/70 px-4 py-3 shadow-sm backdrop-blur md:flex">
              <div className="rounded-xl bg-primary/10 p-2">
                <Rocket className="h-4 w-4 text-primary" />
              </div>
              <div className="text-[11px] font-medium leading-4 text-muted-foreground">
                <div className="font-bold text-foreground">Grow Your Audience</div>
                <div>Save time. Sell more.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {/* Page tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList className="h-auto w-max gap-1 bg-transparent p-0 border-b border-border rounded-none">
            {[
              { v: 'compose', label: 'Create Post' },
              { v: 'scheduled', label: 'Scheduled Posts', count: scheduledPosts.length },
              { v: 'published', label: 'Published' },
              { v: 'library', label: 'Content Library' },
              { v: 'settings', label: 'Settings' },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                {t.label}
                {!!t.count && <Badge variant="muted" className="ml-1.5 h-4 px-1.5 text-[10px]">{t.count}</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Create Post */}
        <TabsContent value="compose" className="mt-5 space-y-5">
          {/* Step 1 — Connect accounts */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="flex items-start gap-3">
                <StepBadge n={1} />
                <div>
                  <CardTitle className="text-[15px]">Connect Your Accounts</CardTitle>
                  <CardDescription className="mt-0.5">Connect your social media accounts to start posting automatically.</CardDescription>
                </div>
              </div>
              <Badge variant={connectedCount > 0 ? 'success' : 'muted'} className="shrink-0">{connectedCount} connected</Badge>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                {/* Facebook */}
                {(() => {
                  const conn = connections.find((c) => c.platform === 'facebook');
                  return (
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-center gap-2.5">
                        <PlatformImg platform="facebook" className="h-9 w-9" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">Facebook</p>
                          <p className="text-[11px] text-muted-foreground truncate">{conn ? conn.account_name : 'Not connected'}</p>
                        </div>
                        {conn && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-600" />}
                      </div>
                      {conn ? (
                        <Button variant="destructive" size="sm" className="mt-3 w-full" onClick={() => disconnect(conn)}>Disconnect</Button>
                      ) : loadingConnections ? (
                        <div className="mt-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <Button size="sm" className="mt-3 w-full bg-[#1877F2] text-white hover:bg-[#1877F2]/90" disabled={!fbConfigured} onClick={connectFacebook}>
                          <Link2 className="w-3.5 h-3.5" />
                          {fbConfigured ? 'Connect' : 'Not available yet'}
                        </Button>
                      )}
                    </div>
                  );
                })()}

                {/* Instagram */}
                {(() => {
                  const conn = connections.find((c) => c.platform === 'instagram');
                  return (
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-center gap-2.5">
                        <PlatformImg platform="instagram" className="h-9 w-9" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">Instagram</p>
                          <p className="text-[11px] text-muted-foreground truncate">{conn ? `@${conn.account_name}` : 'Not connected'}</p>
                        </div>
                        {conn && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-600" />}
                      </div>
                      {conn ? (
                        <Button variant="destructive" size="sm" className="mt-3 w-full" onClick={() => disconnect(conn)}>Disconnect</Button>
                      ) : (
                        <>
                          <Button size="sm" className="mt-3 w-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-white hover:opacity-90" disabled={!fbConfigured} onClick={connectFacebook}>
                            <Link2 className="w-3.5 h-3.5" />
                            Connect
                          </Button>
                          <p className="mt-1.5 text-[10px] text-muted-foreground">Connects automatically with a linked Facebook Page.</p>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* TikTok */}
                {(() => {
                  const conn = connections.find((c) => c.platform === 'tiktok');
                  return (
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg overflow-hidden">
                          <PlatformImg platform="tiktok" className="h-9 w-9" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">TikTok</p>
                          <p className="text-[11px] text-muted-foreground truncate">{conn ? conn.account_name : 'Not connected'}</p>
                        </div>
                        {conn && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-600" />}
                      </div>
                      {conn ? (
                        <Button variant="destructive" size="sm" className="mt-3 w-full" onClick={() => disconnect(conn)}>Disconnect</Button>
                      ) : loadingConnections ? (
                        <div className="mt-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <Button size="sm" className="mt-3 w-full bg-black text-white hover:bg-black/85" disabled={!tiktokConfigured} onClick={connectTiktok}>
                          <Link2 className="w-3.5 h-3.5" />
                          {tiktokConfigured ? 'Connect' : 'Not available yet'}
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>
              {(!fbConfigured || !tiktokConfigured) && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-[11px] leading-5 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {!fbConfigured && !tiktokConfigured ? 'Facebook/Instagram and TikTok posting are' : !fbConfigured ? 'Facebook/Instagram posting is' : 'TikTok posting is'} still pending platform approval — the composer below will work as soon as it's live.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2 — Composer + Preview */}
          <div className="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex items-start gap-3">
                  <StepBadge n={2} />
                  <div>
                    <CardTitle className="text-[15px]">Create Your Post</CardTitle>
                    <CardDescription className="mt-0.5">Upload your media, add a caption and choose where it goes.</CardDescription>
                  </div>
                </div>

                <Tabs value={composeTab} onValueChange={setComposeTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="media"><ImageIcon className="w-3.5 h-3.5" /> Media</TabsTrigger>
                    <TabsTrigger value="caption"><MessageCircle className="w-3.5 h-3.5" /> Caption</TabsTrigger>
                    <TabsTrigger value="platforms"><Globe2 className="w-3.5 h-3.5" /> Platforms</TabsTrigger>
                    <TabsTrigger value="schedule"><Calendar className="w-3.5 h-3.5" /> Schedule</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>

              <CardContent className="pt-0 space-y-4">
                {composeTab === 'media' && (
                  <>
                    <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
                      onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)} />
                    {!preview ? (
                      <button onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-border rounded-xl py-14 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition">
                        <Upload className="w-6 h-6" />
                        <span className="text-sm font-medium">Drag & drop a photo or video here</span>
                        <span className="text-xs text-primary">or click to browse</span>
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
                    <p className="text-[11px] text-muted-foreground">Supports: JPG, PNG, MP4, MOV</p>
                  </>
                )}

                {composeTab === 'caption' && (
                  <div>
                    <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={7}
                      placeholder="Write something for this post…" />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{caption.length}/2,200 characters</p>
                  </div>
                )}

                {composeTab === 'platforms' && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Choose which connected accounts should receive this post.</p>
                    {(Object.keys(PLATFORM_META) as (keyof typeof PLATFORM_META)[]).map((p) => {
                      const meta = PLATFORM_META[p];
                      const connected = connectedPlatforms.has(p);
                      const active = selectedPlatforms.has(p);
                      return (
                        <button key={p} type="button" disabled={!connected} onClick={() => togglePlatform(p)}
                          className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition
                            ${!connected ? 'opacity-40 cursor-not-allowed border-border' : active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
                          <PlatformImg platform={p} className="h-8 w-8 rounded-lg" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{meta.label}</p>
                            {!connected && <p className="text-[10px] text-muted-foreground">Not connected</p>}
                          </div>
                          {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {composeTab === 'schedule' && (
                  <div className="max-w-xs space-y-2">
                    <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Clock3 className="w-3.5 h-3.5" /> Date &amp; time
                    </label>
                    <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                    <p className="text-[11px] text-muted-foreground">Leave blank to post immediately instead.</p>
                  </div>
                )}

                {postError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {postError}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-5">
              {/* Preview */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    Post Preview
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Social Preview</span>
                    <Switch checked={showPreview} onCheckedChange={setShowPreview} />
                  </div>
                </CardHeader>
                {showPreview && (
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 rounded-lg bg-muted p-1">
                      {(Object.keys(PLATFORM_META) as (keyof typeof PLATFORM_META)[]).map((p) => {
                        const meta = PLATFORM_META[p];
                        const active = previewPlatform === p && selectedPlatforms.has(p);
                        return (
                          <button key={p} onClick={() => togglePlatform(p)}
                            className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition ${active ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}>
                            <PlatformImg platform={p} className="h-3.5 w-3.5" />
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 rounded-xl border border-border overflow-hidden bg-background">
                      <div className="p-3.5 flex items-center gap-2.5">
                        <PlatformImg platform={previewPlatform} className="h-8 w-8 rounded-lg" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">Your Store</p>
                          <p className="text-[10px] text-muted-foreground">Just now</p>
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                      </div>

                      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                        {preview ? (
                          file?.type.startsWith('video/') ? (
                            <video src={preview} className="w-full h-full object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt="" className="w-full h-full object-cover" />
                          )
                        ) : (
                          <div className="text-center text-muted-foreground">
                            <Upload className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
                            <p className="text-[11px]">Your media appears here</p>
                          </div>
                        )}
                      </div>

                      {caption && (
                        <p className="px-3.5 pt-3 text-xs text-foreground whitespace-pre-line line-clamp-4">{caption}</p>
                      )}

                      <Separator className="mt-3.5" />
                      <div className="grid grid-cols-2 divide-x divide-border">
                        <button className="flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-muted-foreground">
                          <ThumbsUp className="w-3.5 h-3.5" /> Like
                        </button>
                        <button className="flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-muted-foreground">
                          <MessageCircle className="w-3.5 h-3.5" /> Comment
                        </button>
                      </div>
                    </div>

                    {selectedPlatforms.size === 0 && (
                      <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> Pick a platform in the Platforms tab to preview it here.
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* Actions */}
              <Card>
                <CardContent className="p-4 flex gap-3">
                  <Button variant="outline" className="flex-1" disabled={posting} onClick={() => submit(false)}>
                    {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Post now
                  </Button>
                  <Button className="flex-[1.3]" disabled={posting} onClick={() => submit(true)}>
                    {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    Schedule post
                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Scheduled */}
        <TabsContent value="scheduled" className="mt-5">
          <PostList loading={loadingPosts} posts={scheduledPosts} emptyText="No scheduled posts." onCancel={cancelPost} />
        </TabsContent>

        {/* Published */}
        <TabsContent value="published" className="mt-5">
          <PostList loading={loadingPosts} posts={publishedPosts} emptyText="No published posts yet." />
        </TabsContent>

        {/* Content Library — no backend support yet */}
        <TabsContent value="library" className="mt-5">
          <ComingSoon label="Content Library" />
        </TabsContent>

        {/* Settings — no backend support yet */}
        <TabsContent value="settings" className="mt-5">
          <ComingSoon label="Social Posting Settings" />
        </TabsContent>
      </Tabs>

      {/* Facebook Page picker */}
      <Dialog open={!!pagePicker} onOpenChange={(open) => !open && setPagePicker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a Facebook Page</DialogTitle>
          </DialogHeader>
          <div className="p-5 pt-0 space-y-2 max-h-80 overflow-y-auto">
            {pagePicker?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No Pages found on your Facebook account.</p>
            )}
            {pagePicker?.map((page) => (
              <button key={page.id} onClick={() => pickPage(page.id)} disabled={connectingPage}
                className="w-full flex items-center justify-between px-4 py-3 border border-border rounded-lg hover:bg-muted transition text-left disabled:opacity-60">
                <div>
                  <p className="text-sm font-medium text-foreground">{page.name}</p>
                  {page.has_instagram && <p className="text-[11px] text-pink-600 flex items-center gap-1"><PlatformImg platform="instagram" className="w-3 h-3 rounded-sm" /> Instagram will connect too</p>}
                </div>
                {connectingPage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostList({ loading, posts, emptyText, onCancel }: { loading: boolean; posts: Post[]; emptyText: string; onCancel?: (id: number) => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
      </div>
    );
  }
  if (posts.length === 0) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{emptyText}</CardContent></Card>;
  }
  return (
    <div className="space-y-2.5">
      {posts.map((p) => {
        const statusMeta = STATUS_META[p.status];
        return (
          <Card key={p.id}>
            <CardContent className="p-3.5 flex gap-3">
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
                    const result = p.results?.[pl];
                    return (
                      <span key={pl} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        {pl in PLATFORM_ICON_SRC && <PlatformImg platform={pl as keyof typeof PLATFORM_ICON_SRC} className="w-3 h-3 rounded-sm" />}
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
              {p.status === 'scheduled' && onCancel && (
                <button onClick={() => onCancel(p.id)} className="text-muted-foreground hover:text-destructive self-start" title="Cancel">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
