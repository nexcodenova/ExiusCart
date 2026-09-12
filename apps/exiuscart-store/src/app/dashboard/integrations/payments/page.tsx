'use client';

import { CreditCard } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={CreditCard}
      group="Integrations"
      title="Payment Integrations"
      description="Connect and manage payment gateways store-wide. Not built yet — payment credentials exist today per Custom Website connection."
      accentClass="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
    />
  );
}
