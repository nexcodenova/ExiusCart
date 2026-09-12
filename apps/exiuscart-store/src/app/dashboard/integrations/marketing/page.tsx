'use client';

import { Megaphone } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Megaphone}
      group="Integrations"
      title="Marketing Integrations"
      description="Connect third-party marketing tools (email/SMS providers, ad platforms) beyond what's built in today. Not built yet."
      accentClass="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
    />
  );
}
