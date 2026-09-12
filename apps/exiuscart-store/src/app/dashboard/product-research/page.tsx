'use client';

import { Search } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Search}
      group="Product Sourcing"
      title="Product Research"
      description="Trend and demand research to help you decide what to source next. Not built yet."
      accentClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
    />
  );
}
