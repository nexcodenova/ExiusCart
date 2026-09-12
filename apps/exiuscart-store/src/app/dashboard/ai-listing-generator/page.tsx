'use client';

import { FileEdit } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={FileEdit}
      group="AI Commerce"
      title="AI Listing Generator"
      description="AI-written listing copy tailored per sales channel. Not built yet."
      accentClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
    />
  );
}
