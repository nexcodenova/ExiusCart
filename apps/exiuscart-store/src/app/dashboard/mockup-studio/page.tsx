'use client';

import { Layers } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Layers}
      group="Product Studio"
      title="Mockup Studio"
      description="Generate realistic product mockups on apparel, packaging and more. Not built yet."
      accentClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
    />
  );
}
