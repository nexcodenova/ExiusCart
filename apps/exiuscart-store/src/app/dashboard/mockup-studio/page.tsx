'use client';

import { Layers } from 'lucide-react';
import ImageStudioPage from '@/components/ai-studio/ImageStudioPage';

export default function Page() {
  return (
    <ImageStudioPage
      icon={Layers}
      title="Mockup Studio"
      subtitle="Put your t-shirts, hoodies and other clothing on a real-looking model, from a flat product photo."
      modes={['model']}
      tips={[
        'Start from a flat, front-facing photo of the garment with the print clearly visible.',
        'Describe the model you want: "man, 30s, smart casual", "woman, 20s, street style".',
        'Check the print and logo match your real product before using the photo.',
        'Make a few with different models to show who it is for.',
      ]}
    />
  );
}
