'use client';

import { Image } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Image}
      group="Product Studio"
      title="AI Product Images"
      description="Generate studio-quality product photography with AI. Not built yet."
      accentClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
    />
  );
}
