'use client';

import { Megaphone } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Megaphone}
      group="Analytics"
      title="Marketing Analytics"
      description="Attribution and campaign-performance analytics. Not built yet."
      accentClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
    />
  );
}
