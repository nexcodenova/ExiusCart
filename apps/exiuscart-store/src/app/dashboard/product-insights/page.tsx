'use client';

// Product Insights (AI Commerce): pick a product, see its research links, market
// check (Prodora imports) and "Who to target".

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProductPicker, { PickedProduct } from '@/components/ai-studio/ProductPicker';
import ProductInsightsPanel from '@/components/ai-studio/ProductInsightsPanel';
import { productsApi } from '@/lib/api';

function Insights() {
  const params = useSearchParams();
  const [shopId, setShopId] = useState('');
  const [product, setProduct] = useState<PickedProduct | null>(null);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);
  useEffect(() => {
    const id = Number(params.get('product'));
    if (!shopId || !id) return;
    productsApi.getAll(shopId).then((r) => { const p = (r.data ?? []).find((x: PickedProduct) => x.id === id); if (p) setProduct(p); }).catch(() => {});
  }, [shopId, params]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Lightbulb className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Product Insights</h1>
          <p className="text-sm text-muted-foreground">Google Trends, Amazon, eBay, TikTok and Meta ads research for any product, plus who to target with your ads.</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Choose a product</CardTitle></CardHeader>
        <CardContent>{shopId && <ProductPicker shopId={shopId} value={product} onChange={setProduct} />}</CardContent>
      </Card>
      {product && <ProductInsightsPanel key={product.id} shopId={shopId} productId={product.id} />}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><Insights /></Suspense>;
}
