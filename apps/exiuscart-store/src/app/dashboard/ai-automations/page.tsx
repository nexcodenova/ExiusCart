'use client';

import { Workflow } from 'lucide-react';
import ComingSoon from '@/components/layout/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      icon={Workflow}
      group="AI Commerce"
      title="AI Automations"
      description="AI-driven automation rules for your store. Not built yet — real rule-based automation exists today under Marketing → Automations (Drip Flows)."
      accentClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
    />
  );
}
