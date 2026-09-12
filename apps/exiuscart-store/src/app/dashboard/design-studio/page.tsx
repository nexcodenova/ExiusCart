'use client';

import { Palette } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Palette}
      group="Product Studio"
      title="Design Studio"
      description="A visual editor for product graphics and storefront creative. Not built yet."
      accentClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
    />
  );
}
