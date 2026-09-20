'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X, LayoutGrid } from 'lucide-react';
import type { Category } from '@/lib/api';

export interface FilterState {
  chips: string[];
  minPrice: string;
  maxPrice: string;
}

export const EMPTY_FILTERS: FilterState = { chips: [], minPrice: '', maxPrice: '' };

// Right-hand slide-over: the top selling categories, chips to filter by (has
// video, has a Meta ad, and the real tags found on the loaded products) plus a
// price range. Chips and price apply live; picking a category opens it.
export default function FilterDrawer({
  open, onClose, chips, value, onChange, topCategories, activeCategory, onPickCategory,
}: {
  open: boolean;
  onClose: () => void;
  chips: string[];
  value: FilterState;
  onChange: (v: FilterState) => void;
  topCategories: Category[];
  activeCategory: string;
  onPickCategory: (slug: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const toggle = (chip: string) =>
    onChange({ ...value, chips: value.chips.includes(chip) ? value.chips.filter((c) => c !== chip) : [...value.chips, chip] });
  const active = value.chips.length + (value.minPrice ? 1 : 0) + (value.maxPrice ? 1 : 0);

  return (
    <>
      <div
        className={`fixed inset-0 z-[90] bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-[100] flex w-full max-w-[26rem] flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!open}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 px-5">
          <button type="button" onClick={onClose} aria-label="Close filters" className="text-gray-500 hover:text-gray-800">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {topCategories.length > 0 && (
            <section className="mb-7">
              <h3 className="text-base font-semibold text-gray-900">Top selling categories</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {topCategories.map((c) => {
                  const on = c.slug === activeCategory;
                  return (
                    <button
                      key={c.id} type="button" onClick={() => onPickCategory(c.slug)} aria-pressed={on}
                      className={`flex items-center gap-2.5 rounded-lg border p-2 text-left transition ${on ? 'border-[#2563EB] bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 text-gray-400">
                        {c.image_url ? <Image src={c.image_url} alt="" width={44} height={44} className="h-full w-full object-cover" /> : <LayoutGrid className="h-5 w-5" />}
                      </span>
                      <span className={`line-clamp-2 min-w-0 text-sm leading-tight ${on ? 'font-semibold text-[#2563EB]' : 'text-gray-800'}`}>{c.name.split('>').pop()!.trim()}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <h3 className="text-base font-semibold text-gray-900">Filter by</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip) => {
              const on = value.chips.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggle(chip)}
                  className={`rounded-md border px-3.5 py-2 text-sm transition ${
                    on ? 'border-[#2563EB] bg-blue-50 font-medium text-[#2563EB]' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {chip}
                </button>
              );
            })}
            {chips.length === 0 && <p className="text-sm text-gray-400">No filters available for these products yet.</p>}
          </div>

          <h3 className="mt-7 text-base font-semibold text-gray-900">Selling price</h3>
          <div className="mt-3 flex items-center gap-3">
            <label className="flex-1 text-xs font-medium text-gray-500">
              Min
              <input
                type="number" min="0" inputMode="decimal" value={value.minPrice} placeholder="0"
                onChange={(e) => onChange({ ...value, minPrice: e.target.value })}
                className="mt-1 block h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <span className="mt-5 text-gray-400">–</span>
            <label className="flex-1 text-xs font-medium text-gray-500">
              Max
              <input
                type="number" min="0" inputMode="decimal" value={value.maxPrice} placeholder="Any"
                onChange={(e) => onChange({ ...value, maxPrice: e.target.value })}
                className="mt-1 block h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            disabled={active === 0}
            onClick={() => onChange(EMPTY_FILTERS)}
            className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-lg bg-[#2563EB] text-sm font-semibold text-white transition hover:bg-[#1E4FC2]"
          >
            Apply filters
          </button>
        </div>
      </aside>
    </>
  );
}
