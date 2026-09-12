'use client';

import { Megaphone } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Megaphone}
      group="Marketing"
      title="Ads"
      description="Manage Google, Meta and other ad campaigns from ExiusCart. Not built yet — a Meta Ads Library lookup is available today inside Lead Management."
      accentClass="bg-purple-500/10 text-purple-600 dark:text-purple-400"
    />
  );
}
