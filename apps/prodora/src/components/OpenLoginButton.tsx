'use client';

import { Button, type ButtonProps } from '@/components/ui/button';
import { useLoginModal } from '@/components/providers/LoginModalProvider';

export default function OpenLoginButton({ children, ...props }: ButtonProps) {
  const { open } = useLoginModal();
  return (
    <Button {...props} onClick={open}>
      {children}
    </Button>
  );
}
