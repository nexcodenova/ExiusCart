'use client';

import { Undo2 } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Undo2}
      group="Fulfillment"
      title="Supplier Returns"
      description="Manage return requests and refunds with your dropship suppliers. Not built yet."
      accentClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
    />
  );
}
