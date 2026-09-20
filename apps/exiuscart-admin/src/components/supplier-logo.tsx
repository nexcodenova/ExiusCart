'use client';

import { useState } from 'react';
import { PencilLine, Download } from 'lucide-react';

// Real supplier logos live in /public/suppliers/<key>.<ext>. Where a logo file
// has not been added yet, a tinted tile with the supplier's initials is shown
// instead (never an invented logo). To add one, drop the file in
// apps/exiuscart-admin/public/suppliers/ and add its path below.
const LOGOS: Record<string, { src: string; fit: 'cover' | 'contain' }> = {
  cj: { src: '/suppliers/cj.png', fit: 'cover' },
  aliexpress: { src: '/suppliers/aliexpress.svg', fit: 'contain' },
  hypersku: { src: '/suppliers/hypersku.png', fit: 'contain' },
};

const TINT: Record<string, string> = {
  cj: 'bg-orange-500/10 text-orange-600',
  aliexpress: 'bg-red-500/10 text-red-600',
  hypersku: 'bg-teal-500/10 text-teal-600',
  eprolo: 'bg-sky-500/10 text-sky-600',
  '1688': 'bg-orange-600/10 text-orange-700',
  printful: 'bg-indigo-500/10 text-indigo-600',
  printify: 'bg-fuchsia-500/10 text-fuchsia-600',
  gelato: 'bg-amber-500/10 text-amber-600',
};

const INITIALS: Record<string, string> = {
  cj: 'CJ', aliexpress: 'AE', hypersku: 'HS', eprolo: 'EP', '1688': '16', printful: 'PF', printify: 'PY', gelato: 'GL',
};

export function SupplierLogo({ supplier, label, className = 'h-9 w-9' }: { supplier: string; label?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const base = `flex shrink-0 items-center justify-center overflow-hidden rounded-lg ${className}`;

  if (supplier === 'manual') return <span className={`${base} bg-[#6B3FD9]/10 text-[#6B3FD9]`}><PencilLine className="h-1/2 w-1/2" /></span>;
  if (supplier === 'digital') return <span className={`${base} bg-[#6B3FD9]/10 text-[#6B3FD9]`}><Download className="h-1/2 w-1/2" /></span>;

  const logo = LOGOS[supplier];
  if (logo && !failed) {
    return (
      <span className={`${base} border border-gray-200 bg-white`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo.src} alt={label ?? supplier} onError={() => setFailed(true)}
          className={`h-full w-full ${logo.fit === 'cover' ? 'object-cover' : 'object-contain p-1'}`}
        />
      </span>
    );
  }
  const initials = INITIALS[supplier] ?? (label ?? supplier).slice(0, 2).toUpperCase();
  return <span className={`${base} text-xs font-bold ${TINT[supplier] ?? 'bg-gray-500/10 text-gray-600'}`} aria-label={label ?? supplier}>{initials}</span>;
}
