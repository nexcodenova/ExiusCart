'use client';

import { Bot } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Bot}
      group="AI Commerce"
      title="AI Assistant"
      description="A conversational assistant for managing your store. Not built yet."
      accentClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
    />
  );
}
