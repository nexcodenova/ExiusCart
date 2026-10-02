'use client';

// Brand Assets library grid: designs, mockups, AI product images, uploads and
// product photos (Prodora imports included). Used by Brand Assets (all) and
// My Designs (designs only).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Upload, Download, Trash2, Shirt, ImagePlus, Loader2, PackagePlus, FolderOpen } from 'lucide-react';
import { studioApi, StudioAsset } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog';
import AddToProductDialog from './AddToProductDialog';
import SendToPodDialog from './SendToPodDialog';
import ProductPicker, { PickedProduct } from './ProductPicker';
import { aiErrorText } from './AiCopyStudio';

const TABS = [
  { key: '', label: 'All' },
  { key: 'design', label: 'Designs' },
  { key: 'mockup', label: 'Mockups' },
  { key: 'image', label: 'Product images' },
  { key: 'upload', label: 'Uploads' },
];

const SOURCE_LABEL: Record<string, string> = { ai: 'AI', upload: 'Uploaded', product: 'From product', prodora: 'Prodora' };

// Transparent PNG designs read better on a checkerboard
export const CHECKER = 'bg-[length:16px_16px] bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%),linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%)] [background-position:0_0,8px_8px]';

export default function AssetLibrary({ shopId, fixedKind, uploadKind = 'upload' }: {
  shopId: string;
  fixedKind?: 'design';
  uploadKind?: 'design' | 'upload';
}) {
  const [tab, setTab] = useState(fixedKind ?? '');
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<StudioAsset | null>(null);
  const [toPrintify, setToPrintify] = useState<StudioAsset | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const kindParam = fixedKind ? 'design' : tab || undefined;

  const load = useCallback(() => {
    if (!shopId) return;
    setLoading(true);
    studioApi.assets(shopId, kindParam)
      .then((r) => { setAssets(r.data.assets ?? []); setTotal(r.data.total ?? 0); })
      .catch((e) => setError(aiErrorText(e, 'Could not load your assets.')))
      .finally(() => setLoading(false));
  }, [shopId, kindParam]);

  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setError('');
    try {
      for (const f of Array.from(files).slice(0, 10)) await studioApi.upload(shopId, f, uploadKind);
      load();
    } catch (e: any) {
      setError(aiErrorText(e, 'Upload failed.'));
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const remove = async (a: StudioAsset) => {
    if (!(await confirm({ title: 'Remove this from your library?', description: 'Products already using it keep their photo.', variant: 'destructive' }))) return;
    await studioApi.remove(shopId, a.id).catch(() => {});
    setAssets((prev) => prev.filter((x) => x.id !== a.id));
    setTotal((t) => Math.max(0, t - 1));
  };

  const importProduct = async (p: PickedProduct | null) => {
    if (!p) return;
    setImportMsg('');
    try {
      const r = await studioApi.importProduct(shopId, p.id);
      setImportMsg(r.data.added ? `Added ${r.data.added} photo${r.data.added === 1 ? '' : 's'} from "${p.name}".` : `Photos of "${p.name}" are already in your library.`);
      load();
    } catch (e: any) {
      setImportMsg(aiErrorText(e, 'Could not import the photos.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {fixedKind ? <p className="text-sm text-muted-foreground">{total} design{total === 1 ? '' : 's'}</p> : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap h-auto">
              {TABS.map((t) => <TabsTrigger key={t.key || 'all'} value={t.key}>{t.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/dashboard/design-studio"><ImagePlus className="h-4 w-4" /> New design</Link></Button>
          {!fixedKind && <Button variant="outline" onClick={() => { setImportMsg(''); setImportOpen(true); }}><PackagePlus className="h-4 w-4" /> Import product photos</Button>}
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload {uploadKind === 'design' ? 'design' : 'images'}
          </Button>
          <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files)} />
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
      ) : assets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-foreground">Nothing here yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Designs from Design Studio, mockups from Mockup Studio and AI product images are saved here automatically. You can also upload your own or import product photos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {assets.map((a) => (
            <div key={a.id} className="group overflow-hidden rounded-xl border border-border bg-card">
              <div className={cn('relative aspect-square', a.kind === 'design' ? CHECKER : 'bg-muted')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.title ?? ''} className={cn('h-full w-full', a.kind === 'design' ? 'object-contain p-2' : 'object-cover')} loading="lazy" />
                <Badge variant="muted" className="absolute left-2 top-2 capitalize">{a.kind === 'image' ? 'Product image' : a.kind}</Badge>
              </div>
              <div className="space-y-2 p-2.5">
                <p className="truncate text-xs text-foreground" title={a.title ?? ''}>{a.title ?? 'Untitled'}</p>
                <p className="text-[11px] text-muted-foreground">{SOURCE_LABEL[a.source] ?? a.source}{a.created_at ? ` · ${new Date(a.created_at).toLocaleDateString()}` : ''}</p>
                <div className="flex flex-wrap gap-1">
                  {(a.kind === 'design' || a.kind === 'upload') && (
                    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs"><Link href={`/dashboard/mockup-studio?design=${a.id}`}><Shirt className="h-3.5 w-3.5" /> Mockups</Link></Button>
                  )}
                  {(a.kind === 'design' || a.kind === 'upload') && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setToPrintify(a)}>Sell on POD</Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAdding(a)}><PackagePlus className="h-3.5 w-3.5" /> Product</Button>
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2" title="Open full size"><a href={a.url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /></a></Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive" title="Remove" onClick={() => remove(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddToProductDialog shopId={shopId} asset={adding} onClose={() => setAdding(null)} />
      <SendToPodDialog shopId={shopId} asset={toPrintify} onClose={() => setToPrintify(null)} />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import product photos</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Bring a product&apos;s photos into your library, including products you imported from Prodora.</p>
          <ProductPicker shopId={shopId} value={null} onChange={importProduct} />
          {importMsg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{importMsg}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
