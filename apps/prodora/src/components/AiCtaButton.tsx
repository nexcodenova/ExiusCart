'use client';

import type { ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { prodoraAuth } from '@/lib/api';
import { useLoginModal } from '@/components/providers/LoginModalProvider';

// "Try Prodora AI": straight to the page when already signed in, otherwise the login step, which then lands on /ai.
export default function AiCtaButton({ children, ...props }: Omit<ComponentProps<typeof Button>, 'onClick'>) {
  const { open } = useLoginModal();
  const router = useRouter();
  return <Button {...props} onClick={() => (prodoraAuth.hasAccess() ? router.push('/ai') : open('/ai'))}>{children}</Button>;
}
