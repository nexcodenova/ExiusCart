import Image from 'next/image';
import Link from 'next/link';
import { Package, ChevronRight } from 'lucide-react';
import { Product } from '@/lib/api';

const fmt = (n: number) =>
  '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// Card layout follows the product-research pattern: image, name, profit,
// what you pay vs. what you sell for, and a details button. Every number is
// a real field on the product — profit only shows when a supplier cost is
// actually known, never estimated.
export default function ProductCard({ product }: { product: Product }) {
  const { id, name, price, cost_price, discount_pct, image_url, is_trending, is_featured, orders_count } = product;
  const profit = cost_price != null ? price - cost_price : null;

  return (
    <Link href={`/product/${id}`} className="group block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200/70 transition hover:shadow-md">
        <div className="relative overflow-hidden bg-white" style={{ paddingTop: '100%' }}>
          {discount_pct && discount_pct > 0 ? (
            <span className="absolute left-2 top-2 z-10 rounded bg-[#2563EB] px-2 py-1 text-xs font-bold text-white shadow-sm">{discount_pct}% OFF</span>
          ) : is_trending ? (
            <span className="absolute left-2 top-2 z-10 rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white shadow-sm">Trending</span>
          ) : is_featured ? (
            <span className="absolute left-2 top-2 z-10 rounded bg-amber-400 px-2 py-1 text-xs font-bold text-white shadow-sm">Featured</span>
          ) : null}
          <div className="absolute inset-0">
            {image_url ? (
              <Image src={image_url} alt={name} fill className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-50"><Package className="h-14 w-14 text-gray-300" /></div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1 px-4 pt-3 pb-4">
          <h3 className="truncate text-[15px] font-semibold text-gray-900" title={name}>{name}</h3>
          {profit != null && profit > 0 ? (
            <p className="text-2xl font-bold tracking-tight text-emerald-600">
              +{fmt(profit)} <span className="text-xs font-medium text-gray-400">Profit</span>
            </p>
          ) : (
            <p className="text-2xl font-bold tracking-tight text-gray-900">{fmt(price)}</p>
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

        <div className="flex items-center justify-between bg-[#0B1D3A] px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-[#122C55]">
          Show details <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}
