'use client';

import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import AssetLibrary from '@/components/ai-studio/AssetLibrary';

export default function Page() {
  const [shopId, setShopId] = useState('');
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderOpen className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Designs</h1>
          <p className="text-sm text-muted-foreground">Your print designs, made with AI or uploaded. Turn any of them into mockups in one click.</p>
        </div>
      </div>
      {shopId && <AssetLibrary shopId={shopId} fixedKind="design" uploadKind="design" />}
    </div>
  );
}
