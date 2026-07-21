'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useLoginModal } from '@/components/providers/LoginModalProvider';

export default function Navbar() {
  const { open } = useLoginModal();

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/prodora-logo.png" alt="Prodora" width={38} height={38} />
          <span className="text-[22px] font-bold tracking-tight text-foreground">Prodora</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-10">
          <a
            href="https://exiuscart.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            Pricing
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={open}>
            Login
          </Button>
          <Button asChild>
            <a href="https://exiuscart.com/register" target="_blank" rel="noopener noreferrer">
              Get Started to Sell
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
