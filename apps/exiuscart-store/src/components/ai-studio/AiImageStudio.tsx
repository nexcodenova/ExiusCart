'use client';

// AI images from one of a product's own photos: clean studio shot, lifestyle
// scene, clothing on a model, or an ad image. Shows the month's allowance
// (Growth 75 / Scale 200, Launch none). Used by the product editor and the
// Product Studio pages. Backend: app/api/v1/endpoints/ai_studio.py.

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw, Shirt, Camera, Trees, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { aiStudioApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { aiErrorText } from './AiCopyStudio';

export const IMAGE_MODES = {
  studio: { label: 'Studio photo', hint: 'Clean white background', icon: Camera },
  lifestyle: { label: 'Lifestyle', hint: 'In a real setting', icon: Trees },
  model: { label: 'On a model', hint: 'Clothing worn by a person', icon: Shirt },
  ad: { label: 'Ad image', hint: 'Bold social ad', icon: Megaphone },
} as const;
export type ImageMode = keyof typeof IMAGE_MODES;

type Usage = { images_used: number; images_limit: number; images_left: number };

export default function AiImageStudio({ shopId, productId, photos, onImageAdded, modes = ['studio', 'lifestyle', 'model', 'ad'] }: {
  shopId: string;
  productId: string | number;
  photos: string[];
  onImageAdded?: () => void;
  modes?: ImageMode[];
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [mode, setMode] = useState<ImageMode>(modes[0]);
  const [reference, setReference] = useState<string>(photos[0] ?? '');
  const [modelLook, setModelLook] = useState('');
  const [extra, setExtra] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedMsg, setAddedMsg] = useState('');

  // Reset only when the product changes (a new photo being added must not wipe the result on screen)
  useEffect(() => { setResult(null); setAddedMsg(''); setError(''); }, [productId]);
  const photoKey = photos.join('|');
  useEffect(() => { if (!photos.includes(reference)) setReference(photos[0] ?? ''); }, [photoKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (shopId) aiStudioApi.usage(shopId).then((r) => setUsage(r.data)).catch(() => {}); }, [shopId]);

  const generate = async () => {
    setLoading(true); setError(''); setResult(null); setAddedMsg('');
    try {
      const r = await aiStudioApi.image(shopId, productId, {
        mode, reference_url: reference, extra: extra.trim() || undefined, model_look: mode === 'model' ? modelLook.trim() || undefined : undefined,
      });
      setResult(r.data.url);
      if (r.data.usage) setUsage(r.data.usage);
    } catch (e: any) {
      setError(aiErrorText(e, 'The AI could not make this image right now.'));
    } finally { setLoading(false); }
  };

  const add = async (makePrimary: boolean) => {
    if (!result) return;
    setAdding(true); setError('');
    try {
      await aiStudioApi.addImage(shopId, productId, result, makePrimary);
      setAddedMsg(makePrimary ? 'Set as the main photo.' : 'Added to the product photos.');
      onImageAdded?.();
    } catch (e: any) {
      setError(aiErrorText(e, 'Could not add the image.'));
    } finally { setAdding(false); }
  };

  const locked = usage !== null && usage.images_limit === 0;

  return (
    <div className="space-y-4">
      {usage && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">AI images this month</span>
          <Badge variant={usage.images_left > 0 ? 'muted' : 'outline'}>
            {locked ? 'Growth & Scale plans' : `${usage.images_left} of ${usage.images_limit} left`}
          </Badge>
        </div>
      )}

      {locked ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          AI product images are included in Growth (75 a month) and Scale (200 a month).{' '}
          <Link href="/dashboard/billing" className="font-medium text-primary hover:underline">Upgrade</Link>
        </div>
      ) : photos.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This product has no photo yet. Add at least one real photo first — the AI starts from it.
        </div>
      ) : (
        <>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">1. Start from this photo</Label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.slice(0, 10).map((u) => (
                <button key={u} type="button" onClick={() => setReference(u)}
                  className={cn('relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition', reference === u ? 'border-primary' : 'border-border')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {modes.length > 1 && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">2. What to make</Label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {modes.map((key) => {
                  const m = IMAGE_MODES[key];
                  return (
                    <button key={key} type="button" onClick={() => setMode(key)}
                      className={cn('flex items-start gap-2 rounded-lg border p-2.5 text-left transition', mode === key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                      <m.icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <span><span className="block text-sm font-medium text-foreground">{m.label}</span><span className="block text-[11px] text-muted-foreground">{m.hint}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {mode === 'model' && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Model (optional)</Label>
                <Input value={modelLook} onChange={(e) => setModelLook(e.target.value)} placeholder="e.g. woman, 20s, casual street style" maxLength={120} />
              </div>
            )}
            <div className={mode === 'model' ? '' : 'sm:col-span-2'}>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Extra direction (optional)</Label>
              <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. beach at sunset, warm tones" maxLength={300} />
            </div>
          </div>

          <Button type="button" onClick={generate} disabled={loading || !reference || (usage !== null && usage.images_left <= 0)} className="w-full sm:w-auto">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating image… (up to a minute)</> : <><Sparkles className="w-4 h-4" /> Create image (uses 1)</>}
          </Button>

          {error && (
            <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {result && (
            <div className="space-y-2 max-w-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result} alt="AI result" className="w-full rounded-lg border border-border" />
              <p className="text-xs text-muted-foreground">Check the product looks exactly right (logo, print, colours) before using it.</p>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => add(false)} disabled={adding}>Add to photos</Button>
                <Button type="button" size="sm" onClick={() => add(true)} disabled={adding}>Make main photo</Button>
                <Button type="button" variant="ghost" size="sm" onClick={generate} disabled={loading}><RefreshCw className="w-3.5 h-3.5" /> Try again</Button>
              </div>
              {addedMsg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{addedMsg}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
