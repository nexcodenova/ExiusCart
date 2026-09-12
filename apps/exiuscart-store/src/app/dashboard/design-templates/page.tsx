'use client';

import { LayoutTemplate } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={LayoutTemplate}
      group="Product Studio"
      title="Templates"
      description="Reusable design templates for listings, ads and social posts. Not built yet."
      accentClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
    />
  );
}
