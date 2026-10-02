'use client';

import { ImagePlus } from 'lucide-react';
import ImageStudioPage from '@/components/ai-studio/ImageStudioPage';

export default function Page() {
  return (
    <ImageStudioPage
      icon={ImagePlus}
      title="Lifestyle Images"
      subtitle="Show your product in a real setting, the kind of photo that sells on social media."
      modes={['lifestyle']}
      tips={[
        'Say where it should be: "modern kitchen", "beach at sunset", "office desk".',
        'Pick a setting your buyer lives in, not just a pretty one.',
        'A plain product photo works best as the starting point.',
        'Make two or three and keep the one that looks most real.',
      ]}
    />
  );
}
