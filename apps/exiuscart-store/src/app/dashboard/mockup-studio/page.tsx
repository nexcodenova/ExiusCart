'use client';

// Mockup Studio for print on demand: pick a design (from My Designs, or
// upload one), a product (t-shirt, hoodie, mug...), a colour and a style (on a
// model, flat lay, Etsy-style bundle...) -> a photorealistic mockup, saved to
// Brand Assets, ready for Printify/Etsy listings or an ExiusCart product.

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Layers, Sparkles, Loader2, AlertCircle, Upload, Download, PackagePlus, RefreshCw, Palette } from 'lucide-react';
import { studioApi, aiStudioApi, StudioAsset } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { aiErrorText } from '@/components/ai-studio/AiCopyStudio';
import { CHECKER } from '@/components/ai-studio/AssetLibrary';
import AddToProductDialog from '@/components/ai-studio/AddToProductDialog';

const GARMENTS = [
  { key: 'tshirt', label: 'T-shirt' }, { key: 'oversized_tshirt', label: 'Oversized tee' }, { key: 'hoodie', label: 'Hoodie' },
  { key: 'sweatshirt', label: 'Sweatshirt' }, { key: 'tank', label: 'Tank top' }, { key: 'kids_tshirt', label: 'Kids tee' },
  { key: 'tote', label: 'Tote bag' }, { key: 'mug', label: 'Mug' }, { key: 'cap', label: 'Cap' },
  { key: 'poster', label: 'Poster' }, { key: 'phone_case', label: 'Phone case' },
];
const COLORS = [
  { key: 'white', hex: '#ffffff' }, { key: 'black', hex: '#111111' }, { key: 'heather grey', hex: '#b5b5b5' },
  { key: 'navy', hex: '#1f2a44' }, { key: 'sand', hex: '#d8c7a8' }, { key: 'natural cream', hex: '#efe6d2' },
  { key: 'forest green', hex: '#2f4b3a' }, { key: 'maroon', hex: '#6b1f2a' }, { key: 'pink', hex: '#f3b6c6' }, { key: 'sky blue', hex: '#9cc7e8' },
];
const STYLES = [
  { key: 'model', label: 'On a model' }, { key: 'flat_lay', label: 'Flat lay' }, { key: 'hanging', label: 'On a hanger' },
  { key: 'folded', label: 'Folded' }, { key: 'bundle', label: 'Bundle (several colours)' }, { key: 'lifestyle', label: 'Lifestyle scene' },
];

function MockupStudio() {
  const params = useSearchParams();
  const [shopId, setShopId] = useState('');
  const [designs, setDesigns] = useState<StudioAsset[]>([]);
  const [design, setDesign] = useState<StudioAsset | null>(null);
  const [garment, setGarment] = useState('tshirt');
  const [color, setColor] = useState('white');
  const [style, setStyle] = useState('model');
  const [modelLook, setModelLook] = useState('');
  const [extra, setExtra] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<StudioAsset[]>([]);
  const [usage, setUsage] = useState<{ images_left: number; images_limit: number } | null>(null);
  const [adding, setAdding] = useState<StudioAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);
  useEffect(() => {
    if (!shopId) return;
    aiStudioApi.usage(shopId).then((r) => setUsage(r.data)).catch(() => {});
    studioApi.assets(shopId, 'design,upload').then((r) => {
      const list: StudioAsset[] = r.data.assets ?? [];
      setDesigns(list);
      const wanted = Number(params.get('design'));
      setDesign(list.find((d) => d.id === wanted) ?? list[0] ?? null);
    }).catch(() => {});
  }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = usage !== null && usage.images_limit === 0;

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true); setError('');
    try {
      const r = await studioApi.upload(shopId, f, 'design');
      setDesigns((d) => [r.data, ...d]);
      setDesign(r.data);
    } catch (e: any) {
      setError(aiErrorText(e, 'Upload failed.'));
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const make = async () => {
    if (!design) return;
    setLoading(true); setError('');
    try {
      const r = await studioApi.mockup(shopId, {
        design_asset_id: design.id, garment, color, style,
        model_look: modelLook.trim() || undefined, extra: extra.trim() || undefined,
      });
      setResults((prev) => [r.data.asset, ...prev]);
      if (r.data.usage) setUsage(r.data.usage);
    } catch (e: any) {
      setError(aiErrorText(e, 'The AI could not make this mockup right now.'));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Layers className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Mockup Studio</h1>
            <p className="text-sm text-muted-foreground">Put your design on t-shirts, hoodies, mugs and more — on a model, flat lay or as an Etsy-style bundle. Ready for Printify, Etsy or your store.</p>
          </div>
        </div>
        {usage && <Badge variant="muted" className="py-1.5">{locked ? 'Growth & Scale plans' : `${usage.images_left} of ${usage.images_limit} AI images left`}</Badge>}
      </div>

      {locked ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          AI mockups are part of Growth (75 a month) and Scale (200 a month). <Link href="/dashboard/billing" className="font-medium text-primary hover:underline">Upgrade</Link>
        </CardContent></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-5">
          <div className="space-y-6 xl:col-span-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">1. Choose your design</CardTitle>
                <div className="flex gap-2">
                  <Button asChild variant="ghost" size="sm"><Link href="/dashboard/design-studio"><Palette className="h-4 w-4" /> Make one with AI</Link></Button>
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload design
                  </Button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
                </div>
              </CardHeader>
              <CardContent>
                {designs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No designs yet. Upload your artwork (a PNG with a transparent background works best) or make one in Design Studio.</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {designs.slice(0, 30).map((d) => (
                      <button key={d.id} type="button" onClick={() => setDesign(d)} title={d.title ?? ''}
                        className={cn('h-24 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition', CHECKER, design?.id === d.id ? 'border-primary' : 'border-border')}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.url} alt="" className="h-full w-full object-contain p-1.5" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">2. Product, colour and style</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="mb-1.5 block">Product</Label>
                  <div className="flex flex-wrap gap-2">
                    {GARMENTS.map((g) => (
                      <button key={g.key} type="button" onClick={() => setGarment(g.key)}
                        className={cn('rounded-full border px-3 py-1.5 text-sm transition', garment === g.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-muted/50')}>{g.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block">Colour: <span className="font-normal capitalize text-muted-foreground">{color}</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button key={c.key} type="button" onClick={() => setColor(c.key)} title={c.key}
                        className={cn('h-8 w-8 rounded-full border-2 transition', color === c.key ? 'border-primary ring-2 ring-primary/30' : 'border-border')}
                        style={{ backgroundColor: c.hex }} />
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block">Style</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {STYLES.map((s) => (
                      <button key={s.key} type="button" onClick={() => setStyle(s.key)}
                        className={cn('rounded-lg border px-3 py-2 text-left text-sm transition', style === s.key ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground hover:bg-muted/50')}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(style === 'model' || style === 'lifestyle') && (
                    <div>
                      <Label className="mb-1.5 block">Model (optional)</Label>
                      <Input value={modelLook} onChange={(e) => setModelLook(e.target.value)} maxLength={120} placeholder="e.g. woman, 20s, casual street style" />
                    </div>
                  )}
                  <div className={style === 'model' || style === 'lifestyle' ? '' : 'sm:col-span-2'}>
                    <Label className="mb-1.5 block">Extra direction (optional)</Label>
                    <Input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={300} placeholder="e.g. autumn park, warm light" />
                  </div>
                </div>
                <Button onClick={make} disabled={loading || !design}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Making mockup… (up to a minute)</> : <><Sparkles className="h-4 w-4" /> Create mockup (uses 1)</>}
                </Button>
                {error && <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit xl:col-span-2">
            <CardHeader><CardTitle className="text-base">Your mockups</CardTitle></CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Mockups appear here and are saved to Brand Assets.
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map((m) => (
                    <div key={m.id} className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt={m.title ?? 'Mockup'} className="w-full rounded-lg border border-border" />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setAdding(m)}><PackagePlus className="h-3.5 w-3.5" /> Add to a product</Button>
                        <Button asChild size="sm" variant="outline"><a href={m.url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /> Full size</a></Button>
                        <Button size="sm" variant="ghost" onClick={make} disabled={loading}><RefreshCw className="h-3.5 w-3.5" /> Another</Button>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Check the print matches your design before using it. All mockups are in <Link href="/dashboard/brand-assets" className="text-primary hover:underline">Brand Assets</Link>.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <AddToProductDialog shopId={shopId} asset={adding} onClose={() => setAdding(null)} />
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><MockupStudio /></Suspense>;
}
