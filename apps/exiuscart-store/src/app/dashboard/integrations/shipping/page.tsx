'use client';

import { Truck } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Truck}
      group="Integrations"
      title="Shipping Integrations"
      description="Connect shipping carriers and rate providers. Not built yet."
      accentClass="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
    />
  );
}
