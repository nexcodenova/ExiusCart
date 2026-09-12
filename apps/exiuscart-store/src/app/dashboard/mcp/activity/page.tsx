'use client';

import { FileClock } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={FileClock}
      group="MCP & AI Connections"
      title="Activity Logs"
      description="An audit trail of every action taken by a connected AI assistant. Not built yet."
      accentClass="bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
    />
  );
}
