'use client';

import { Cable } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Cable}
      group="MCP & AI Connections"
      title="Connected AI"
      description="The AI assistants currently connected to your store. Not built yet."
      accentClass="bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
    />
  );
}
