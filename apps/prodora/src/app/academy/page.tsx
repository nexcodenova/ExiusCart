'use client';

import { GraduationCap } from 'lucide-react';
import ComingSoon from '@/components/ComingSoon';

export default function AcademyPage() {
  return (
    <ComingSoon
      icon={GraduationCap}
      title="Academy"
      description="Short guides on finding, testing and selling winning products."
      points={['How to spot a winning product', 'How to price and list it', 'How to run your first ads']}
    />
  );
}
