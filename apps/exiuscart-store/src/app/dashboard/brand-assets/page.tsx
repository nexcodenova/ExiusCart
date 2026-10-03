'use client';

import StudioHeader, { UsagePill } from '@/components/ai-studio/StudioHeader';
import { useEffect, useState } from 'react';
import { Shapes } from 'lucide-react';
import AssetLibrary from '@/components/ai-studio/AssetLibrary';

export default function Page() {
  const [shopId, setShopId] = useState('');
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);
  return (
    <div className="space-y-6">
      <StudioHeader icon={Shapes} title="Brand Assets" subtitle="Every design, mockup, AI image and upload in one place, ready to reuse."
        banner={{ title: 'One home for every visual', description: 'Designs, mockups, AI product photos and your uploads, sorted and searchable. Reuse them on products, ads, Printify or Etsy.' }} bannerVariant={0}
        steps={[{ title: 'Everything lands here', body: 'Each design, mockup and AI image is saved automatically.' }, { title: 'Find it fast', body: 'Filter by type and search by name.' }, { title: 'Reuse it', body: 'Add to a product, download, or send to print on demand.' }]} />
      {shopId && <AssetLibrary shopId={shopId} />}
    </div>
  );
}
