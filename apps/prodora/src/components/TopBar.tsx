'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LogOut, ExternalLink, LayoutDashboard } from 'lucide-react';
import { prodoraAuth } from '@/lib/api';

// Top bar for the authenticated app. On desktop it sits to the right of the
// sidebar; on mobile (no sidebar) it carries the logo instead.
export default function TopBar() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setName(localStorage.getItem('prodora_name') || ''); } catch {}
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'P';

  const logout = () => {
    prodoraAuth.logout();
    try { localStorage.removeItem('prodora_name'); } catch {}
    router.replace('/');
  };

  return (
    <header className="app-topbar fixed top-0 right-0 left-0 z-20 h-16 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        <Link href="/browse" className="flex items-center gap-2 lg:hidden">
          <Image src="/prodora-logo.png" alt="" width={26} height={26} />
          <span className="text-lg font-extrabold tracking-tight text-gray-900">Prodora</span>
        </Link>
        <p className="hidden lg:block text-sm text-gray-500">Winning products, ready to list on your store.</p>

        <div className="flex items-center gap-2">
          <a
            href="https://store.exiuscart.com/dashboard"
            target="_blank" rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <LayoutDashboard className="h-4 w-4" /> ExiusCart dashboard
          </a>
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Account menu"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563EB] text-sm font-bold text-white transition hover:ring-4 hover:ring-blue-100"
            >
              {initials}
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                {name && <p className="truncate border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">{name}</p>}
                <a
                  href="https://store.exiuscart.com/dashboard"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4 text-gray-400" /> Open ExiusCart
                </a>
                <button
                  type="button" onClick={logout}
                  className="flex w-full items-center gap-2.5 border-t border-gray-100 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
