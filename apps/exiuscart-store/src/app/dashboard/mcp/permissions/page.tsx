'use client';

import { ShieldCheck } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={ShieldCheck}
      group="MCP & AI Connections"
      title="Permissions"
      description="Fine-grained control over what connected AI assistants can access. Not built yet."
      accentClass="bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
    />
  );
}
