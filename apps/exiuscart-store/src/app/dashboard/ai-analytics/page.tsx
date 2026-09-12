'use client';

import { LineChart } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={LineChart}
      group="AI Commerce"
      title="AI Analytics"
      description="AI-summarized insights and recommendations from your store data. Not built yet."
      accentClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
    />
  );
}
