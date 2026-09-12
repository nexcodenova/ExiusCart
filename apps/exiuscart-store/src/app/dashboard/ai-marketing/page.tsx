'use client';

import { Megaphone } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Megaphone}
      group="AI Commerce"
      title="AI Marketing"
      description="AI-generated campaigns and marketing copy. Not built yet — AI SEO Tools and AI Product Videos are already available under Marketing today."
      accentClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
    />
  );
}
