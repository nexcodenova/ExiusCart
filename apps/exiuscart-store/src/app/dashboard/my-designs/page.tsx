'use client';

import { FolderOpen } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={FolderOpen}
      group="Product Studio"
      title="My Designs"
      description="Your saved designs and creative assets in one place. Not built yet."
      accentClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
    />
  );
}
