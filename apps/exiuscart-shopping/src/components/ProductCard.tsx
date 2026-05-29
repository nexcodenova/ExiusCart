'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Package, ShoppingCart } from 'lucide-react';
import { cartApi, Product } from '@/lib/api';

interface ProductCardProps {
  product: Product;
  onCartUpdate?: () => void;
}

export default function ProductCard({ product, onCartUpdate }: ProductCardProps) {
  const {
    id,
    name,
    price,
    currency,
    image_url,
    is_trending,
    is_featured,
    category_name,
    stock,
  } = product;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (stock === 0) return;
    cartApi.addItem(product);
    onCartUpdate?.();
  };

  const stockBadge = () => {
    if (stock === 0) {
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-900/60 text-red-400 border border-red-800">
          Out of Stock
        </span>
      );
    }
    if (stock <= 5) {
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-900/60 text-orange-400 border border-orange-800">
          Only {stock} left
        </span>
      );
    }
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-900/60 text-green-400 border border-green-800">
        In Stock
      </span>
    );
  };

  const topBadge = () => {
    if (is_trending) {
      return (
        <span className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-1 rounded-full bg-orange-500/90 text-white shadow">
          🔥 Trending
        </span>
      );
    }
    if (is_featured) {
      return (
        <span className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-1 rounded-full bg-yellow-500/90 text-black shadow">
          ⭐ Featured
        </span>
      );
    }
    return null;
  };

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(price);

  return (
    <Link href={`/product/${id}`} className="group block">
      <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden transition-all duration-200 hover:border-[#6B3FD9]/50 hover:shadow-lg hover:shadow-[#6B3FD9]/10 h-full flex flex-col">
        {/* Image area */}
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

          <div className="flex items-center justify-between gap-2 mt-auto">
            <span className="text-[#6B3FD9] font-bold text-base">{formattedPrice}</span>
            {stockBadge()}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={stock === 0}
            className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-150
              bg-[#6B3FD9] text-black hover:bg-[#e8961a] active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#6B3FD9] disabled:active:scale-100"
          >
            <ShoppingCart className="w-4 h-4" />
            {stock === 0 ? 'Unavailable' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </Link>
  );
}

