'use client';

import { GraduationCap } from 'lucide-react';
import ComingSoon from '@/components/ComingSoon';

export default function AcademyPage() {
  return (
    <ComingSoon
      icon={GraduationCap}
      title="Academy"
      description="Short guides on finding, testing and selling winning products."
      points={['Product research basics', 'Listing and pricing', 'Running your first ads']}
    />
  );
}
