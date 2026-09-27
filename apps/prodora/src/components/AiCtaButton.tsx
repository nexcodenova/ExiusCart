'use client';

import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { useLoginModal } from '@/components/providers/LoginModalProvider';

// "Try Prodora AI": always confirms the email first (pre-filled with the last one used, so it is one click), then lands on /ai.
// It never skips the step because an old sign-in may still be in the browser but expired.
export default function AiCtaButton({ children, ...props }: Omit<ComponentProps<typeof Button>, 'onClick'>) {
  const { open } = useLoginModal();
  return <Button {...props} onClick={() => open('/ai')}>{children}</Button>;
}
