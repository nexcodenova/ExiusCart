'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLoginModal } from '@/components/providers/LoginModalProvider';

export default function Navbar() {
  const { open } = useLoginModal();
  const [isOpen, setIsOpen] = useState(false);

  // Lock page scroll while the full-screen mobile menu is open — same
  // treatment as exiuscart-website's navbar.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  return (
    <>
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

          {/* Desktop CTAs — mobile gets just the logo + menu button below
              (was Login + Get Started crammed in next to the logo on
              every screen size, with no way to reach Pricing on mobile
              at all since it was hidden with nowhere to go). */}
          <div className="hidden sm:flex items-center gap-3">
            <Button variant="outline" onClick={open}>
              Login
            </Button>
            <Button asChild>
              <a href="https://exiuscart.com/register" target="_blank" rel="noopener noreferrer">
                Get Started to Sell
              </a>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen((v) => !v)}
            className="sm:hidden p-2 text-foreground/70 hover:text-foreground"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile menu — full-screen overlay, matching exiuscart-website's
          navbar. Sibling of <header>, not nested inside it, so it's a
          clean fixed layer regardless of the header's own positioning. */}
      <div
        className={`sm:hidden fixed inset-0 z-40 bg-background flex flex-col transition-all duration-300 ${
          isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex-1 overflow-y-auto px-6 pt-28 pb-10">
          <nav className="flex flex-col">
            <a
              href="https://exiuscart.com/pricing"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="text-2xl font-semibold text-foreground/90 hover:text-foreground transition-colors py-4 border-b border-border"
            >
              Pricing
            </a>
          </nav>
          <div className="mt-8 space-y-3">
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => { setIsOpen(false); open(); }}
            >
              Login
            </Button>
            <Button asChild size="lg" className="w-full">
              <a
                href="https://exiuscart.com/register"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
              >
                Get Started to Sell
              </a>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
