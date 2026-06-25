import Image from 'next/image';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { Product } from '@/lib/api';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { id, name, price, cost_price, discount_pct, currency, image_url, is_trending, is_featured, category_name } = product;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <Link href={`/product/${id}`} className="group block">
      <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
        {/* Image */}
        <div className="relative overflow-hidden bg-gray-50" style={{ paddingTop: '100%' }}>
          {/* Discount badge */}
          {discount_pct && discount_pct > 0 ? (
            <span className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-1 rounded bg-[#FF6000] text-white shadow-sm">
              %{discount_pct} OFF
            </span>
          ) : is_trending ? (
            <span className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-1 rounded bg-orange-500 text-white shadow-sm">
              Trending
            </span>
          ) : is_featured ? (
            <span className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-1 rounded bg-amber-400 text-white shadow-sm">
              Featured
            </span>
          ) : null}

          <div className="absolute inset-0">
            {image_url ? (
              <Image
                src={image_url}
                alt={name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-gray-300" />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col gap-1.5 flex-1">
          {category_name && (
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium truncate">
              {category_name}
            </span>
          )}

          <h3 className="text-sm text-gray-800 line-clamp-2 leading-snug flex-1 group-hover:text-[#FF6000] transition-colors">
            {name}
          </h3>

          <div className="mt-auto pt-1">
            {/* Original price strikethrough */}
            {cost_price && cost_price > price && (
              <p className="text-xs text-gray-400 line-through">
                {fmt(cost_price)} {currency}
              </p>
            )}

            {/* Selling price */}
            <p className={`font-bold text-base ${discount_pct ? 'text-[#FF6000]' : 'text-gray-900'}`}>
              {fmt(price)} <span className="text-xs font-normal text-gray-500">{currency}</span>
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
