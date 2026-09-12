'use client';

import { Users } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Users}
      group="Analytics"
      title="Customer Analytics"
      description="Cohort and lifetime-value analytics for your customers. Not built yet."
      accentClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
    />
  );
}
