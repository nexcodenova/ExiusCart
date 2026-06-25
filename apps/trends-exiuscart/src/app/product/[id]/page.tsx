'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Package, Tag } from 'lucide-react';
import { shoppingApi, Product } from '@/lib/api';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const productId = Number(params.id);

  useEffect(() => {
    if (!productId || isNaN(productId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    shoppingApi
      .getProduct(productId)
      .then(setProduct)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [productId]);

  const fmt = (n: number, currency: string) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + currency;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f3f3]">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-4xl mx-auto h-6 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-gray-100 rounded-2xl" />
            <div className="flex flex-col gap-4">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-8 bg-gray-100 rounded w-3/4" />
              <div className="h-8 bg-gray-100 rounded w-1/3" />
              <div className="h-24 bg-gray-100 rounded" />
              <div className="h-12 bg-gray-100 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-[#f3f3f3] flex flex-col items-center justify-center gap-5 px-4 text-center">
        <Package className="w-16 h-16 text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-800">Product not found</h1>
        <p className="text-gray-400">This product may have been removed or doesn&apos;t exist.</p>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6000] text-white font-semibold rounded-xl hover:bg-[#e05500] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Trends
        </Link>
      </div>
    );
  }

  const { name, price, cost_price, discount_pct, currency, image_url, video_url,
    is_trending, is_featured, category_name, description, sku } = product;

  return (
    <div className="min-h-screen bg-[#f3f3f3]">
      {/* Breadcrumb bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 hover:text-[#FF6000] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span>/</span>
          {category_name && (
            <>
              <span className="text-gray-400">{category_name}</span>
              <span>/</span>
            </>
          )}
          <span className="text-gray-700 truncate max-w-[200px]">{name}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Media */}
            <div className="relative bg-gray-50" style={{ minHeight: '360px' }}>
              {video_url ? (
                <video
                  src={video_url}
                  controls autoPlay muted loop playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : image_url ? (
                <Image
                  src={image_url}
                  alt={name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="w-24 h-24 text-gray-300" />
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                {discount_pct && discount_pct > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#FF6000] text-white shadow">
                    %{discount_pct} OFF
                  </span>
                )}
                {is_trending && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-orange-500 text-white shadow">
                    🔥 Trending
                  </span>
                )}
                {!is_trending && is_featured && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-400 text-white shadow">
                    ⭐ Featured
                  </span>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="p-6 flex flex-col gap-4">
              {category_name && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <Tag className="w-3 h-3" /> {category_name}
                </span>
              )}

              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
                {name}
              </h1>

              {/* Price block */}
              <div className="space-y-0.5">
                {cost_price && cost_price > price && (
                  <p className="text-sm text-gray-400 line-through">
                    {fmt(cost_price, currency)}
                  </p>
                )}
                <p className={`text-3xl font-extrabold ${discount_pct ? 'text-[#FF6000]' : 'text-gray-900'}`}>
                  {fmt(price, currency)}
                </p>
                {discount_pct && discount_pct > 0 && (
                  <p className="text-sm text-green-600 font-medium">
                    You save {discount_pct}% off market price
                  </p>
                )}
              </div>

              {sku && (
                <p className="text-xs text-gray-400">SKU: {sku}</p>
              )}

              {description && (
                <p className="text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                  {description}
                </p>
              )}

              {/* CTA */}
              <div className="mt-auto pt-4 space-y-3">
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-sm text-orange-700">
                  <p className="font-semibold mb-1">Ready to sell this product?</p>
                  <p className="text-orange-600 text-xs">
                    Add it to your ExiusCart store and start dropshipping today. No upfront inventory needed.
                  </p>
                </div>
                <a
                  href="https://store.exiuscart.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-base transition-all bg-[#FF6000] text-white hover:bg-[#e05500] active:scale-95 w-full"
                >
                  Start Selling on ExiusCart
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Fairam Private Limited &nbsp;·&nbsp; ExiusCart Trends
      </footer>
    </div>
  );
}
