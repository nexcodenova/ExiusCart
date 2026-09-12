'use client';

import { Package } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Package}
      group="Analytics"
      title="Product Analytics"
      description="Per-product performance analytics. Not built yet."
      accentClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
    />
  );
}
