'use client';

import { useState } from 'react';

// Real provider logo from /public/payment-logos/<id>-icon.svg (whop uses <id>.svg),
// otherwise a brand-coloured two-letter badge. Drop an SVG in that folder
// (stripe / paypal / whop) and it appears with no code change.
const FALLBACK_BG: Record<string, string> = {
  stripe: 'bg-violet-600',
  paypal: 'bg-blue-800',
  whop: 'bg-[#FA4616]',
};

export default function PaymentLogo({ id, name, size = 32 }: { id: string; name: string; size?: number }) {
  const [ok, setOk] = useState(true);

  if (ok) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/payment-logos/${id === 'whop' ? 'whop' : `${id}-icon`}.svg`}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain' }}
        onError={() => setOk(false)}
      />
    );
  }

  return (
    <span
      className={`grid place-items-center rounded-lg text-[11px] font-black text-white ${FALLBACK_BG[id] ?? 'bg-slate-600'}`}
      style={{ width: size, height: size }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
