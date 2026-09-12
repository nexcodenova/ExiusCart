'use client';

import { Users2 } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Users2}
      group="Marketing"
      title="Customer Segments"
      description="Build reusable customer segments to target in campaigns. Not built yet."
      accentClass="bg-purple-500/10 text-purple-600 dark:text-purple-400"
    />
  );
}
