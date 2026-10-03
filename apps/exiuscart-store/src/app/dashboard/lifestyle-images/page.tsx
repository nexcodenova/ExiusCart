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
      banner={{ title: 'Your product, in your buyer’s world', description: 'Show the product where it is used: a modern kitchen, a desk, a beach at sunset. The kind of photo that sells on social media.' }}
      steps={[
        { title: 'Pick a product', body: 'A plain, clear photo works best as the start.' },
        { title: 'Describe the place', body: 'Where your buyer would use it, e.g. "cosy reading corner".' },
        { title: 'Keep the best', body: 'Make two or three and add the most real one.' },
      ]}
      tips={[
        'Say where it should be: "modern kitchen", "beach at sunset", "office desk".',
        'Pick a setting your buyer lives in, not just a pretty one.',
        'A plain product photo works best as the starting point.',
        'Make two or three and keep the one that looks most real.',
      ]}
    />
  );
}
