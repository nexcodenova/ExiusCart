'use client';

// AI Studio inside the product editor: (1) better title, description, Google
// title/description, benefits, FAQ and SEO keywords — shown old vs new, the
// seller ticks what to use and it fills the form (the normal Save keeps it);
// (2) AI images from one of the product's photos: clean studio shot,
// lifestyle scene, clothing on a model, or an ad image.
// Backend: app/api/v1/endpoints/ai_studio.py.

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, AlertCircle, ImagePlus, RefreshCw, Shirt, Camera, Trees, Megaphone, Check } from 'lucide-react';
import { aiStudioApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface AiCopy {
  title?: string;
  seo_title?: string;
  meta_description?: string;
  description_html?: string;
  benefits?: string[];
  faq?: { question: string; answer: string }[];
  keywords?: string[];
}

type FieldKey = keyof AiCopy;

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'title', label: 'Product title' },
  { key: 'seo_title', label: 'Google title' },
  { key: 'meta_description', label: 'Google description' },
  { key: 'description_html', label: 'Description' },
  { key: 'benefits', label: 'Highlights (5 benefits)' },
  { key: 'faq', label: 'FAQ' },
  { key: 'keywords', label: 'SEO keywords' },
];

const MODES = [
  { key: 'studio', label: 'Studio photo', hint: 'Clean white background', icon: Camera },
  { key: 'lifestyle', label: 'Lifestyle', hint: 'In a real setting', icon: Trees },
  { key: 'model', label: 'On a model', hint: 'Clothing worn by a person', icon: Shirt },
  { key: 'ad', label: 'Ad image', hint: 'Bold social ad', icon: Megaphone },
] as const;

function errorText(e: any, fallback: string): string {
  const d = e?.response?.data?.detail;
  return (typeof d === 'object' ? d?.message : d) || fallback;
}

function Preview({ k, value }: { k: FieldKey; value: any }) {
  if (value == null || (Array.isArray(value) && value.length === 0) || value === '') {
    return <p className="text-xs italic text-muted-foreground">Empty</p>;
  }
  if (k === 'description_html') {
    return <div className="prose prose-sm max-w-none text-xs text-foreground [&_ul]:list-disc [&_ul]:pl-4" dangerouslySetInnerHTML={{ __html: String(value) }} />;
  }
  if (k === 'faq') {
    return (
      <ul className="space-y-1.5 text-xs">
        {(value as { question: string; answer: string }[]).map((f, i) => (
          <li key={i}><span className="font-medium text-foreground">{f.question}</span><br /><span className="text-muted-foreground">{f.answer}</span></li>
        ))}
      </ul>
    );
  }
  if (Array.isArray(value)) {
    return <div className="flex flex-wrap gap-1">{value.map((v, i) => <Badge key={i} variant="muted" className="font-normal">{String(v)}</Badge>)}</div>;
  }
  return <p className="text-xs text-foreground">{String(value)}</p>;
}

export default function AiStudioPanel({ shopId, productId, productName, photos, onApply, onImageAdded }: {
  shopId: string;
  productId?: string | number | null;
  productName: string;
  photos: string[];
  onApply: (copy: AiCopy) => void;
  onImageAdded: () => void;
}) {
  // ── copy ──
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [current, setCurrent] = useState<AiCopy | null>(null);
  const [suggested, setSuggested] = useState<AiCopy | null>(null);
  const [picked, setPicked] = useState<Set<FieldKey>>(new Set());
  const [applied, setApplied] = useState(false);

  // ── images ──
  const [usage, setUsage] = useState<{ images_used: number; images_limit: number; images_left: number } | null>(null);
  const [mode, setMode] = useState<string>('studio');
  const [reference, setReference] = useState<string>(photos[0] ?? '');
  const [modelLook, setModelLook] = useState('');
  const [extra, setExtra] = useState('');
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedMsg, setAddedMsg] = useState('');

  useEffect(() => { if (!reference && photos[0]) setReference(photos[0]); }, [photos, reference]);
  useEffect(() => {
    aiStudioApi.usage(shopId).then((r) => setUsage(r.data)).catch(() => {});
  }, [shopId]);

  if (!productId) {
    return <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2.5">Save the product first, then come back here to improve it with AI.</p>;
  }

  const improve = async () => {
    setCopyLoading(true); setCopyError(''); setApplied(false);
    try {
      const r = await aiStudioApi.improve(shopId, productId);
      setCurrent(r.data.current); setSuggested(r.data.suggested);
      setPicked(new Set(FIELDS.map((f) => f.key).filter((k) => {
        const v = (r.data.suggested as AiCopy)[k];
        return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
      })));
    } catch (e: any) {
      setCopyError(errorText(e, 'The AI could not improve this product right now.'));
    } finally { setCopyLoading(false); }
  };

  const useSelected = () => {
    if (!suggested) return;
    const out: AiCopy = {};
    picked.forEach((k) => { (out as any)[k] = suggested[k]; });
    onApply(out);
    setApplied(true);
  };

  const generate = async () => {
    setImgLoading(true); setImgError(''); setResult(null); setAddedMsg('');
    try {
      const r = await aiStudioApi.image(shopId, productId, {
        mode, reference_url: reference, extra: extra.trim() || undefined, model_look: mode === 'model' ? modelLook.trim() || undefined : undefined,
      });
      setResult(r.data.url);
      if (r.data.usage) setUsage(r.data.usage);
    } catch (e: any) {
      setImgError(errorText(e, 'The AI could not make this image right now.'));
    } finally { setImgLoading(false); }
  };

  const add = async (makePrimary: boolean) => {
    if (!result) return;
    setAdding(true); setImgError('');
    try {
      await aiStudioApi.addImage(shopId, productId, result, makePrimary);
      setAddedMsg(makePrimary ? 'Set as the main photo.' : 'Added to the product photos.');
      onImageAdded();
    } catch (e: any) {
      setImgError(errorText(e, 'Could not add the image.'));
    } finally { setAdding(false); }
  };

  const imagesLocked = usage !== null && usage.images_limit === 0;

  return (
    <Tabs defaultValue="copy" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="copy"><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Improve copy &amp; SEO</TabsTrigger>
        <TabsTrigger value="images"><ImagePlus className="w-3.5 h-3.5 mr-1.5" /> AI images</TabsTrigger>
      </TabsList>

      <TabsContent value="copy" className="space-y-3 pt-2">
        <p className="text-xs text-muted-foreground">
          Finds the keywords shoppers really search for, then rewrites the title, description, Google result, highlights and FAQ. You choose what to use.
        </p>
        <Button type="button" onClick={improve} disabled={copyLoading} className="w-full">
          {copyLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Researching keywords and writing…</> : <><Sparkles className="w-4 h-4" /> {suggested ? 'Write again' : 'Improve with AI'}</>}
        </Button>
        {copyError && (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {copyError}
          </div>
        )}
        {suggested && current && (
          <div className="space-y-2">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className={cn('rounded-lg border p-3 transition', picked.has(key) ? 'border-primary/50 bg-primary/5' : 'border-border')}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <Checkbox
                    checked={picked.has(key)}
                    onCheckedChange={(v) => setPicked((prev) => { const n = new Set(prev); v ? n.add(key) : n.delete(key); return n; })}
                  />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Now</p><Preview k={key} value={current[key]} /></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-primary mb-1">AI suggestion</p><Preview k={key} value={suggested[key]} /></div>
                </div>
              </div>
            ))}
            <Button type="button" onClick={useSelected} disabled={picked.size === 0} className="w-full">
              <Check className="w-4 h-4" /> Use {picked.size} selected
            </Button>
            {applied && <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">Filled into the form. Click Save to keep the changes.</p>}
          </div>
        )}
      </TabsContent>

      <TabsContent value="images" className="space-y-3 pt-2">
        {usage && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">AI images this month</span>
            <Badge variant={usage.images_left > 0 ? 'muted' : 'outline'}>
              {imagesLocked ? 'Growth & Scale plans' : `${usage.images_left} of ${usage.images_limit} left`}
            </Badge>
          </div>
        )}
        {imagesLocked ? (
          <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2.5">
            AI product images are included in Growth (75 a month) and Scale (200 a month). Upgrade to create studio shots, lifestyle scenes and model photos.
          </p>
        ) : photos.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2.5">Add at least one real photo of the product first — the AI starts from it.</p>
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
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">2. What to make</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button key={m.key} type="button" onClick={() => setMode(m.key)}
                    className={cn('flex items-start gap-2 rounded-lg border p-2.5 text-left transition', mode === m.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                    <m.icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span><span className="block text-sm font-medium text-foreground">{m.label}</span><span className="block text-[11px] text-muted-foreground">{m.hint}</span></span>
                  </button>
                ))}
              </div>
            </div>
            {mode === 'model' && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Model (optional)</Label>
                <Input value={modelLook} onChange={(e) => setModelLook(e.target.value)} placeholder="e.g. woman, 20s, casual street style" maxLength={120} />
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Extra direction (optional)</Label>
              <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. beach at sunset, warm tones" maxLength={300} />
            </div>
            <Button type="button" onClick={generate} disabled={imgLoading || !reference || (usage !== null && usage.images_left <= 0)} className="w-full">
              {imgLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating image… (up to a minute)</> : <><Sparkles className="w-4 h-4" /> Create image (uses 1)</>}
            </Button>
            {imgError && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {imgError}
              </div>
            )}
            {result && (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result} alt="AI result" className="w-full rounded-lg border border-border" />
                <p className="text-[11px] text-muted-foreground">Check the product looks exactly right (logo, print, colours) before using it.</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => add(false)} disabled={adding}>Add to photos</Button>
                  <Button type="button" size="sm" onClick={() => add(true)} disabled={adding}>Make main photo</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={generate} disabled={imgLoading}><RefreshCw className="w-3.5 h-3.5" /> Try again</Button>
                </div>
                {addedMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">{addedMsg}</p>}
              </div>
            )}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
