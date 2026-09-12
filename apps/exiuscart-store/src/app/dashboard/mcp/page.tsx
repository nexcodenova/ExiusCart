'use client';

import { Network } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Network}
      group="MCP & AI Connections"
      title="MCP Overview"
      description="Connect AI assistants like Claude and ChatGPT to your store through the Model Context Protocol. Not built yet."
      accentClass="bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
    />
  );
}
