'use client';

// Design -> Printful product (and Printful's own free mockups). Backend: pod_push.py.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, CheckCircle2, AlertCircle, ImageIcon as Images } from 'lucide-react';
import { podApi, StudioAsset } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { aiErrorText } from './AiCopyStudio';

type CatalogItem = { id: number; title: string; type?: string; brand?: string; model?: string; image?: string | null };
type Variant = { id: number; color: string | null; size: string | null };

export function PrintfulPanel({ shopId, asset, onClose }: { shopId: string; asset: StudioAsset | null; onClose: () => void }) {
  const [q, setQ] = useState('t-shirt');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [colorHex, setColorHex] = useState<Record<string, string | null>>({});
  const [placements, setPlacements] = useState<{ key: string; label: string }[]>([]);
  const [placement, setPlacement] = useState('front');
  const [colors, setColors] = useState<Set<string>>(new Set());
  const [sizes, setSizes] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(0.8);
  const [title, setTitle] = useState(asset?.title ?? '');
  const [price, setPrice] = useState('24.99');
  const [importToStore, setImportToStore] = useState(true);
  const [makeMockups, setMakeMockups] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'' | 'create' | 'mockups'>('');
  const [error, setError] = useState('');
  const [notConnected, setNotConnected] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [mockups, setMockups] = useState<{ id: number; url: string }[]>([]);

  useEffect(() => { setTitle(asset?.title ?? ''); setDone(null); setMockups([]); setItem(null); setError(''); }, [asset]);

  useEffect(() => {
    if (!asset || item) return;
    setLoading(true);
    const t = setTimeout(() => {
      podApi.printfulCatalog(shopId, q.trim())
        .then((r) => { setItems(r.data.products ?? []); setError(''); })
        .catch((e) => {
          if (e?.response?.data?.detail?.error === 'printful_not_connected') setNotConnected(true);
          else setError(aiErrorText(e, 'Could not load the Printful catalogue.'));
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [asset, q, item, shopId]);

  const choose = async (c: CatalogItem) => {
    setItem(c); setVariants([]); setError('');
    try {
      const r = await podApi.printfulOptions(shopId, c.id);
      setVariants(r.data.variants ?? []);
      setColorHex(Object.fromEntries((r.data.colors ?? []).map((x: { name: string; hex: string | null }) => [x.name, x.hex])));
      setPlacements(r.data.placements ?? []);
      setPlacement(r.data.placements?.[0]?.key ?? 'front');
      setColors(new Set((r.data.colors ?? []).slice(0, 1).map((x: { name: string }) => x.name)));
      setSizes(new Set(r.data.sizes ?? []));
    } catch (e: any) { setError(aiErrorText(e, 'Could not load colours and sizes.')); }
  };

  const allColors = useMemo(() => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[], [variants]);
  const allSizes = useMemo(() => Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[], [variants]);
  const chosen = variants.filter((v) => (!v.color || colors.has(v.color)) && (!v.size || sizes.has(v.size)));
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => { const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); setter(n); };

  // One mockup per colour is enough to show the design
  const oneVariantPerColor = () => {
    const seen = new Set<string>(); const ids: number[] = [];
    for (const v of chosen) { const k = v.color ?? ''; if (!seen.has(k)) { seen.add(k); ids.push(v.id); } }
    return ids.slice(0, 10);
  };

  const mockupsOnly = async () => {
    if (!asset || !item) return;
    setBusy('mockups'); setError('');
    try {
      const r = await podApi.printfulMockups(shopId, asset.id, { catalog_product_id: item.id, variant_ids: oneVariantPerColor(), placement, scale });
      if (r.data.status === 'completed') setMockups(r.data.assets ?? []);
      else setError(r.data.message ?? 'Printful could not make the mockups.');
    } catch (e: any) { setError(aiErrorText(e, 'Printful could not make the mockups.')); } finally { setBusy(''); }
  };

  const create = async () => {
    if (!asset || !item) return;
    setBusy('create'); setError('');
    try {
      const r = await podApi.sendToPrintful(shopId, asset.id, {
        catalog_product_id: item.id, variant_ids: chosen.map((v) => v.id), price: parseFloat(price), title: title.trim(),
        placement, scale, import_to_store: importToStore, make_mockups: makeMockups,
      });
      setDone(r.data);
      if (r.data.mockups?.assets) setMockups(r.data.mockups.assets);
    } catch (e: any) { setError(aiErrorText(e, 'Printful could not create the product.')); } finally { setBusy(''); }
  };

  if (notConnected) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Connect your Printful account first. Products and orders stay in your own Printful account.</p>
        <Button asChild><Link href="/dashboard/dropshipping">Connect Printful</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {done && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Created in Printful (product {done.printful_product_id}).</p>
            {done.store_product?.product_id && <p className="text-muted-foreground">Also in your ExiusCart store — orders go to Printful by themselves when auto-fulfil is on. <Link className="text-primary hover:underline" href={`/dashboard/products?edit=${done.store_product.product_id}`}>Open</Link></p>}
            {done.store_product?.error && <p className="text-amber-700 dark:text-amber-400">Not added to your store: {done.store_product.error}</p>}
            {done.mockups && done.mockups.status !== 'completed' && <p className="text-muted-foreground">{done.mockups.message}</p>}
          </div>
        </div>
      )}

      {!item ? (
        <div className="space-y-2">
          <Label>1. Product</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" placeholder="t-shirt, hoodie, mug, poster…" />
          </div>
          {loading ? <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
            <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {items.map((c) => (
                <button key={c.id} type="button" onClick={() => choose(c)} className="flex items-center gap-2 rounded-lg border border-border p-2 text-left hover:border-primary/50 hover:bg-primary/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.image ? <img src={c.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" /> : <div className="h-12 w-12 shrink-0 rounded bg-muted" />}
                  <span className="min-w-0"><span className="line-clamp-2 text-xs font-medium text-foreground">{c.title}</span><span className="block truncate text-[11px] text-muted-foreground">{c.type}</span></span>
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
            <span className="text-sm font-medium text-foreground">{item.title}</span>
            <Button variant="ghost" size="sm" onClick={() => setItem(null)}>Change</Button>
          </div>
          {placements.length > 1 && (
            <div className="w-56">
              <Label className="mb-1.5 block">Print area</Label>
              <Select value={placement} onValueChange={setPlacement}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{placements.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {allColors.length > 0 && (
            <div>
              <Label className="mb-1.5 block">2. Colours ({colors.size})</Label>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {allColors.map((c) => (
                  <button key={c} type="button" onClick={() => toggle(colors, setColors, c)}
                    className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', colors.has(c) ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>
                    {colorHex[c] && <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: colorHex[c] ?? undefined }} />}{c}
                  </button>
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
          <p className="text-xs text-muted-foreground">{chosen.length} variant{chosen.length === 1 ? '' : 's'} selected.</p>
          <div>
            <Label className="mb-1.5 block">Design size: {Math.round(scale * 100)}% of the print area width</Label>
            <input type="range" min={0.3} max={1} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={mockupsOnly} disabled={!!busy || chosen.length === 0}>
              {busy === 'mockups' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />} Free Printful mockups only
            </Button>
            <span className="text-xs text-muted-foreground">Real photos from Printful. Not counted as AI images.</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <div><Label className="mb-1.5 block">3. Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></div>
            <div><Label className="mb-1.5 block">Price</Label><Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={importToStore} onCheckedChange={(v) => setImportToStore(!!v)} /> Also sell it in my ExiusCart store (orders go to Printful automatically)</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={makeMockups} onCheckedChange={(v) => setMakeMockups(!!v)} /> Make Printful mockups and save them to Brand Assets</label>
          </div>

          {error && <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={create} disabled={!!busy || chosen.length === 0 || !title.trim() || !(parseFloat(price) > 0)}>
              {busy === 'create' && <Loader2 className="h-4 w-4 animate-spin" />} Create in Printful
            </Button>
          </div>
        </>
      )}

      {mockups.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Printful mockups (saved to Brand Assets)</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {mockups.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="aspect-square w-full rounded-md border border-border object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
