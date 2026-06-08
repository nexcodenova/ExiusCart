'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Package, ExternalLink } from 'lucide-react';
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

  const formattedPrice =
    product &&
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: product.currency || 'USD',
    }).format(product.price);

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

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-5 px-4 text-center">
        <Package className="w-16 h-16 text-[#444]" />
        <h1 className="text-2xl font-bold text-white">Product not found</h1>
        <p className="text-[#999]">This product may have been removed or doesn&apos;t exist.</p>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#7B4FE9] text-white font-semibold rounded-xl hover:bg-[#5A2EC9] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Trends
        </Link>
      </div>
    );
  }

  const stockLabel = () => {
    if (product.stock === 0) return <span className="text-red-400 font-semibold">Out of Stock</span>;
    if (product.stock <= 5) return <span className="text-orange-400 font-semibold">Only {product.stock} left</span>;
    return <span className="text-green-400 font-semibold">In Stock</span>;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#999] hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Media */}
          <div className="relative aspect-square bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
            {product.video_url ? (
              <video
                src={product.video_url}
                controls autoPlay muted loop playsInline
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

          {/* Details */}
          <div className="flex flex-col gap-4">
            {product.category_name && (
              <span className="text-xs font-semibold text-[#999] uppercase tracking-widest">
                {product.category_name}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {product.name}
            </h1>
            <div className="text-3xl font-extrabold text-[#7B4FE9]">{formattedPrice}</div>
            <div className="text-sm">{stockLabel()}</div>

            {product.description && (
              <p className="text-[#aaa] text-sm leading-relaxed border-t border-[#1e1e1e] pt-4">
                {product.description}
              </p>
            )}

            {/* Visit shop — links to seller's store via API */}
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/shopping/products/${product.id}/shop-link`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-base transition-all
                bg-[#7B4FE9] text-white hover:bg-[#5A2EC9] active:scale-95"
            >
              <ExternalLink className="w-5 h-5" />
              Visit Shop
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
