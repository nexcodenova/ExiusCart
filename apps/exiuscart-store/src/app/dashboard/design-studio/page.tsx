'use client';

// Design Studio: describe a print design, AI makes the artwork (a transparent
// PNG when GPT makes it), saved to My Designs / Brand Assets, one click to mockups.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Palette, Sparkles, Loader2, AlertCircle, Shirt, Download, RefreshCw } from 'lucide-react';
import { studioApi, aiStudioApi, StudioAsset } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { aiErrorText } from '@/components/ai-studio/AiCopyStudio';
import { CHECKER } from '@/components/ai-studio/AssetLibrary';
import SendToPodDialog from '@/components/ai-studio/SendToPodDialog';

const STYLES = [
  { key: 'vintage', label: 'Vintage' }, { key: 'minimal', label: 'Minimal line art' }, { key: 'typography', label: 'Bold text' },
  { key: 'retro_sunset', label: 'Retro sunset' }, { key: 'cartoon', label: 'Cartoon' }, { key: 'streetwear', label: 'Streetwear' },
  { key: 'floral', label: 'Floral' }, { key: 'badge', label: 'Badge / emblem' },
];

export default function Page() {
  const [shopId, setShopId] = useState('');
  const [idea, setIdea] = useState('');
  const [style, setStyle] = useState('vintage');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<StudioAsset | null>(null);
  const [usage, setUsage] = useState<{ images_left: number; images_limit: number } | null>(null);
  const [toPrintify, setToPrintify] = useState<StudioAsset | null>(null);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);
  useEffect(() => { if (shopId) aiStudioApi.usage(shopId).then((r) => setUsage(r.data)).catch(() => {}); }, [shopId]);

  const locked = usage !== null && usage.images_limit === 0;

  const make = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await studioApi.design(shopId, { idea: idea.trim(), style, text: text.trim() || undefined });
      setResult(r.data.asset);
      if (r.data.usage) setUsage(r.data.usage);
    } catch (e: any) {
      setError(aiErrorText(e, 'The AI could not make this design right now.'));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Palette className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Design Studio</h1>
            <p className="text-sm text-muted-foreground">Describe a t-shirt design. AI draws print-ready artwork you can turn into mockups and sell on Printify or Etsy.</p>
          </div>
        </div>
        {usage && <Badge variant="muted" className="py-1.5">{locked ? 'Growth & Scale plans' : `${usage.images_left} of ${usage.images_limit} AI images left`}</Badge>}
      </div>

      {locked ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          AI designs are part of Growth (75 a month) and Scale (200 a month). <Link href="/dashboard/billing" className="font-medium text-primary hover:underline">Upgrade</Link>
        </CardContent></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Your design</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-1.5 block">What should it show? *</Label>
                <Textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} maxLength={400}
                  placeholder="e.g. a cat surfing a big wave at sunset, for summer lovers" />
              </div>
              <div>
                <Label className="mb-1.5 block">Style</Label>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map((s) => (
                    <button key={s.key} type="button" onClick={() => setStyle(s.key)}
                      className={cn('rounded-full border px-3 py-1.5 text-sm transition', style === s.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-muted/50')}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Text on the design (optional)</Label>
                <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder='e.g. "Salty but Sweet"' />
                <p className="mt-1 text-xs text-muted-foreground">Keep it short. Always check the spelling on the result.</p>
              </div>
              <Button onClick={make} disabled={loading || idea.trim().length < 3}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Drawing… (up to a minute)</> : <><Sparkles className="h-4 w-4" /> Create design (uses 1)</>}
              </Button>
              {error && <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}
              <p className="text-xs text-muted-foreground">Don&apos;t ask for brand logos, famous characters or other people&apos;s artwork — selling those can get your shop taken down.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Result</CardTitle></CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-3">
                  <div className={cn('aspect-square w-full max-w-md overflow-hidden rounded-lg border border-border', CHECKER)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.url} alt="Design" className="h-full w-full object-contain p-4" />
                  </div>
                  <p className="text-sm text-muted-foreground">Saved to My Designs.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild><Link href={`/dashboard/mockup-studio?design=${result.id}`}><Shirt className="h-4 w-4" /> Make mockups</Link></Button>
                    <Button variant="outline" onClick={() => setToPrintify(result)}>Sell with print on demand</Button>
                    <Button asChild variant="outline"><a href={result.url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /> Full size</a></Button>
                    <Button variant="ghost" onClick={make} disabled={loading}><RefreshCw className="h-4 w-4" /> Try again</Button>
                  </div>
                </div>
              ) : (
                <div className={cn('flex aspect-square w-full max-w-md items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground', CHECKER)}>
                  Your design appears here
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <SendToPodDialog shopId={shopId} asset={toPrintify} onClose={() => setToPrintify(null)} />
    </div>
  );
}
