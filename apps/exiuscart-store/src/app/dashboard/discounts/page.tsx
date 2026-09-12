'use client';

import { Percent } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Percent}
      group="Commerce"
      title="Discounts"
      description="Create and manage discount codes and automatic promotions across your storefront and channels. Not built yet."
      accentClass="bg-pink-500/10 text-pink-600 dark:text-pink-400"
    />
  );
}
