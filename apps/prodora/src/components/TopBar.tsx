'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LogOut, LayoutDashboard, Settings, ClipboardList, BookOpen, Menu } from 'lucide-react';
import { prodoraAuth, accountApi, ProdoraAccount } from '@/lib/api';
import FeedbackButton from '@/components/FeedbackButton';

const STORE = 'https://store.exiuscart.com/dashboard';

// Top bar for the authenticated app. On desktop it sits to the right of the
// sidebar; on mobile (no sidebar) it carries the logo instead.
export default function TopBar({ onMenu }: { onMenu?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [account, setAccount] = useState<ProdoraAccount | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setName(localStorage.getItem('prodora_name') || ''); } catch {}
    accountApi.me().then(setAccount).catch(() => {});
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const displayName = account?.name || name;
  const initials = displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'P';

  const logout = () => {
    prodoraAuth.logout();
    try { localStorage.removeItem('prodora_name'); } catch {}
    router.replace('/');
  };

  return (
    <header className="app-topbar right-scroll-bar-position fixed top-0 right-0 left-0 z-20 h-12 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-1 lg:hidden">
          {onMenu && (
            <button
              type="button" onClick={onMenu} aria-label="Open menu"
              className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-gray-700 transition hover:bg-gray-100"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
          <Link href="/browse" className="flex items-center gap-2">
            <Image src="/prodora-logo.png" alt="" width={32} height={32} className="h-8 w-8" />
            <span className="text-[26px] font-extrabold leading-none tracking-tight text-gray-900">Prodora</span>
          </Link>
        </div>
        <p className="hidden lg:block text-sm text-gray-500">Winning products, ready to list on your store.</p>

        <div className="flex items-center gap-2.5">
          <FeedbackButton />
          <a
            href={STORE}
            target="_blank" rel="noopener noreferrer"
            className="hidden sm:inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <LayoutDashboard className="h-[18px] w-[18px]" /> ExiusCart dashboard
          </a>
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Account menu" aria-expanded={open}
              className={`flex h-10 w-10 items-center justify-center rounded-lg bg-[#E6F0FB] text-sm font-bold text-[#1E4E8C] transition hover:bg-[#D6E6F8] ${open ? 'ring-2 ring-blue-200' : ''}`}
            >
              {initials}
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#E6F0FB] text-sm font-bold text-[#1E4E8C]">{initials}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{displayName || 'Your account'}</p>
                    {account?.email && <p className="truncate text-xs text-gray-500">{account.email}</p>}
                    {account && (
                      <span className="mt-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                        {account.plan_name} plan{account.status === 'trial' || account.status === 'trial_dollar' ? ' · trial' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="py-1">
                  <MenuLink href={`${STORE}/settings`} icon={Settings} label="Account Settings" external />
                  <MenuLink href={`${STORE}/billing`} icon={ClipboardList} label="Subscription" external />
                  <MenuLink href="/instructions" icon={BookOpen} label="Instructions" onClick={() => setOpen(false)} />
                </div>
                <button
                  type="button" onClick={logout}
                  className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  href, icon: Icon, label, external, onClick,
}: { href: string; icon: React.ElementType; label: string; external?: boolean; onClick?: () => void }) {
  const cls = 'flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50';
  const inner = (<><Icon className="h-4 w-4 text-gray-400" /> {label}</>);
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <Link href={href} onClick={onClick} className={cls}>{inner}</Link>;
}
