'use client';

// AI Listing Generator: pick a product, get a better title, description,
// Google title/description, highlights, FAQ and SEO keywords, tick what to
// keep, save it straight to the product.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileEdit, ExternalLink } from 'lucide-react';
import { aiStudioApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ProductPicker, { PickedProduct } from '@/components/ai-studio/ProductPicker';
import AiCopyStudio, { AiCopy } from '@/components/ai-studio/AiCopyStudio';

export default function Page() {
  const [shopId, setShopId] = useState('');
  const [product, setProduct] = useState<PickedProduct | null>(null);
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);

  const save = async (c: AiCopy) => {
    if (!product) return;
    await aiStudioApi.apply(shopId, product.id, c);
    if (c.title) setProduct({ ...product, name: c.title });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileEdit className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Listing Generator</h1>
          <p className="text-sm text-muted-foreground">Rewrite a product listing so it ranks on Google and sells, using what shoppers really search for.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">1. Choose a product</CardTitle></CardHeader>
            <CardContent>{shopId && <ProductPicker shopId={shopId} value={product} onChange={setProduct} />}</CardContent>
          </Card>
          {product && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">2. Improve it</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/dashboard/products?edit=${product.id}`}><ExternalLink className="h-3.5 w-3.5" /> Open product</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <AiCopyStudio
                  key={product.id}
                  load={async () => (await aiStudioApi.improve(shopId, product.id)).data}
                  onApply={save}
                  startLabel="Write a better listing"
                  applyLabel="Save"
                  appliedNote="Saved to the product."
                />
              </CardContent>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">What it does</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">
              <li>Finds the keywords shoppers type on Google for this product.</li>
              <li>Writes the title, description, Google result, 5 highlights and an FAQ around them.</li>
              <li>Only uses facts from your product. It never invents specs or reviews.</li>
              <li>You see before and after, and save only what you tick.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
