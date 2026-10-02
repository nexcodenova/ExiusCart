'use client';

import { Image } from 'lucide-react';
import ImageStudioPage from '@/components/ai-studio/ImageStudioPage';

export default function Page() {
  return (
    <ImageStudioPage
      icon={Image}
      title="AI Product Images"
      subtitle="Turn any product photo into a clean studio shot or a ready-to-post ad image."
      modes={['studio', 'ad']}
      tips={[
        'Start from your clearest photo, with the whole product in view.',
        'Studio photo gives a pure white background, which marketplaces like Amazon and eBay prefer.',
        'Ad image adds a short headline. Use "Extra direction" to say what it should say.',
        'Always check logos and text look right before adding the image.',
      ]}
    />
  );
}
