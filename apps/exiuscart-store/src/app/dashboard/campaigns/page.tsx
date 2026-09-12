'use client';

import { Rocket } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Rocket}
      group="Marketing"
      title="Campaigns"
      description="Plan and schedule multi-channel marketing campaigns. Not built yet."
      accentClass="bg-purple-500/10 text-purple-600 dark:text-purple-400"
    />
  );
}
