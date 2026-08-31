'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';

const navLinks = [
  { href: '/features',     label: 'Features'      },
  { href: '/industries',   label: 'Industries'    },
  { href: '/integrations', label: 'Integrations'  },
  { href: '/pricing',      label: 'Pricing'       },
  { href: '/about',        label: 'About'         },
  { href: '/blog',         label: 'Blog'          },
  { href: '/contact',      label: 'Contact'       },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  // Briefly held back so the navbar doesn't pop in on a still-blank page.
  // Used to gate on the full window `load` event instead — which waits
  // for every image on the ENTIRE page, not just the hero, including
  // stuff far below the fold (the marquee/supplier cards etc). That made
  // the wait grow every time more content was added to the page, which is
  // exactly why the navbar started taking noticeably longer to appear. A
  // short fixed delay gets the same "not an instant jarring pop-in"
  // effect without being coupled to total page weight.
  const [loaded, setLoaded] = useState(false);
  // Auto-hides on scroll-down, reappears on scroll-up — being fixed, it
  // would otherwise sit permanently over whatever content is scrolling past
  // underneath it. Always shown near the top regardless of direction.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 150);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isOpen) { setHidden(false); return; }
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const scrollingDown = y > lastY;
      setHidden(scrollingDown && y > 120);
      lastY = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isOpen]);

  // Lock page scroll while the full-screen mobile menu is open — without
  // this the page behind it still scrolls (or the menu's own content
  // scrolls the page instead of itself), which feels broken on a real
  // full-screen overlay.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  return (
    <>
    <div
      className={`fixed top-3 left-3 right-3 sm:top-4 sm:left-6 sm:right-6 z-50 transition-all duration-500 ${loaded ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${hidden ? '-translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0'}`}
    >
      <nav className="max-w-[96rem] mx-auto bg-[#0B1121]/90 backdrop-blur-md rounded-full shadow-lg shadow-black/20 px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-[4.5rem]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="ExiusCart" width={32} height={32} className="flex-shrink-0" />
            <span className="text-xl font-bold text-white tracking-tight">
              <span className="text-[#6B3FD9]">Exius</span>Cart
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="https://store.exiuscart.com/login"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-6 py-2.5 rounded-full transition-all text-sm"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-gray-400 hover:text-white p-2"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>
    </div>

    {/* Mobile Menu — full-screen overlay (was a small floating panel that
        left page content visible/scrollable underneath it, which read as
        unfinished). Deliberately NOT nested inside the pill's wrapper div
        above: that div always carries a translate-y-* class (even
        translate-y-0 counts), and any transform on an ancestor makes it
        the containing block for a `position: fixed` descendant instead
        of the viewport — which was silently confining this "full-screen"
        menu to the pill's own small box instead of covering the actual
        screen. Sibling-level fixed positioning here isn't affected by
        that. z-40 vs the pill's z-50 so the pill — with its X close
        button — stays on top and usable. Fades/scales in rather than
        just appearing, matching the pill's own transition treatment. */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-[#0B1121] flex flex-col transition-all duration-300 ${
          isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex-1 overflow-y-auto px-6 pt-28 pb-10">
          <nav className="flex flex-col">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="text-2xl font-semibold text-gray-200 hover:text-white transition-colors py-4 border-b border-white/5"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 space-y-3">
            <Link
              href="https://store.exiuscart.com/login"
              onClick={() => setIsOpen(false)}
              className="block text-center text-gray-300 hover:text-white border border-white/15 hover:border-white/30 transition-colors py-3.5 rounded-full font-medium"
            >
              Login
            </Link>
            <Link
              href="/register"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-5 py-3.5 rounded-full transition-all"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

