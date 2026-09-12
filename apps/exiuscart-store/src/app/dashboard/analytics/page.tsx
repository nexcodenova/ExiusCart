'use client';

import { BarChart3 } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={BarChart3}
      group="Analytics"
      title="Analytics Overview"
      description="A single cross-channel summary of your store’s performance. Not built yet — Sales and Profitability breakdowns already exist today under Finance → Reports."
      accentClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
    />
  );
}
