'use client';

import { ImagePlus } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={ImagePlus}
      group="Product Studio"
      title="Lifestyle Images"
      description="Place your products into AI-generated lifestyle scenes. Not built yet."
      accentClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
    />
  );
}
