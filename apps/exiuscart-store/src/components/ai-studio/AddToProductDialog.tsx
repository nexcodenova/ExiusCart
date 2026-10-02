'use client';

// Put a Brand Assets image (mockup, design, AI image) onto one of the shop's products.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { studioApi, StudioAsset } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ProductPicker, { PickedProduct } from './ProductPicker';
import { aiErrorText } from './AiCopyStudio';

export default function AddToProductDialog({ shopId, asset, onClose }: {
  shopId: string;
  asset: StudioAsset | null;
  onClose: () => void;
}) {
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const close = () => { setProduct(null); setMsg(''); setErr(''); onClose(); };

  const add = async (primary: boolean) => {
    if (!asset || !product) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await studioApi.addToProduct(shopId, asset.id, product.id, primary);
      setMsg(r.data?.added === false ? r.data.message : primary ? `Now the main photo of "${product.name}".` : `Added to "${product.name}".`);
    } catch (e: any) {
      setErr(aiErrorText(e, 'Could not add the image.'));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!asset} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Add to a product</DialogTitle></DialogHeader>
        {asset && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />
              <p className="text-sm text-muted-foreground">{asset.title ?? 'Image'}</p>
            </div>
            <ProductPicker shopId={shopId} value={product} onChange={setProduct} />
            {err && <p className="text-sm text-amber-700 dark:text-amber-400">{err}</p>}
            {msg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => add(false)} disabled={!product || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Add to photos</Button>
              <Button onClick={() => add(true)} disabled={!product || busy}>Make main photo</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
