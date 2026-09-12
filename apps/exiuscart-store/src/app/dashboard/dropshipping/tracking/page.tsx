'use client';

import { MapPinned } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={MapPinned}
      group="Fulfillment"
      title="Supplier Tracking"
      description="A dedicated board for tracking numbers and shipment status across every dropship supplier. Not built yet — tracking numbers are currently shown per-order in Supplier Orders."
      accentClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
    />
  );
}
