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
  // Held back until the page (hero image included) has actually finished
  // loading, so the navbar doesn't pop in before the hero is ready behind it.
  const [loaded, setLoaded] = useState(false);
  // Auto-hides on scroll-down, reappears on scroll-up — being fixed, it
  // would otherwise sit permanently over whatever content is scrolling past
  // underneath it. Always shown near the top regardless of direction.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (document.readyState === 'complete') { setLoaded(true); return; }
    const onLoad = () => setLoaded(true);
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
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

  return (
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

      {/* Mobile Menu — its own floating panel below the pill, not attached flush */}
      {isOpen && (
        <div className="md:hidden mt-2 bg-[#0B1121] rounded-3xl shadow-lg shadow-black/20 overflow-hidden">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="block text-gray-400 hover:text-white transition-colors py-3"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 mt-4 border-t border-gray-800 space-y-3">
              <Link
                href="https://store.exiuscart.com/login"
                onClick={() => setIsOpen(false)}
                className="block text-gray-400 hover:text-white transition-colors py-2"
              >
                Login
              </Link>
              <Link
                href="/register"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-5 py-3 rounded-full transition-all"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

