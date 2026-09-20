'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(en);

const ALL_COUNTRIES = Object.entries(countries.getNames('en'))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Bundled with the app through the flag-icons package (imported in the root
// layout), not loaded from a CDN.
export function Flag({ code, className = 'h-4 w-5' }: { code: string; className?: string }) {
  if (code.length !== 2) return <span className={`inline-block ${className}`} aria-hidden="true" />;
  return <span className={`fi fi-${code.toLowerCase()} inline-block shrink-0 rounded-sm ${className}`} role="img" aria-label={code} />;
}

// Dropdown of every country with its flag. Picking one gives back both the
// ISO code (for the flag) and the name.
export function CountrySelect({
  code, onChange, exclude = [],
}: {
  code: string;
  onChange: (code: string, name: string) => void;
  exclude?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const selected = ALL_COUNTRIES.find((c) => c.code === code.toUpperCase());
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_COUNTRIES.filter((c) => (!exclude.includes(c.code) || c.code === selected?.code) && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q));
  }, [query, exclude, selected?.code]);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-left text-sm text-gray-900 focus:border-[#6B3FD9] focus:outline-none"
      >
        {selected ? <Flag code={selected.code} /> : null}
        <span className={`flex-1 truncate ${selected ? '' : 'text-gray-500'}`}>{selected ? selected.name : 'Select a country'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="relative border-b border-gray-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search countries"
              className="w-full rounded-lg bg-gray-50 py-2 pl-8 pr-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#6B3FD9]/30"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {list.length === 0 && <li className="px-3 py-3 text-sm text-gray-500">No country found</li>}
            {list.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => { onChange(c.code, c.name); setOpen(false); setQuery(''); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-100 ${c.code === selected?.code ? 'bg-[#6B3FD9]/10 font-medium text-[#5A2EC9]' : 'text-gray-800'}`}
                >
                  <Flag code={c.code} /> <span className="truncate">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
