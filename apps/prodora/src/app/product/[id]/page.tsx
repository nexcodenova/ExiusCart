'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Package, Tag, Download, ExternalLink, Play, ShoppingCart, Copy, Check,
  Loader2, CheckCircle2, TrendingUp, Users, Swords, Gauge, Store, Facebook, Instagram,
  Music2, ChevronRight,
} from 'lucide-react';
import { shoppingApi, Product } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import DOMPurify from 'dompurify';

function fmt(n: number) {
  return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ product_id: number } | null>(null);
  const [importError, setImportError] = useState('');
  const [activeImg, setActiveImg] = useState(0);

  const productId = Number(params.id);

  useEffect(() => {
    if (!productId || isNaN(productId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    shoppingApi
      .getProduct(productId)
      .then((p) => { setProduct(p); setActiveImg(0); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    shoppingApi.getRelatedProducts(productId).then(setRelated).catch(() => setRelated([]));
  }, [productId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleImport = async () => {
    if (!productId) return;
    setImporting(true);
    setImportError('');
    try {
      const res = await shoppingApi.importProduct(productId);
      setImported({ product_id: res.product_id });
    } catch (err: any) {
      setImportError(err?.response?.data?.detail || 'Could not add this product to your store. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="bg-white border-b border-[#E5E7EB] px-4 py-3">
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
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-5 px-4 text-center">
        <Package className="w-16 h-16 text-gray-300" />
        <h1 className="text-2xl font-bold text-[#111827]">Product not found</h1>
        <p className="text-[#6B7280]">This product may have been removed or doesn&apos;t exist.</p>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1E4FC2] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Prodora
        </Link>
      </div>
    );
  }

  const { name, price, cost_price, discount_pct, image_url, images, video_url, source_url,
    is_trending, is_featured, category_name, description, sku, variants,
    winning_score, trend_percent, competition_level, saturation_level, orders_count,
    supplier_name, supplier_rating, processing_time, shipping_time, warehouse_country,
    ad_facebook_url, ad_tiktok_url, ad_instagram_url, ad_pinterest_url, specs_json, tags } = product;

  const gallery = images && images.length > 0 ? images : (image_url ? [image_url] : []);
  const activeImage = gallery[activeImg] || gallery[0];

  const tagList = (tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  let specs: [string, string][] = [];
  try { specs = specs_json ? Object.entries(JSON.parse(specs_json)) : []; } catch { specs = []; }

  const hasWinningAnalytics = winning_score != null || trend_percent != null || competition_level || saturation_level || orders_count != null;
  const adPlatforms = [
    { key: 'facebook', label: 'Facebook Ads Library', url: ad_facebook_url, icon: Facebook },
    { key: 'instagram', label: 'Instagram', url: ad_instagram_url, icon: Instagram },
    { key: 'tiktok', label: 'TikTok Videos', url: ad_tiktok_url, icon: Music2 },
    { key: 'pinterest', label: 'Pinterest Pins', url: ad_pinterest_url, icon: Tag },
  ].filter((p) => p.url);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2 text-sm text-[#6B7280]">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 hover:text-[#2563EB] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span>/</span>
          <Link href="/browse" className="hover:text-[#2563EB] transition-colors">Winning Products</Link>
          {category_name && <><span>/</span><span className="text-gray-400">{category_name}</span></>}
          <span>/</span>
          <span className="text-[#111827] truncate max-w-[200px]">{name}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Main card — gallery + details */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Gallery */}
            <div className="p-4 md:p-5">
              <div className="relative bg-gray-50 group rounded-xl overflow-hidden" style={{ minHeight: '340px' }}>
                {activeImage ? (
                  <Image
                    src={activeImage}
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

                <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                  {discount_pct && discount_pct > 0 && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#2563EB] text-white shadow">%{discount_pct} OFF</span>
                  )}
                  {is_trending && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-500 text-white shadow">🔥 Trending</span>
                  )}
                  {!is_trending && is_featured && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-400 text-white shadow">⭐ Featured</span>
                  )}
                </div>

                {activeImage && (
                  <div className="absolute bottom-3 right-3 flex gap-2 z-10">
                    <a href={activeImage} download target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-semibold rounded-lg backdrop-blur transition"
                      title="Download product image">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </div>
                )}
              </div>

              {gallery.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {gallery.slice(0, 10).map((img, i) => (
                    <button key={i} onClick={() => setActiveImg(i)}
                      className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition ${i === activeImg ? 'border-[#2563EB]' : 'border-[#E5E7EB]'}`}>
                      <Image src={img} alt="" fill className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-6 flex flex-col gap-3">
              {category_name && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                  <Tag className="w-3 h-3" /> {category_name}
                </span>
              )}

              <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111827] leading-tight">{name}</h1>

              {winning_score != null && (
                <div className="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] text-sm font-semibold">
                  <TrendingUp className="w-4 h-4" /> Winning Score {winning_score}/100
                </div>
              )}

              {/* Price */}
              <div className="space-y-0.5">
                {cost_price && cost_price > price && (
                  <p className="text-sm text-gray-400 line-through">{fmt(cost_price)}</p>
                )}
                <p className={`text-[28px] font-semibold ${discount_pct ? 'text-[#2563EB]' : 'text-[#111827]'}`}>
                  {fmt(price)} <span className="text-base font-normal text-[#6B7280]">USD</span>
                </p>
                {discount_pct && discount_pct > 0 && (
                  <p className="text-sm text-[#16A34A] font-medium">{discount_pct}% below market — great margin</p>
                )}
              </div>

              {(warehouse_country || sku) && (
                <div className="flex flex-wrap gap-2">
                  {warehouse_country && (
                    <span className="text-xs text-[#6B7280] bg-gray-50 border border-[#E5E7EB] px-2 py-1 rounded">📦 {warehouse_country}</span>
                  )}
                  {sku && <span className="text-xs text-[#6B7280] bg-gray-50 border border-[#E5E7EB] px-2 py-1 rounded">SKU: {sku}</span>}
                </div>
              )}

              {variants && variants.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#6B7280] mb-1.5">Variants</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-[#111827]">
                        {v.color_hex && <span className="w-3 h-3 rounded-full border border-[#E5E7EB]" style={{ background: v.color_hex }} />}
                        {v.color}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dropshipper actions */}
              <div className="mt-auto pt-2 space-y-2">
                {source_url && (
                  <a href={source_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-[#2563EB] text-white hover:bg-[#1E4FC2] active:scale-95 transition w-full">
                    <ShoppingCart className="w-4 h-4" /> Get This Product from Supplier
                  </a>
                )}
                {imported ? (
                  <a href={`https://store.exiuscart.com/dashboard/products?edit=${imported.product_id}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-[#16A34A] text-white active:scale-95 transition w-full">
                    <CheckCircle2 className="w-4 h-4" /> Added — Open in ExiusCart
                  </a>
                ) : (
                  <button type="button" onClick={handleImport} disabled={importing}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm border-2 border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB] hover:text-white active:scale-95 transition w-full disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-[#2563EB]">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    {importing ? 'Adding to your store…' : 'Import Product'}
                  </button>
                )}
                <button type="button" onClick={handleCopyLink}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] hover:border-gray-300 transition w-full">
                  {copied ? <Check className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Link copied!' : 'Copy Product Link'}
                </button>
                {importError && <p className="text-xs text-red-500 text-center">{importError}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Video */}
        {video_url && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
              <Play className="w-4 h-4 text-[#2563EB]" />
              <h2 className="text-xl font-semibold text-[#111827]">Product Video</h2>
              <a href={video_url} target="_blank" rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-[#2563EB] hover:underline">
                <Download className="w-3.5 h-3.5" /> Download / Open
              </a>
            </div>
            <div className="p-4">
              <video
                src={video_url.match(/\.(mp4|webm|ogg)$/i) ? video_url : undefined}
                controls autoPlay muted loop playsInline
                className="w-full max-h-72 rounded-xl bg-black object-contain"
              >
                {!video_url.match(/\.(mp4|webm|ogg)$/i) && (
                  <p className="text-center py-8 text-gray-400">
                    <a href={video_url} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline font-semibold">
                      Open video in new tab →
                    </a>
                  </p>
                )}
              </video>
            </div>
          </div>
        )}

        {/* Description */}
        {description && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
            <h2 className="text-xl font-semibold text-[#111827] mb-3">Description</h2>
            <div
              className="text-[#6B7280] text-[15px] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description) }}
            />
          </div>
        )}

        {/* Features / Tags + Specifications */}
        {(tagList.length > 0 || specs.length > 0) && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5 space-y-5">
            {tagList.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-[#111827] mb-3">Features</h2>
                <div className="flex flex-wrap gap-2">
                  {tagList.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 text-sm text-[#111827] bg-gray-50 border border-[#E5E7EB] px-3 py-1.5 rounded-full">
                      <Check className="w-3.5 h-3.5 text-[#16A34A]" /> {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {specs.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-[#111827] mb-3">Specifications</h2>
                <div className="divide-y divide-[#E5E7EB]">
                  {specs.map(([key, value]) => (
                    <div key={key} className="flex justify-between py-2 text-sm">
                      <span className="text-[#6B7280]">{key}</span>
                      <span className="text-[#111827] font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Winning Analytics */}
        {hasWinningAnalytics && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
            <h2 className="text-xl font-semibold text-[#111827] mb-4">Winning Analytics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {orders_count != null && (
                <div className="border border-[#E5E7EB] rounded-xl p-3">
                  <p className="text-xs text-[#6B7280] flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Orders</p>
                  <p className="text-lg font-semibold text-[#111827] mt-1">{orders_count.toLocaleString()}</p>
                </div>
              )}
              {trend_percent != null && (
                <div className="border border-[#E5E7EB] rounded-xl p-3">
                  <p className="text-xs text-[#6B7280] flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Trend</p>
                  <p className="text-lg font-semibold text-[#16A34A] mt-1">{trend_percent > 0 ? '+' : ''}{trend_percent}%</p>
                </div>
              )}
              {competition_level && (
                <div className="border border-[#E5E7EB] rounded-xl p-3">
                  <p className="text-xs text-[#6B7280] flex items-center gap-1"><Swords className="w-3.5 h-3.5" /> Competition</p>
                  <p className="text-lg font-semibold text-[#111827] mt-1">{competition_level}</p>
                </div>
              )}
              {saturation_level && (
                <div className="border border-[#E5E7EB] rounded-xl p-3">
                  <p className="text-xs text-[#6B7280] flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> Saturation</p>
                  <p className="text-lg font-semibold text-[#111827] mt-1">{saturation_level}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Social proof — real ad links only, admin-curated */}
        {adPlatforms.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
            <h2 className="text-xl font-semibold text-[#111827] mb-3">See it in real ads</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {adPlatforms.map((p) => (
                <a key={p.key} href={p.url!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 border border-[#E5E7EB] rounded-xl p-3 hover:border-[#2563EB]/40 transition">
                  <div className="w-9 h-9 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                    <p.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-[#111827] flex-1">{p.label}</span>
                  <ExternalLink className="w-4 h-4 text-[#6B7280]" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Supplier Information */}
        {supplier_name && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
            <h2 className="text-xl font-semibold text-[#111827] mb-4 flex items-center gap-2">
              <Store className="w-4 h-4 text-[#2563EB]" /> Supplier Information
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-[#6B7280]">Supplier</p>
                <p className="text-[#111827] font-medium mt-0.5">{supplier_name}</p>
              </div>
              {supplier_rating != null && (
                <div>
                  <p className="text-xs text-[#6B7280]">Rating</p>
                  <p className="text-[#111827] font-medium mt-0.5">⭐ {supplier_rating}</p>
                </div>
              )}
              {processing_time && (
                <div>
                  <p className="text-xs text-[#6B7280]">Processing Time</p>
                  <p className="text-[#111827] font-medium mt-0.5">{processing_time}</p>
                </div>
              )}
              {shipping_time && (
                <div>
                  <p className="text-xs text-[#6B7280]">Shipping Time</p>
                  <p className="text-[#111827] font-medium mt-0.5">{shipping_time}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* How to sell this guide */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <h2 className="font-bold text-[#111827] mb-3 flex items-center gap-2">
            <span className="text-lg">💡</span> How to sell this product
          </h2>
          <ol className="space-y-2.5 text-sm text-[#111827]">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <span><strong>Import the product</strong> — click &quot;Import Product&quot; above to add it straight to your ExiusCart store.</span>
            </li>
            {source_url && (
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <span><strong>Order from supplier</strong> — click &quot;Get This Product from Supplier&quot; when a customer orders it.</span>
              </li>
            )}
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{source_url ? 3 : 2}</span>
              <span><strong>Start selling</strong> — the listing is live on your store immediately, ready to take orders.</span>
            </li>
          </ol>
        </div>

        {/* Related Winning Products */}
        {related.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#111827]">Related Winning Products</h2>
              <Link href="/browse" className="text-sm text-[#2563EB] font-medium flex items-center gap-0.5 hover:underline">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>

      <footer className="max-w-5xl mx-auto px-4 py-8 text-center text-xs text-[#6B7280]">
        © {new Date().getFullYear()} Fairam Private Limited &nbsp;·&nbsp; Prodora by ExiusCart
      </footer>
    </div>
  );
}
