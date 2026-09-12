'use client';

import { Link2 } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Link2}
      group="Analytics"
      title="Channel Analytics"
      description="Per-channel performance analytics beyond what Reports covers today. Not built yet."
      accentClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
    />
  );
}
