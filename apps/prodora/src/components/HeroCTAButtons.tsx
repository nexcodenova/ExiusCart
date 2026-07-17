'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLoginModal } from '@/components/providers/LoginModalProvider';

export default function HeroCTAButtons() {
  const { open } = useLoginModal();
  return (
    <div className="mt-8 flex flex-col sm:flex-row items-start gap-3">
      <Button size="lg" onClick={open}>
        Get started for free
      </Button>
      <Button variant="outline" size="lg" onClick={open}>
        Find winning products
      </Button>
    </div>
  );
}
