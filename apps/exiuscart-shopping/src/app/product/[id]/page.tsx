'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Package, ShoppingCart, CheckCircle } from 'lucide-react';
import { shoppingApi, cartApi, Product } from '@/lib/api';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [added, setAdded] = useState(false);

  const productId = Number(params.id);

  useEffect(() => {
    if (!productId || isNaN(productId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    shoppingApi
      .getProduct(productId)
      .then((data) => {
        setProduct(data);
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          setNotFound(true);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const handleAddToCart = () => {
    if (!product || product.stock === 0) return;
    cartApi.addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const formattedPrice =
    product &&
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: product.currency || 'USD',
    }).format(product.price);

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
          <div className="h-8 w-24 bg-[#1e1e1e] rounded-lg mb-6" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-[#1e1e1e] rounded-2xl" />
            <div className="flex flex-col gap-4">
              <div className="h-6 bg-[#1e1e1e] rounded w-1/3" />
              <div className="h-8 bg-[#1e1e1e] rounded w-2/3" />
              <div className="h-6 bg-[#1e1e1e] rounded w-1/4" />
              <div className="h-24 bg-[#1e1e1e] rounded" />
              <div className="h-12 bg-[#1e1e1e] rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Not found
  // -------------------------------------------------------------------------
  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-5 px-4 text-center">
        <Package className="w-16 h-16 text-[#444]" />
        <h1 className="text-2xl font-bold text-white">Product not found</h1>
        <p className="text-[#999]">This product may have been removed or doesn&apos;t exist.</p>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#F5A623] text-black font-semibold rounded-xl hover:bg-[#e8961a] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </Link>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Stock indicator
  // -------------------------------------------------------------------------
  const stockIndicator = () => {
    if (product.stock === 0) {
      return <span className="text-red-400 font-semibold">Out of Stock</span>;
    }
    if (product.stock <= 5) {
      return (
        <span className="text-orange-400 font-semibold">
          Only {product.stock} left in stock — order soon!
        </span>
      );
    }
    return <span className="text-green-400 font-semibold">In Stock ({product.stock} available)</span>;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#999] hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* ---------------------------------------------------------------- */}
          {/* Media (video or image)                                           */}
          {/* ---------------------------------------------------------------- */}
          <div className="relative aspect-square bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
            {product.video_url ? (
              <video
                src={product.video_url}
                controls
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-24 h-24 text-[#444]" />
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {product.is_trending && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-500/90 text-white shadow">
                  🔥 Trending
                </span>
              )}
              {!product.is_trending && product.is_featured && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-500/90 text-black shadow">
                  ⭐ Featured
                </span>
              )}
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Details                                                          */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex flex-col gap-4">
            {product.category_name && (
              <span className="text-xs font-semibold text-[#999] uppercase tracking-widest">
                {product.category_name}
              </span>
            )}

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {product.name}
            </h1>

            <div className="text-3xl font-extrabold text-[#F5A623]">{formattedPrice}</div>

            <div className="text-sm">{stockIndicator()}</div>

            {product.description && (
              <p className="text-[#aaa] text-sm leading-relaxed border-t border-[#1e1e1e] pt-4">
                {product.description}
              </p>
            )}

            {/* Add to cart */}
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="mt-auto flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-base transition-all duration-150
                bg-[#F5A623] text-black hover:bg-[#e8961a] active:scale-95
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#F5A623] disabled:active:scale-100"
            >
              {added ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Added to Cart!
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  {product.stock === 0 ? 'Unavailable' : 'Add to Cart'}
                </>
              )}
            </button>

            <Link
              href="/cart"
              className="text-center text-sm text-[#999] hover:text-[#F5A623] transition-colors"
            >
              View Cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
