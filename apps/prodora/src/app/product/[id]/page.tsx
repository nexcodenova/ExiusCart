'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Package, Tag, Download, ExternalLink, Play, ShoppingCart, Copy, Check,
  Loader2, CheckCircle2, TrendingUp, Users, Swords, Gauge, Store, Facebook, Instagram,
  Music2, ChevronRight, Trophy, Globe2,
} from 'lucide-react';
import { shoppingApi, Product } from '@/lib/api';
import DOMPurify from 'dompurify';

function fmt(n: number) {
  return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function flagEmoji(code?: string | null) {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

function TrendChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length < 2) return null;
  const w = 260, h = 70, pad = 4;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.value - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const linePath = 'M' + points.map(([x, y]) => `${x},${y}`).join(' L');
  const areaPath = `${linePath} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trendGrad)" />
        <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill="#2563EB" />
      </svg>
      <div className="flex justify-between text-[10px] text-[#6B7280] mt-1">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}

function RelatedProductCard({ product }: { product: Product }) {
  const profit = product.cost_price != null ? product.price - product.cost_price : null;
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleImport = async (e: React.MouseEvent) => {
    e.preventDefault();
    setImporting(true);
    try {
      await shoppingApi.importProduct(product.id);
      setDone(true);
    } catch { /* silently leave importable for retry */ } finally { setImporting(false); }
  };

  return (
    <Link href={`/product/${product.id}`} className="group block bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-md transition">
      <div className="relative aspect-square bg-gray-50">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill className="object-cover group-hover:scale-105 transition duration-300" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"><Package className="w-10 h-10 text-gray-300" /></div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm text-[#111827] line-clamp-2 leading-snug">{product.name}</p>
        <div className="flex items-center justify-between text-xs text-[#6B7280]">
          {profit != null && <span>Profit <strong className="text-[#16A34A]">{fmt(profit)}</strong></span>}
          {product.orders_count != null && <span>{product.orders_count.toLocaleString()} orders</span>}
        </div>
        <button type="button" onClick={handleImport} disabled={importing || done}
          className={`w-full text-xs py-1.5 rounded-lg font-medium transition ${done ? 'bg-green-50 text-[#16A34A]' : 'bg-[#2563EB] text-white hover:bg-[#1E4FC2]'} disabled:opacity-70`}>
          {done ? 'Imported' : importing ? 'Importing…' : 'Import'}
        </button>
      </div>
    </Link>
  );
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
          <div className="max-w-6xl mx-auto h-5 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="max-w-6xl mx-auto px-4 py-6 animate-pulse grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 aspect-square bg-gray-100 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="h-40 bg-gray-100 rounded" />
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
        <Link href="/" className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1E4FC2] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Prodora
        </Link>
      </div>
    );
  }

  const { name, price, cost_price, discount_pct, image_url, images, video_url, source_url,
    is_trending, is_featured, category_name, description, sku, variants,
    winning_score, trend_percent, competition_level, saturation_level, orders_count,
    supplier_name, supplier_rating, fulfillment_rate, processing_time, shipping_time,
    warehouse_country, shipping_cost, demand_trend_json, top_countries_json,
    ad_facebook_url, ad_tiktok_url, ad_instagram_url, ad_pinterest_url, specs_json, tags } = product;

  const gallery = images && images.length > 0 ? images : (image_url ? [image_url] : []);
  const activeImage = gallery[activeImg] || gallery[0];

  const tagList = (tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  let specs: [string, string][] = [];
  try { specs = specs_json ? Object.entries(JSON.parse(specs_json)) : []; } catch { specs = []; }
  let demandTrend: { label: string; value: number }[] = [];
  try { demandTrend = demand_trend_json ? JSON.parse(demand_trend_json) : []; } catch { demandTrend = []; }
  let topCountries: { country: string; code: string; percent: number }[] = [];
  try { topCountries = top_countries_json ? JSON.parse(top_countries_json) : []; } catch { topCountries = []; }

  const totalCost = cost_price != null ? cost_price + (shipping_cost || 0) : null;
  const profit = totalCost != null ? price - totalCost : null;
  const marginPct = profit != null && price > 0 ? Math.round((profit / price) * 100) : null;

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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 text-sm text-[#6B7280]">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 hover:text-[#2563EB] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span>/</span>
          <Link href="/browse" className="hover:text-[#2563EB] transition-colors">Winning Products</Link>
          {category_name && <><span>/</span><span className="text-gray-400">{category_name}</span></>}
          <span>/</span>
          <span className="text-[#111827] truncate max-w-[200px]">{name}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-5 items-start">

          {/* ── Left: main content ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Gallery + basic info */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
              <div className="p-4 md:p-5">
                <div className="relative bg-gray-50 group rounded-xl overflow-hidden" style={{ minHeight: '340px' }}>
                  {activeImage ? (
                    <Image src={activeImage} alt={name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 60vw" priority />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><Package className="w-24 h-24 text-gray-300" /></div>
                  )}

                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                    {discount_pct && discount_pct > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#2563EB] text-white shadow">%{discount_pct} OFF</span>
                    )}
                    {is_trending && <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-500 text-white shadow">🔥 Trending</span>}
                    {!is_trending && is_featured && <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-400 text-white shadow">⭐ Featured</span>}
                  </div>

                  {video_url && (
                    <a href="#video" className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-semibold rounded-lg backdrop-blur transition">
                      <Play className="w-3.5 h-3.5" /> Watch Video
                    </a>
                  )}

                  {activeImage && (
                    <div className="absolute bottom-3 right-3 flex gap-2 z-10">
                      <a href={activeImage} download target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-semibold rounded-lg backdrop-blur transition">
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

              <div className="px-5 pb-5 space-y-3">
                {category_name && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    <Tag className="w-3 h-3" /> {category_name}
                  </span>
                )}
                <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111827] leading-tight">{name}</h1>

                {winning_score != null && (
                  <div className="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] text-sm font-semibold">
                    <Trophy className="w-4 h-4" /> Winning Score {winning_score}/100
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
              </div>
            </div>

            {/* Video */}
            {video_url && (
              <div id="video" className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#2563EB]" />
                  <h2 className="text-xl font-semibold text-[#111827]">Product Video</h2>
                  <a href={video_url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-xs text-[#2563EB] hover:underline">
                    <Download className="w-3.5 h-3.5" /> Download / Open
                  </a>
                </div>
                <div className="p-4">
                  <video src={video_url.match(/\.(mp4|webm|ogg)$/i) ? video_url : undefined} controls autoPlay muted loop playsInline
                    className="w-full max-h-72 rounded-xl bg-black object-contain">
                    {!video_url.match(/\.(mp4|webm|ogg)$/i) && (
                      <p className="text-center py-8 text-gray-400">
                        <a href={video_url} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline font-semibold">Open video in new tab →</a>
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
                <div className="text-[#6B7280] text-[15px] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description) }} />
              </div>
            )}

            {/* Features / Specifications */}
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

            {/* Social proof */}
            {adPlatforms.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
                <h2 className="text-xl font-semibold text-[#111827] mb-3">See it in real ads</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {adPlatforms.map((p) => (
                    <a key={p.key} href={p.url!} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 border border-[#E5E7EB] rounded-xl p-3 hover:border-[#2563EB]/40 transition">
                      <div className="w-9 h-9 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0"><p.icon className="w-4 h-4" /></div>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-4">
                  <div><p className="text-xs text-[#6B7280]">Supplier</p><p className="text-[#111827] font-medium mt-0.5">{supplier_name}</p></div>
                  {supplier_rating != null && <div><p className="text-xs text-[#6B7280]">Rating</p><p className="text-[#111827] font-medium mt-0.5">⭐ {supplier_rating}</p></div>}
                  {fulfillment_rate != null && <div><p className="text-xs text-[#6B7280]">Fulfillment Rate</p><p className="text-[#111827] font-medium mt-0.5">{fulfillment_rate}%</p></div>}
                  {processing_time && <div><p className="text-xs text-[#6B7280]">Processing Time</p><p className="text-[#111827] font-medium mt-0.5">{processing_time}</p></div>}
                  {shipping_time && <div><p className="text-xs text-[#6B7280]">Shipping Time</p><p className="text-[#111827] font-medium mt-0.5">{shipping_time}</p></div>}
                </div>
                {source_url && (
                  <a href={source_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] border border-[#2563EB]/30 rounded-lg px-3 py-2 hover:bg-[#2563EB]/5 transition">
                    <Store className="w-4 h-4" /> View Supplier Store
                  </a>
                )}
              </div>
            )}

            {/* How to sell this guide */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <h2 className="font-bold text-[#111827] mb-3 flex items-center gap-2"><span className="text-lg">💡</span> How to sell this product</h2>
              <ol className="space-y-2.5 text-sm text-[#111827]">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span><strong>Import the product</strong> — click &quot;Import Product&quot; on the right to add it straight to your ExiusCart store.</span>
                </li>
                {source_url && (
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    <span><strong>Order from supplier</strong> — use &quot;View Supplier Store&quot; when a customer orders it.</span>
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
                  {related.map((p) => <RelatedProductCard key={p.id} product={p} />)}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: sticky sidebar ── */}
          <div className="space-y-4 lg:sticky lg:top-20">
            {/* Product Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5 space-y-4">
              <h2 className="text-xl font-semibold text-[#111827]">Product Summary</h2>

              {winning_score != null && (
                <div className="flex items-center gap-3 bg-[#16A34A]/5 border border-[#16A34A]/20 rounded-xl p-3">
                  <div className="w-11 h-11 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0"><Trophy className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-[#6B7280]">Winning Score</p>
                    <p className="text-lg font-bold text-[#16A34A] leading-none">{winning_score}<span className="text-xs font-normal text-[#6B7280]">/100</span></p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5 text-sm">
                {cost_price != null && (
                  <div className="flex justify-between"><span className="text-[#6B7280]">Product Cost</span><span className="text-[#111827] font-medium">{fmt(cost_price)}</span></div>
                )}
                {shipping_cost != null && (
                  <div className="flex justify-between"><span className="text-[#6B7280]">Shipping Cost</span><span className="text-[#111827] font-medium">{fmt(shipping_cost)}</span></div>
                )}
                {totalCost != null && (
                  <div className="flex justify-between font-semibold border-t border-[#E5E7EB] pt-1.5"><span className="text-[#111827]">Total Cost</span><span className="text-[#111827]">{fmt(totalCost)}</span></div>
                )}
                <div className="flex justify-between pt-1"><span className="text-[#6B7280]">Selling Price</span><span className="text-[#111827] font-medium">{fmt(price)}</span></div>
                {profit != null && (
                  <div className="flex justify-between"><span className="text-[#6B7280]">Estimated Profit</span><span className="text-[#16A34A] font-semibold">{fmt(profit)}</span></div>
                )}
                {marginPct != null && (
                  <div className="flex justify-between"><span className="text-[#6B7280]">Profit Margin</span><span className="text-[#111827] font-medium">{marginPct}%</span></div>
                )}
              </div>

              {(supplier_name || warehouse_country || processing_time || shipping_time) && (
                <div className="space-y-1.5 text-sm border-t border-[#E5E7EB] pt-3">
                  {supplier_name && <div className="flex justify-between"><span className="text-[#6B7280]">Supplier</span><span className="text-[#111827] font-medium">{supplier_name}</span></div>}
                  {warehouse_country && <div className="flex justify-between"><span className="text-[#6B7280]">Warehouse</span><span className="text-[#111827] font-medium">{warehouse_country}</span></div>}
                  {processing_time && <div className="flex justify-between"><span className="text-[#6B7280]">Processing Time</span><span className="text-[#111827] font-medium">{processing_time}</span></div>}
                  {shipping_time && <div className="flex justify-between"><span className="text-[#6B7280]">Shipping Time</span><span className="text-[#111827] font-medium">{shipping_time}</span></div>}
                  {sku && <div className="flex justify-between"><span className="text-[#6B7280]">SKU</span><span className="text-[#111827] font-medium">{sku}</span></div>}
                </div>
              )}

              <div className="space-y-2 pt-1">
                {imported ? (
                  <a href={`https://store.exiuscart.com/dashboard/products?edit=${imported.product_id}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-[#16A34A] text-white active:scale-95 transition w-full">
                    <CheckCircle2 className="w-4 h-4" /> Added — Open in ExiusCart
                  </a>
                ) : (
                  <button type="button" onClick={handleImport} disabled={importing}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-[#2563EB] text-white hover:bg-[#1E4FC2] active:scale-95 transition w-full disabled:opacity-60">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
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

            {/* Demand Trend */}
            {demandTrend.length >= 2 && (
              <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
                <h2 className="text-sm font-semibold text-[#111827] mb-2 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[#2563EB]" /> Demand Trend</h2>
                <TrendChart data={demandTrend} />
              </div>
            )}

            {/* Top Countries */}
            {topCountries.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
                <h2 className="text-sm font-semibold text-[#111827] mb-3 flex items-center gap-1.5"><Globe2 className="w-4 h-4 text-[#2563EB]" /> Top Countries</h2>
                <div className="space-y-2.5">
                  {topCountries.map((c, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[#111827] font-medium">{flagEmoji(c.code)} {c.country}</span>
                        <span className="text-[#6B7280]">{c.percent}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${Math.min(100, c.percent)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {tagList.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
                <h2 className="text-sm font-semibold text-[#111827] mb-3">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {tagList.map((t) => (
                    <span key={t} className="text-xs text-[#111827] bg-gray-50 border border-[#E5E7EB] px-2.5 py-1 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="max-w-6xl mx-auto px-4 py-8 text-center text-xs text-[#6B7280]">
        © {new Date().getFullYear()} Fairam Private Limited &nbsp;·&nbsp; Prodora by ExiusCart
      </footer>
    </div>
  );
}
