'use client';

// Design Studio: describe a print design, AI makes the artwork (a transparent
// PNG when GPT makes it), saved to My Designs / Brand Assets, one click to mockups.

import StudioHeader, { UsagePill } from '@/components/ai-studio/StudioHeader';
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
  const [writing, setWriting] = useState(false);

  // Plain words in, a vivid design brief out (cheap text AI, not an image)
  const writeForMe = async () => {
    setWriting(true); setError('');
    try {
      const r = await studioApi.designIdea(shopId, { idea: idea.trim() || undefined, style, text: text.trim() || undefined });
      setIdea(r.data.idea);
    } catch (e: any) {
      setError(aiErrorText(e, 'The AI could not write this right now.'));
    } finally { setWriting(false); }
  };
  const canCreate = idea.trim().length >= 3 || text.trim().length >= 2;

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
      <StudioHeader icon={Palette} title="Design Studio"
        subtitle="Describe an idea and get print-ready artwork for t-shirts, hoodies, mugs and more."
        right={usage && <UsagePill text={locked ? 'Growth & Scale plans' : `${usage.images_left} of ${usage.images_limit} AI images left`} />}
        banner={{ title: 'Artwork that sells, in seconds', description: 'Type the idea, pick a style, add the words. ExiusCart Studio draws a print-ready design with a transparent background, ready for mockups and print on demand.' }}
        bannerVariant={1}
        steps={[
          { title: 'Describe it', body: 'An idea, a niche and any words to print, e.g. "iced coffee and sunshine".' },
          { title: 'Pick a style', body: 'Vintage, minimal, retro, cartoon, streetwear and more.' },
          { title: 'Use it', body: 'Open it in Mockup Studio, or send it to Printify, Printful or Gelato.' },
        ]} />

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
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Label>What should it show?</Label>
                  <button type="button" onClick={writeForMe} disabled={writing || (!idea.trim() && !text.trim())}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50">
                    {writing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-indigo-500" />}
                    {writing ? 'Writing…' : 'Write it for me'}
                  </button>
                </div>
                <Textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} maxLength={500}
                  placeholder="Plain words are fine, e.g. coffee and flowers, happy morning. Or just fill in the text below and click Write it for me." />
                <p className="mt-1 text-xs text-muted-foreground">Leave it empty to make a design from the text alone.</p>
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
              <Button onClick={make} disabled={loading || !canCreate}>
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
