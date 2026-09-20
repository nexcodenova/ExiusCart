'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';

const WHATSAPP = 'https://wa.me/94752710705?text=' + encodeURIComponent('Hi, I need help with the ExiusCart admin panel.');

// Top-bar Support button: opens a WhatsApp chat with the ExiusCart support
// contact. The photo is /public/support/support.jpg; if it fails to load a
// plain icon is shown instead.
export function SupportButton() {
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <a
      href={WHATSAPP} target="_blank" rel="noopener noreferrer"
      className="flex h-10 items-center gap-2.5 rounded-lg border border-gray-200 bg-white pl-1.5 pr-3.5 text-sm transition hover:border-green-500/50 hover:bg-green-50/50"
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
        {photoFailed ? (
          <MessageCircle className="h-4 w-4 text-gray-500" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/support/support.jpg" alt="" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} />
        )}
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
      </span>
      <span className="leading-tight">
        <span className="block font-semibold text-gray-900">Support</span>
        <span className="hidden text-[11px] text-gray-500 sm:block">Chat on WhatsApp</span>
      </span>
    </a>
  );
}
