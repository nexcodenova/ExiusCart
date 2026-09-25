'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';
import { SUPPLIER_STYLE } from './SupplierCard';

export const SUPPLIER_NAMES: Record<string, string> = {
  cj: 'CJ Dropshipping', hypersku: 'HyperSKU', eprolo: 'EPROLO', aliexpress: 'AliExpress',
  '1688': '1688', printful: 'Printful', printify: 'Printify', gelato: 'Gelato',
};

/** "CJ Dropshipping" / "cj" / "AliExpress" -> our supplier key, or null. */
export function supplierKey(value: string | null | undefined): string | null {
  const v = (value ?? '').toLowerCase().replace(/\s+/g, '');
  if (!v) return null;
  return Object.keys(SUPPLIER_NAMES).find((k) => v === k || v.startsWith(k) || v.includes(k)) ?? null;
}

// Suppliers without a bundled logo look for /dropship-supplier-logos/<key>.svg;
// dropping that file in is all it takes, until then the icon shows.
function logoFor(key: string): string | undefined {
  return SUPPLIER_STYLE[key]?.logo ?? `/dropship-supplier-logos/${key}.svg`;
}

export default function SupplierBadge({ supplier, label = true, size = 24 }: { supplier: string; label?: boolean; size?: number }) {
  const key = supplierKey(supplier) ?? supplier;
  const st = SUPPLIER_STYLE[key];
  const Icon = st?.icon ?? Package;
  const logo = logoFor(key);
  const [logoOk, setLogoOk] = useState(true);
  const name = SUPPLIER_NAMES[key] ?? supplier;
  return (
    <span className="inline-flex items-center gap-2" title={name}>
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md ${st?.bg ?? 'bg-muted'}`} style={{ width: size, height: size }}>
        {logo && logoOk
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logo} alt="" onError={() => setLogoOk(false)} className={`h-full w-full ${st?.logoFit === 'cover' ? 'object-cover' : 'object-contain p-0.5'}`} />
          : <Icon className={`h-3.5 w-3.5 ${st?.color ?? 'text-muted-foreground'}`} />}
      </span>
      {label && <span className="text-foreground">{name}</span>}
    </span>
  );
}
