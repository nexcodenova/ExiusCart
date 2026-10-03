'use client';

import StudioHeader, { UsagePill } from '@/components/ai-studio/StudioHeader';
import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import AssetLibrary from '@/components/ai-studio/AssetLibrary';

export default function Page() {
  const [shopId, setShopId] = useState('');
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);
  return (
    <div className="space-y-6">
      <StudioHeader icon={FolderOpen} title="My Designs" subtitle="Every print design you made with AI or uploaded, ready to turn into mockups."
        banner={{ title: 'Your design library', description: 'All your artwork in one place. Open any design in Mockup Studio, or send it to Printify, Printful or Gelato.' }} bannerVariant={1}
        steps={[{ title: 'Make or upload', body: 'Create with Design Studio, or upload a PNG.' }, { title: 'Mock it up', body: 'Open it in Mockup Studio for model and flat-lay photos.' }, { title: 'Sell it', body: 'Send it to a print-on-demand supplier or add it to a product.' }]} />
      {shopId && <AssetLibrary shopId={shopId} fixedKind="design" uploadKind="design" />}
    </div>
  );
}
