'use client';

import { Truck } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Truck}
      group="Analytics"
      title="Fulfillment Analytics"
      description="Delivery-time and fulfillment-performance analytics. Not built yet."
      accentClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
    />
  );
}
