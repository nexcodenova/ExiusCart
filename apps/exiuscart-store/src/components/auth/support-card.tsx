'use client';

import { useState } from 'react';
import { MessageCircle, UserRound } from 'lucide-react';

const SUPPORT_WHATSAPP = 'https://wa.me/971562393573';

// Same contact card shown on Prodora (support avatar + WhatsApp link) —
// used here on Login/Register so a new or locked-out seller has a real
// person to reach, not just a bare support email. The photo is
// /public/support/support_2.jpg — if it fails to load the card falls back
// to a neutral avatar instead of a broken image.
export function SupportCard({ text }: { text: string }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <a
      href={SUPPORT_WHATSAPP}
      target="_blank" rel="noopener noreferrer"
      className="flex w-full max-w-md items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200/70 transition hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#6B3FD9]/10 text-[#6B3FD9]">
        {photoFailed ? (
          <UserRound className="h-5 w-5" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/support/support_2.jpg" alt="" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} />
        )}
      </span>
      <span className="text-sm leading-tight">
        <span className="block font-semibold text-gray-900">{text}</span>
        <span className="inline-flex items-center gap-1 text-[#6B3FD9]">
          <MessageCircle className="h-3.5 w-3.5" /> Chat with us on WhatsApp
        </span>
      </span>
    </a>
  );
}
