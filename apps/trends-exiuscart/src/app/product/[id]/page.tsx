'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Package, Tag, Download, ExternalLink, Play, ShoppingCart, Copy, Check } from 'lucide-react';
import { shoppingApi, Product } from '@/lib/api';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const fmt = (n: number) =>
    '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const handleCopyImage = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f3f3]">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-5xl mx-auto h-5 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="max-w-5xl mx-auto px-4 py-6 animate-pulse grid md:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-100 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="h-8 bg-gray-100 rounded w-3/4" />
            <div className="h-8 bg-gray-100 rounded w-1/3" />
            <div className="h-24 bg-gray-100 rounded" />
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
          Back to Prodora
        </Link>
      </div>
    );
  }

  const { name, price, cost_price, discount_pct, currency, image_url, video_url, source_url,
    is_trending, is_featured, category_name, description, sku } = product;

  return (
    <div className="min-h-screen bg-[#f3f3f3]">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 hover:text-[#FF6000] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span>/</span>
          {category_name && <><span className="text-gray-400">{category_name}</span><span>/</span></>}
          <span className="text-gray-700 truncate max-w-[200px]">{name}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Media */}
            <div className="relative bg-gray-50 group" style={{ minHeight: '380px' }}>
              {image_url ? (
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

              {/* Image overlay actions */}
              {image_url && (
                <div className="absolute bottom-3 right-3 flex gap-2 z-10">
                  <a
                    href={image_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-semibold rounded-lg backdrop-blur transition"
                    title="Download product image"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Image
                  </a>
                  <button
                    onClick={() => handleCopyImage(image_url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-semibold rounded-lg backdrop-blur transition"
                    title="Copy image URL"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy URL'}
                  </button>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-6 flex flex-col gap-4">
              {category_name && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <Tag className="w-3 h-3" /> {category_name}
                </span>
              )}

              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">{name}</h1>

              {/* Price */}
              <div className="space-y-0.5">
                {cost_price && cost_price > price && (
                  <p className="text-sm text-gray-400 line-through">{fmt(cost_price)}</p>
                )}
                <p className={`text-3xl font-extrabold ${discount_pct ? 'text-[#FF6000]' : 'text-gray-900'}`}>
                  {fmt(price)} <span className="text-base font-normal text-gray-400">USD</span>
                </p>
                {discount_pct && discount_pct > 0 && (
                  <p className="text-sm text-green-600 font-medium">{discount_pct}% below market — great margin</p>
                )}
              </div>

              {sku && <p className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded inline-block">SKU: {sku}</p>}

              {description && (
                <p className="text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-3">
                  {description}
                </p>
              )}

              {/* Dropshipper actions */}
              <div className="mt-auto pt-2 space-y-2">
                {source_url && (
                  <a
                    href={source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-[#FF6000] text-white hover:bg-[#e05500] active:scale-95 transition w-full"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Get This Product from Supplier
                  </a>
                )}
                <a
                  href="https://store.exiuscart.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm border-2 border-[#FF6000] text-[#FF6000] hover:bg-[#FF6000] hover:text-white active:scale-95 transition w-full"
                >
                  <ExternalLink className="w-4 h-4" />
                  Add to My ExiusCart Store
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Video section */}
        {video_url && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Play className="w-4 h-4 text-[#FF6000]" />
              <h2 className="font-bold text-gray-800">Product Video</h2>
              <a
                href={video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-[#FF6000] hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                Download / Open
              </a>
            </div>
            <div className="p-4">
              <video
                src={video_url.match(/\.(mp4|webm|ogg)$/i) ? video_url : undefined}
                controls
                autoPlay
                muted
                loop
                playsInline
                className="w-full max-h-72 rounded-xl bg-black object-contain"
              >
                {/* If not a direct video file, show a link */}
                {!video_url.match(/\.(mp4|webm|ogg)$/i) && (
                  <p className="text-center py-8 text-gray-400">
                    <a href={video_url} target="_blank" rel="noopener noreferrer" className="text-[#FF6000] hover:underline font-semibold">
                      Open video in new tab →
                    </a>
                  </p>
                )}
              </video>
              {!video_url.match(/\.(mp4|webm|ogg)$/i) && (
                <div className="mt-3 text-center">
                  <a
                    href={video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#FF6000] font-semibold hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Video Link
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* How to sell this guide */}
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-lg">💡</span> How to sell this product
          </h2>
          <ol className="space-y-2.5 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#FF6000] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <span>
                <strong>Download the image</strong> — click "Download Image" above to save the product photo for your store listing.
              </span>
            </li>
            {video_url && (
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#FF6000] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <span>
                  <strong>Get the video</strong> — use the download link in the video section to save the promo video for your product page or ads.
                </span>
              </li>
            )}
            {source_url && (
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#FF6000] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{video_url ? 3 : 2}</span>
                <span>
                  <strong>Order from supplier</strong> — click "Get This Product from Supplier" to go to the supplier page and place your order or request dropshipping.
                </span>
              </li>
            )}
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#FF6000] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{(video_url ? 1 : 0) + (source_url ? 1 : 0) + 2}</span>
              <span>
                <strong>List on ExiusCart</strong> — add this product to your ExiusCart seller store and start taking orders today.
              </span>
            </li>
          </ol>
        </div>
      </div>

      <footer className="max-w-5xl mx-auto px-4 py-8 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Fairam Private Limited &nbsp;·&nbsp; Prodora by ExiusCart
      </footer>
    </div>
  );
}
