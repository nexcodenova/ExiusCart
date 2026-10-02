'use client';

// AI Studio inside the product editor: copy & SEO (fills the form — the
// normal Save keeps it) and AI images. The same two parts power the AI
// Commerce and Product Studio sidebar pages.

import { Sparkles, ImagePlus } from 'lucide-react';
import { aiStudioApi } from '@/lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AiCopyStudio, { AiCopy } from './AiCopyStudio';
import AiImageStudio from './AiImageStudio';

export type { AiCopy };

export default function AiStudioPanel({ shopId, productId, photos, onApply, onImageAdded }: {
  shopId: string;
  productId?: string | number | null;
  productName: string;
  photos: string[];
  onApply: (copy: AiCopy) => void;
  onImageAdded: () => void;
}) {
  if (!productId) {
    return <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2.5">Save the product first, then come back here to improve it with AI.</p>;
  }
  return (
    <Tabs defaultValue="copy" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="copy"><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Improve copy &amp; SEO</TabsTrigger>
        <TabsTrigger value="images"><ImagePlus className="w-3.5 h-3.5 mr-1.5" /> AI images</TabsTrigger>
      </TabsList>
      <TabsContent value="copy" className="pt-2">
        <AiCopyStudio
          load={async () => (await aiStudioApi.improve(shopId, productId)).data}
          onApply={onApply}
          applyLabel="Use"
          appliedNote="Filled into the form. Click Save to keep the changes."
        />
      </TabsContent>
      <TabsContent value="images" className="pt-2">
        <AiImageStudio shopId={shopId} productId={productId} photos={photos} onImageAdded={onImageAdded} />
      </TabsContent>
    </Tabs>
  );
}
