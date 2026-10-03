'use client';

// Shared page for Product Studio's AI image tools (AI Product Images,
// Lifestyle Images, Mockup Studio): pick a product, then make images from
// its own photos with the modes that page is about.

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { imagesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProductPicker, { PickedProduct } from './ProductPicker';
import StudioHeader, { StudioStep } from './StudioHeader';
import AiImageStudio, { ImageMode } from './AiImageStudio';

export default function ImageStudioPage({ title, subtitle, icon: Icon, modes, tips, banner, steps }: {
  banner?: { title: string; description: string };
  steps?: StudioStep[];
  title: string;
  subtitle: string;
  icon: LucideIcon;
  modes: ImageMode[];
  tips: string[];
}) {
  const [shopId, setShopId] = useState('');
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);

  const loadPhotos = (p: PickedProduct | null) => {
    if (!p || !shopId) { setPhotos([]); return; }
    imagesApi.getAll(shopId, String(p.id))
      .then((r) => {
        const urls = (r.data ?? []).map((i: { url: string }) => i.url);
        setPhotos(urls.length ? urls : (p.image_url ? [p.image_url] : []));
      })
      .catch(() => setPhotos(p.image_url ? [p.image_url] : []));
  };

  useEffect(() => { loadPhotos(product); }, [product, shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <StudioHeader icon={Icon} title={title} subtitle={subtitle} banner={banner} steps={steps} bannerVariant={0} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">1. Choose a product</CardTitle></CardHeader>
            <CardContent>{shopId && <ProductPicker shopId={shopId} value={product} onChange={setProduct} />}</CardContent>
          </Card>
          {product && (
            <Card>
              <CardHeader><CardTitle className="text-base">2. Create</CardTitle></CardHeader>
              <CardContent>
                <AiImageStudio shopId={shopId} productId={product.id} photos={photos} modes={modes} onImageAdded={() => loadPhotos(product)} />
              </CardContent>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Tips for good results</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">
              {tips.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
