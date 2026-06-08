import Image from 'next/image';
import Link from 'next/link';
import { Package, ArrowUpRight } from 'lucide-react';
import { Product } from '@/lib/api';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { id, name, price, currency, image_url, is_trending, is_featured, category_name } = product;

  const topBadge = () => {
    if (is_trending) return (
      <span className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-1 rounded-full bg-orange-500/90 text-white shadow">
        🔥 Trending
      </span>
    );
    if (is_featured) return (
      <span className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-1 rounded-full bg-yellow-500/90 text-black shadow">
        ⭐ Featured
      </span>
    );
    return null;
  };

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(price);

  return (
    <Link href={`/product/${id}`} className="group block">
      <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden transition-all duration-200 hover:border-[#6B3FD9]/50 hover:shadow-lg hover:shadow-[#6B3FD9]/10 h-full flex flex-col">
        {/* Image */}
        <div className="relative aspect-square bg-[#1a1a1a] overflow-hidden">
          {topBadge()}
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
              <Package className="w-16 h-16 text-[#444]" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col gap-2 flex-1">
          {category_name && (
            <span className="text-xs text-[#999] uppercase tracking-wider font-medium">
              {category_name}
            </span>
          )}
          <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug flex-1">
            {name}
          </h3>
          <div className="flex items-center justify-between mt-auto">
            <span className="text-[#6B3FD9] font-bold text-base">{formattedPrice}</span>
            <span className="flex items-center gap-1 text-xs text-[#999] group-hover:text-[#7B4FE9] transition-colors">
              View <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
