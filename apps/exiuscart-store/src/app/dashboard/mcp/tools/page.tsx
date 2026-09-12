'use client';

import { Wrench } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Wrench}
      group="MCP & AI Connections"
      title="MCP Tools"
      description="The specific store actions an AI assistant is allowed to call. Not built yet."
      accentClass="bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
    />
  );
}
