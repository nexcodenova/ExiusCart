'use client';

import { History } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={History}
      group="AI Commerce"
      title="AI Activity"
      description="A log of every AI action taken on your store. Not built yet."
      accentClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
    />
  );
}
