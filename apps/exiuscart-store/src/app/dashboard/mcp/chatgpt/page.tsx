'use client';

import { Bot } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Bot}
      group="MCP & AI Connections"
      title="ChatGPT"
      description="Connect ChatGPT to your store data and actions. Not built yet."
      accentClass="bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
    />
  );
}
