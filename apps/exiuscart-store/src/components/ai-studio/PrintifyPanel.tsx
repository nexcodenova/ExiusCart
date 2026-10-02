'use client';

// Turn a design into a real Printify product in the seller's own Printify
// account: product type -> print provider -> colours & sizes -> title/price ->
// create (optionally publish to the shop connected in Printify, and/or sell it
// in ExiusCart too, linked so orders go to Printify by themselves).
// Backend: printify.py send_design_to_printify.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { studioApi, aiStudioApi, StudioAsset } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { aiErrorText } from './AiCopyStudio';

type Blueprint = { id: number; title: string; brand?: string; model?: string; image?: string | null };
type Provider = { id: number; title: string; location?: string | null };
type Variant = { id: number; color: string | null; size: string | null };

export function PrintifyPanel({ shopId, asset, onClose }: { shopId: string; asset: StudioAsset | null; onClose: () => void }) {
  const [q, setQ] = useState('t-shirt');
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [bp, setBp] = useState<Blueprint | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [positions, setPositions] = useState<string[]>(['front']);
  const [colors, setColors] = useState<Set<string>>(new Set());
  const [sizes, setSizes] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState('front');
  const [scale, setScale] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [price, setPrice] = useState('24.99');
  const [publish, setPublish] = useState(false);
  const [importToStore, setImportToStore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ printify_product_id: string; published: boolean | null; store_product: any } | null>(null);
  const [notConnected, setNotConnected] = useState(false);

  const open = !!asset;

  useEffect(() => {
    if (!asset) return;
    setTitle(asset.title ?? ''); setDescription(''); setTags([]); setDone(null); setError(''); setBp(null); setNotConnected(false);
  }, [asset]);

  useEffect(() => {
    if (!open || bp) return;
    setLoading(true);
    const t = setTimeout(() => {
      studioApi.printifyBlueprints(shopId, q.trim())
        .then((r) => { setBlueprints(r.data.blueprints ?? []); setError(''); })
        .catch((e) => {
          const d = e?.response?.data?.detail;
          if (d?.error === 'printify_not_connected') setNotConnected(true);
          else setError(aiErrorText(e, 'Could not load the Printify catalogue.'));
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, q, bp, shopId]);

  const chooseBlueprint = async (b: Blueprint) => {
    setBp(b); setProviders([]); setProviderId(''); setVariants([]);
    try {
      const r = await studioApi.printifyProviders(shopId, b.id);
      setProviders(r.data.providers ?? []);
      if (r.data.providers?.[0]) setProviderId(String(r.data.providers[0].id));
    } catch (e: any) { setError(aiErrorText(e, 'Could not load print providers.')); }
  };

  useEffect(() => {
    if (!bp || !providerId) return;
    studioApi.printifyVariants(shopId, bp.id, Number(providerId)).then((r) => {
      const vs: Variant[] = r.data.variants ?? [];
      setVariants(vs);
      setPositions(r.data.positions ?? ['front']);
      setPosition((r.data.positions ?? ['front'])[0]);
      const cs: string[] = r.data.colors ?? [];
      setColors(new Set(cs.slice(0, 1)));
      setSizes(new Set(r.data.sizes ?? []));
    }).catch((e) => setError(aiErrorText(e, 'Could not load colours and sizes.')));
  }, [bp, providerId, shopId]);

  const allColors = useMemo(() => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[], [variants]);
  const allSizes = useMemo(() => Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[], [variants]);
  const chosen = variants.filter((v) => (!v.color || colors.has(v.color)) && (!v.size || sizes.has(v.size)));

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); setter(n);
  };

  const writeWithAi = async () => {
    setWriting(true); setError('');
    try {
      const r = await aiStudioApi.write(shopId, { name: `${title || 'Graphic design'} ${bp?.title ?? ''}`.trim(), details: description || undefined });
      const s = r.data.suggested;
      if (s.title) setTitle(s.title);
      if (s.description_html) setDescription(s.description_html.replace(/<li>/g, '• ').replace(/<[^>]+>/g, '\n').replace(/\n{2,}/g, '\n\n').trim());
      if (s.keywords) setTags(s.keywords.slice(0, 13));
    } catch (e: any) { setError(aiErrorText(e, 'AI could not write this right now.')); } finally { setWriting(false); }
  };

  const send = async () => {
    if (!asset || !bp || !providerId) return;
    setSending(true); setError('');
    try {
      const r = await studioApi.sendToPrintify(shopId, asset.id, {
        blueprint_id: bp.id, print_provider_id: Number(providerId), variant_ids: chosen.map((v) => v.id),
        price: parseFloat(price), title: title.trim(), description: description.trim() || undefined, tags,
        position, scale, publish, import_to_store: importToStore,
      });
      setDone(r.data);
    } catch (e: any) { setError(aiErrorText(e, 'Printify could not create the product.')); } finally { setSending(false); }
  };

  const close = () => { onClose(); };

  return (
      <>
        {notConnected ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Connect your Printify account first. Your products and orders stay in your own Printify account.</p>
            <Button asChild><Link href="/dashboard/dropshipping">Connect Printify</Link></Button>
          </div>
        ) : done ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-medium text-foreground">Created on Printify (product {done.printify_product_id}).</p>
                <p className="text-sm text-muted-foreground">Find it in Printify under My Products. {done.published === true ? 'Publishing to your connected store has started.' : done.published === false ? 'Publishing did not start — publish it from Printify.' : ''}</p>
                {done.store_product?.product_id && <p className="text-sm text-muted-foreground">Also added to your ExiusCart store — orders go to Printify by themselves when auto-fulfil is on.</p>}
                {done.store_product?.error && <p className="text-sm text-amber-700 dark:text-amber-400">Not added to your store: {done.store_product.error}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {done.store_product?.product_id && <Button asChild variant="outline"><Link href={`/dashboard/products?edit=${done.store_product.product_id}`}>Open in my store</Link></Button>}
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {asset && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt="" className="h-16 w-16 rounded-md border border-border object-contain bg-muted" />
                <p className="text-sm text-muted-foreground">This design will be printed on the product you choose.</p>
              </div>
            )}

            {!bp ? (
              <div className="space-y-2">
                <Label>1. Product</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" placeholder="t-shirt, hoodie, mug, tote…" />
                </div>
                {loading ? <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
                  <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                    {blueprints.map((b) => (
                      <button key={b.id} type="button" onClick={() => chooseBlueprint(b)}
                        className="flex items-center gap-2 rounded-lg border border-border p-2 text-left hover:border-primary/50 hover:bg-primary/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {b.image ? <img src={b.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" /> : <div className="h-12 w-12 shrink-0 rounded bg-muted" />}
                        <span className="min-w-0"><span className="line-clamp-2 text-xs font-medium text-foreground">{b.title}</span><span className="block truncate text-[11px] text-muted-foreground">{b.brand} {b.model}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <span className="text-sm font-medium text-foreground">{bp.title}</span>
                  <Button variant="ghost" size="sm" onClick={() => setBp(null)}>Change</Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block">2. Print provider</Label>
                    <Select value={providerId} onValueChange={setProviderId}>
                      <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                      <SelectContent>{providers.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.title}{p.location ? ` (${p.location})` : ''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Print area</Label>
                    <Select value={position} onValueChange={setPosition}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{positions.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {allColors.length > 0 && (
                  <div>
                    <Label className="mb-1.5 block">3. Colours ({colors.size})</Label>
                    <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                      {allColors.map((c) => (
                        <button key={c} type="button" onClick={() => toggle(colors, setColors, c)}
                          className={cn('rounded-full border px-2.5 py-1 text-xs', colors.has(c) ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{c}</button>
                      ))}
                    </div>
                  </div>
                )}
                {allSizes.length > 0 && (
                  <div>
                    <Label className="mb-1.5 block">Sizes ({sizes.size})</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {allSizes.map((s) => (
                        <button key={s} type="button" onClick={() => toggle(sizes, setSizes, s)}
                          className={cn('rounded-full border px-2.5 py-1 text-xs', sizes.has(s) ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{chosen.length} variant{chosen.length === 1 ? '' : 's'} selected{chosen.length > 100 ? ' — only the first 100 are sent' : ''}.</p>

                <div>
                  <Label className="mb-1.5 block">Design size: {Math.round(scale * 100)}% of the print area width</Label>
                  <input type="range" min={0.3} max={1} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>4. Listing</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={writeWithAi} disabled={writing}>
                      {writing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Write with AI
                    </Button>
                  </div>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} />
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Description (optional)" />
                  {tags.length > 0 && <p className="text-xs text-muted-foreground">Tags: {tags.join(', ')}</p>}
                  <div className="w-40">
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Price (your Printify currency)</Label>
                    <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={importToStore} onCheckedChange={(v) => setImportToStore(!!v)} /> Also sell it in my ExiusCart store (orders go to Printify automatically)</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={publish} onCheckedChange={(v) => setPublish(!!v)} /> Publish to the store connected in my Printify account (e.g. Etsy)</label>
                </div>

                {error && <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={close}>Cancel</Button>
                  <Button onClick={send} disabled={sending || !providerId || chosen.length === 0 || !title.trim() || !(parseFloat(price) > 0)}>
                    {sending && <Loader2 className="h-4 w-4 animate-spin" />} Create on Printify
                  </Button>
                </div>
              </>
            )}
            {!bp && error && <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>}
          </div>
        )}
      </>
  );
}
