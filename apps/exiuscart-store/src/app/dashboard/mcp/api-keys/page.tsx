'use client';

import { KeyRound } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={KeyRound}
      group="MCP & AI Connections"
      title="API Keys"
      description="Generate and manage API keys for AI and developer access. Not built yet."
      accentClass="bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
    />
  );
}
