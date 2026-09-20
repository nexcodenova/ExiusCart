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
  const { id, name, price, cost_price, discount_pct, image_url, is_trending, is_featured, is_bestseller, orders_count } = product;
  const profit = cost_price != null ? price - cost_price : null;

  return (
    <Link href={`/product/${id}`} className="group block h-full">
      <div className="flex h-full flex-col rounded-lg bg-white shadow-sm ring-1 ring-gray-200/70 transition hover:shadow-md">
        <div className="relative overflow-hidden rounded-t-lg bg-white" style={{ paddingTop: '100%' }}>
          {discount_pct && discount_pct > 0 ? (
            <span className="absolute left-1.5 top-1.5 z-10 rounded bg-[#2563EB] px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-xs">{discount_pct}% OFF</span>
          ) : is_trending ? (
            <span className="absolute left-1.5 top-1.5 z-10 rounded bg-orange-500 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-xs">Trending</span>
          ) : is_bestseller ? (
            <span className="absolute left-1.5 top-1.5 z-10 rounded bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-xs">Bestseller</span>
          ) : is_featured ? (
            <span className="absolute left-1.5 top-1.5 z-10 rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-xs">Featured</span>
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

        <div className={`flex flex-1 flex-col gap-0.5 px-3 pt-2.5 pb-3 sm:gap-1 sm:px-3.5 sm:pt-3 sm:pb-3.5 ${showDetailsBar ? '' : 'pb-4'}`}>
          <h3 className="truncate text-[13px] font-semibold text-gray-900 sm:text-sm" title={name}>{name}</h3>
          {profit != null && profit > 0 ? (
            <p className="relative flex items-center gap-1 text-lg font-bold tracking-tight text-emerald-600 sm:text-xl">
              +{fmt(profit)} <span className="text-xs font-medium text-gray-400">Profit</span>
              <ProfitTip />
            </p>
          ) : (
            <p className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{fmt(price)}</p>
          )}
          <p className="whitespace-nowrap text-[11px] text-gray-500 min-[400px]:text-xs sm:text-sm">
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
        <div className="flex items-center justify-between rounded-b-lg bg-[#0B1D3A] px-3 py-2.5 text-[13px] font-semibold text-white transition group-hover:bg-[#122C55] sm:px-3.5 sm:py-2 sm:text-sm">
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
