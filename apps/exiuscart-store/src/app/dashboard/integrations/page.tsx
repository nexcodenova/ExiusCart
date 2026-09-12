'use client';

import { Plug } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Plug}
      group="Integrations"
      title="All Integrations"
      description="A single directory of every connection ExiusCart supports. Not built yet as a unified hub — Sales Channels and Dropship Suppliers each already have their own real directory today."
      accentClass="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
    />
  );
}
