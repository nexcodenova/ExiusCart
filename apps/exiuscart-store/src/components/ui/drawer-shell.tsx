'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Right-hand details panel, Tradelle-style: full viewport height (it covers
// the top bar too), the whole page dims behind it, it slides in, and Esc or a
// click outside closes it. Rendered through a portal on <body> so no ancestor
// (sticky header, overflow, transform) can clip it or sit above it.
export function DrawerShell({ onClose, width = 420, children }: {
  onClose: () => void; width?: number; children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setMounted(true);
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[80] bg-black/40 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        style={{ maxWidth: width }}
        className={`fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ${shown ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {children}
      </aside>
    </>,
    document.body,
  );
}
