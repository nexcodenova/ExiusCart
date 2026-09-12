'use client';

import { Megaphone } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Megaphone}
      group="Marketing"
      title="Marketing Overview"
      description="A unified summary across every marketing channel. Not built yet — each channel (Email, SMS, WhatsApp, Social, etc.) has its own real page today."
      accentClass="bg-purple-500/10 text-purple-600 dark:text-purple-400"
    />
  );
}
