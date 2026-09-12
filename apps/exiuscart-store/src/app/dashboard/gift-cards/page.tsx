'use client';

import { Gift } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Gift}
      group="Commerce"
      title="Gift Cards"
      description="Sell and redeem gift cards across your storefront and connected channels. Not built yet."
      accentClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
    />
  );
}
