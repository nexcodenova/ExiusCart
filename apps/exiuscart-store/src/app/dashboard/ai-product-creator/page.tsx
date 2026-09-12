'use client';

import { Wand2 } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Wand2}
      group="AI Commerce"
      title="AI Product Creator"
      description="Generate full product listings — titles, descriptions, images — from a short prompt. Not built yet."
      accentClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
    />
  );
}
