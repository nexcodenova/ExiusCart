'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MessageCircle, UserRound } from 'lucide-react';

const SUPPORT_WHATSAPP = 'https://wa.me/971562393573';

// Minimal top bar for the sign-in / sign-up screens: centred logo, the
// support contact on the right — same photo-avatar treatment Prodora uses.
// On tablet/laptop it sits here AND as a fuller card lower on the page
// (SupportCard); on a phone-width screen there isn't room for both, so it
// shows only down on the page, not up here. No product navigation —
// nothing to lead the visitor away from finishing the form.
export function AuthHeader() {
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-center px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="ExiusCart home">
          {/* The confirmed EC logo — same file as the main navbar. */}
          <Image src="/logo-ec.png" alt="" width={40} height={32} priority />
          <span className="text-xl font-bold tracking-tight text-gray-900">
            <span className="text-[#6B3FD9]">Exius</span>Cart
          </span>
        </Link>
        <a
          href={SUPPORT_WHATSAPP}
          target="_blank" rel="noopener noreferrer"
          className="absolute right-4 hidden items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 sm:flex"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#6B3FD9]/10 text-[#6B3FD9]">
            {photoFailed ? (
              <UserRound className="h-4 w-4" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/support/support_2.jpg" alt="" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} />
            )}
          </span>
          <span className="flex items-center gap-1">
            Support <MessageCircle className="h-3.5 w-3.5 text-[#6B3FD9]" />
          </span>
        </a>
      </div>
    </header>
  );
}
