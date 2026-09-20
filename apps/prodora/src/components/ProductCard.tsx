'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, ChevronRight, Info } from 'lucide-react';
import { Product } from '@/lib/api';
import LoadingImage from '@/components/LoadingImage';

const fmt = (n: number) =>
  '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// Card layout follows the product-research pattern: image, name, profit,
// what you pay vs. what you sell for, and a details button. Every number is
// a real field on the product — profit only shows when a supplier cost is
// actually known, never estimated.
//
// The image is lazy-loaded (it only starts downloading as the card nears the
// viewport while scrolling) and shows the animated Prodora logo until it has
// loaded, then fades in.
export default function ProductCard({ product, showDetailsBar = true }: { product: Product; showDetailsBar?: boolean }) {
  const { id, name, price, cost_price, discount_pct, image_url, is_trending, is_featured, orders_count } = product;
  const profit = cost_price != null ? price - cost_price : null;

  return (
    <Link href={`/product/${id}`} className="group block h-full">
      <div className="flex h-full flex-col rounded-lg bg-white shadow-sm ring-1 ring-gray-200/70 transition hover:shadow-md">
        <div className="relative overflow-hidden rounded-t-lg bg-white" style={{ paddingTop: '100%' }}>
          {discount_pct && discount_pct > 0 ? (
            <span className="absolute left-2 top-2 z-10 rounded bg-[#2563EB] px-2 py-1 text-xs font-bold text-white shadow-sm">{discount_pct}% OFF</span>
          ) : is_trending ? (
            <span className="absolute left-2 top-2 z-10 rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white shadow-sm">Trending</span>
          ) : is_featured ? (
            <span className="absolute left-2 top-2 z-10 rounded bg-amber-400 px-2 py-1 text-xs font-bold text-white shadow-sm">Featured</span>
          ) : null}
          <div className="absolute inset-0">
            {image_url ? (
              <LoadingImage
                src={image_url} alt={name} loading="lazy"
                className="object-cover group-hover:scale-105 transition-transform"
                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-50"><Package className="h-14 w-14 text-gray-300" /></div>
            )}
          </div>
        </div>

        <div className={`flex flex-1 flex-col gap-1 px-3.5 pt-3 pb-3.5 ${showDetailsBar ? '' : 'pb-4'}`}>
          <h3 className="truncate text-sm font-semibold text-gray-900" title={name}>{name}</h3>
          {profit != null && profit > 0 ? (
            <p className="relative flex items-center gap-1 text-xl font-bold tracking-tight text-emerald-600">
              +{fmt(profit)} <span className="text-xs font-medium text-gray-400">Profit</span>
              <ProfitTip />
            </p>
          ) : (
            <p className="text-xl font-bold tracking-tight text-gray-900">{fmt(price)}</p>
          )}
          <p className="text-sm text-gray-500">
            {cost_price != null ? (
              <>Pay <span className="font-semibold text-gray-700">{fmt(cost_price)}</span> → Sell <span className="font-semibold text-gray-900">{fmt(price)}</span></>
            ) : (
              <>Sell <span className="font-semibold text-gray-900">{fmt(price)}</span></>
            )}
          </p>
          {orders_count != null && orders_count > 0 && (
            <p className="text-xs text-gray-400">{new Intl.NumberFormat('en-US').format(orders_count)} orders</p>
          )}
        </div>

        {showDetailsBar && (
        <div className="flex items-center justify-between rounded-b-lg bg-[#0B1D3A] px-3.5 py-2 text-sm font-semibold text-white transition group-hover:bg-[#122C55]">
          Show details <ChevronRight className="h-4 w-4" />
        </div>
        )}
      </div>
    </Link>
  );
}

// The (i) next to the profit. Hover shows it on desktop; a tap toggles it on
// touch screens. The card is a link, so the click is swallowed here instead
// of opening the product.
function ProfitTip() {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="How profit is calculated"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setOpen(false)}
        className="text-gray-400 hover:text-gray-600"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-left text-xs font-normal leading-snug tracking-normal text-white shadow-lg"
        >
          Profit is the selling price minus the product cost. It does not include shipping, which is extra and differs by country, and it does not include taxes, ads or payment fees.
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}
