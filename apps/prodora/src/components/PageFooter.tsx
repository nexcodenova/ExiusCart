'use client';

import { useState } from 'react';
import { Mail, UserRound } from 'lucide-react';

// Footer for the Instructions and "Coming soon" pages only. It is pinned to the
// bottom of the screen (beside the sidebar) and does not scroll with the page,
// so the pages that use it need bottom padding (pb-24). The photo is
// /public/support/support_2.jpg.
export default function PageFooter() {
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <footer className="app-footer right-scroll-bar-position fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <p className="hidden text-sm text-gray-500 sm:block">
          Developed by{' '}
          <a href="https://nexcodenova.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-800 hover:text-blue-600">NexCode Nova</a>
          <span className="mx-2 text-gray-300">|</span>
          Part of{' '}
          <a href="https://exiuscart.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-800 hover:text-blue-600">ExiusCart</a>
        </p>

        <div className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-blue-50 to-white p-1.5 pr-2 ring-1 ring-blue-100 sm:w-auto">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            {photoFailed ? (
              <UserRound className="h-5 w-5" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/support/support_2.jpg" alt="" className="h-full w-full rounded-full object-cover" onError={() => setPhotoFailed(true)} />
            )}
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
          </span>
          <span className="min-w-0 flex-1 leading-tight sm:flex-none">
            <span className="block text-sm font-semibold text-gray-900">Need help? Talk to support</span>
            <span className="block truncate text-xs text-gray-500">support@exiuscart.com</span>
          </span>
          <a
            href="mailto:support@exiuscart.com"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 text-sm font-semibold text-white transition hover:bg-[#1E4FC2]"
          >
            <Mail className="h-4 w-4" /> Email us
          </a>
        </div>
      </div>
    </footer>
  );
}
