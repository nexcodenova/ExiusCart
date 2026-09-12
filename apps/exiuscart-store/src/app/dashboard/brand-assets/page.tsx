'use client';

import { Shapes } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Shapes}
      group="Product Studio"
      title="Brand Assets"
      description="Store your logo, colors and brand guidelines for reuse across tools. Not built yet."
      accentClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
    />
  );
}
