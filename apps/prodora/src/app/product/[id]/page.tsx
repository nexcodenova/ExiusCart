'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Package, Tag, Download, ExternalLink, Play, Check, Copy,
  Loader2, CheckCircle2, TrendingUp, Users, Swords, Gauge, Store, Facebook, Instagram,
  Music2, ChevronRight, ChevronLeft, Trophy, Globe2, Truck, GalleryHorizontal, X,
  Wallet, Receipt, Coins, UserRound, MessageCircle, DollarSign, ShoppingCart, HelpCircle, Search,
} from 'lucide-react';
import { shoppingApi, Product, ShippingOption } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import CompetitionSection from '@/components/CompetitionSection';
import AudienceSection from '@/components/AudienceSection';
import TrendsSection from '@/components/TrendsSection';
import LoadingImage from '@/components/LoadingImage';
import DOMPurify from 'dompurify';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { CountryFlag } from '@/components/CountryFlag';
import { adLibraryKeyword, adLibrarySearchUrl, isAdLibrarySearchLink } from '@/lib/adLibrary';

// Common dropship destinations — enough to cover the markets Prodora sellers
// actually ship to; CJ's freight API accepts any ISO country code, this list
// just keeps the picker short instead of every country on earth.
const SHIP_COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'IN', name: 'India' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
];

function fmt(n: number) {
  return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function TrendChart({ data, color = '#2563EB', gradientId = 'trendGrad' }: { data: { label: string; value: number }[]; color?: string; gradientId?: string }) {
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
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill={color} />
      </svg>
      <div className="flex justify-between text-[10px] text-[#6B7280] mt-1">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}

const SATURATION_POSITION: Record<string, number> = { Low: 0.18, Medium: 0.5, High: 0.82 };

function SaturationGauge({ level }: { level: string }) {
  const t = SATURATION_POSITION[level] ?? 0.5;
  // Semi-circle gauge, 180°: angle 180 (left, green/low) to 0 (right, red/high).
  const cx = 100, cy = 95, r = 80;
  const angle = Math.PI - t * Math.PI;
  const nx = cx + r * 0.78 * Math.cos(angle);
  const ny = cy - r * 0.78 * Math.sin(angle);
  const bands = [
    { from: 180, to: 144, color: '#16A34A' },
    { from: 144, to: 108, color: '#84CC16' },
    { from: 108, to: 72, color: '#FACC15' },
    { from: 72, to: 36, color: '#F97316' },
    { from: 36, to: 0, color: '#DC2626' },
  ];
  const arcPoint = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[220px]">
        {bands.map((b, i) => {
          const [x1, y1] = arcPoint(b.from);
          const [x2, y2] = arcPoint(b.to);
          return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke={b.color} strokeWidth="14" strokeLinecap="butt" />;
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#111827" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="#111827" />
      </svg>
      <p className="text-sm font-semibold text-[#111827] -mt-2">{level}</p>
    </div>
  );
}

function ProfitCalculator({ sellingPrice, costPrice, shippingCost }: { sellingPrice: number; costPrice: number | null; shippingCost: number | null }) {
  const defaults = {
    price: sellingPrice,
    sales: 100,
    cost: costPrice ?? 0,
    shipping: shippingCost ?? 0,
    fees: Math.round(sellingPrice * 0.03 * 100) / 100, // a plain, disclosed estimate (payment-processing fees ~3%) — not pulled from any real transaction data
    ad: 0,
  };
  const [price, setPrice] = useState(defaults.price);
  const [sales, setSales] = useState(defaults.sales);
  const [cost, setCost] = useState(defaults.cost);
  const [shipping, setShipping] = useState(defaults.shipping);
  const [fees, setFees] = useState(defaults.fees);
  const [ad, setAd] = useState(defaults.ad);

  const reset = () => { setPrice(defaults.price); setSales(defaults.sales); setCost(defaults.cost); setShipping(defaults.shipping); setFees(defaults.fees); setAd(defaults.ad); };

  const preAdCost = cost + shipping + fees;
  const netProfit = price - preAdCost - ad;
  const potentialProfit = netProfit * sales;
  const marginPct = price > 0 ? (netProfit / price) * 100 : 0;
  const pcRatio = cost > 0 ? price / cost : null;
  const preAdProfit = price - preAdCost;
  const breakEvenRoas = preAdProfit > 0 ? price / preAdProfit : null;
  const targetRoas = ad > 0 ? price / ad : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[#111827]">Profit Calculator</h2>
        <button type="button" onClick={reset} className="text-sm font-medium text-[#2563EB] hover:underline">Reset</button>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        <div>
          <label className="text-sm text-[#6B7280] mb-1.5 flex items-center gap-1">Selling Price <span title="What this product sells for"><HelpCircle className="w-3.5 h-3.5 text-[#9CA3AF]" /></span></label>
          <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 mb-2">
            <span className="w-6 h-6 rounded-md bg-gray-100 text-[#6B7280] flex items-center justify-center shrink-0"><DollarSign className="w-3.5 h-3.5" /></span>
            <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full text-[#111827] font-medium outline-none" />
          </div>
          <input type="range" min="0" max="500" step="0.5" value={price} onChange={(e) => setPrice(parseFloat(e.target.value))} className="w-full accent-[#2563EB]" />
        </div>
        <div>
          <label className="text-sm text-[#6B7280] mb-1.5 flex items-center gap-1">Number of Sales <span title="How many units sold, to project total profit"><HelpCircle className="w-3.5 h-3.5 text-[#9CA3AF]" /></span></label>
          <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 mb-2">
            <span className="w-6 h-6 rounded-md bg-gray-100 text-[#6B7280] flex items-center justify-center shrink-0"><ShoppingCart className="w-3.5 h-3.5" /></span>
            <input type="number" step="1" min="0" value={sales} onChange={(e) => setSales(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full text-[#111827] font-medium outline-none" />
          </div>
          <input type="range" min="0" max="5000" step="10" value={sales} onChange={(e) => setSales(parseInt(e.target.value))} className="w-full accent-[#2563EB]" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-[#6B7280]">Net Profit per Sale</p>
          <p className={`text-lg font-bold mt-0.5 ${netProfit >= 0 ? 'text-[#111827]' : 'text-red-500'}`}>{fmt(netProfit)}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-3">
          <p className="text-xs text-[#6B7280]">Potential Profit</p>
          <p className={`text-lg font-bold mt-0.5 ${potentialProfit >= 0 ? 'text-[#2563EB]' : 'text-red-500'}`}>{fmt(potentialProfit)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Product Cost', value: cost, set: setCost, hint: 'What you pay the supplier per unit' },
          { label: 'Shipping Cost', value: shipping, set: setShipping, hint: 'Shipping cost per unit' },
          { label: 'Est. Other Fees', value: fees, set: setFees, hint: 'Payment processing, packaging, etc.' },
          { label: 'Ad Spend (AS)', value: ad, set: setAd, hint: 'Ad cost per sale, if any' },
        ].map((f) => (
          <div key={f.label}>
            <label className="text-xs text-[#6B7280] mb-1 flex items-center gap-1">{f.label} <span title={f.hint}><HelpCircle className="w-3 h-3 text-[#9CA3AF]" /></span></label>
            <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-2 py-1.5">
              <span className="w-5 h-5 rounded bg-gray-100 text-[#6B7280] flex items-center justify-center shrink-0"><DollarSign className="w-3 h-3" /></span>
              <input type="number" step="0.01" min="0" value={f.value} onChange={(e) => f.set(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full text-sm text-[#111827] outline-none min-w-0" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        {[
          { label: 'Profit Margin', value: `${marginPct.toFixed(0)}%`, hint: 'Net profit as a share of selling price' },
          { label: 'P/C Ratio', value: pcRatio != null ? `${pcRatio.toFixed(0)}X` : '—', hint: 'Selling price divided by product cost' },
          { label: 'Break-Even ROAS', value: breakEvenRoas != null ? breakEvenRoas.toFixed(2) : '—', hint: 'Minimum ad return needed before ad spend erases the profit' },
          { label: 'Target ROAS', value: targetRoas != null ? targetRoas.toFixed(2) : '—', hint: 'Selling price divided by Ad Spend — set Ad Spend above to see it' },
        ].map((r) => (
          <div key={r.label} className="rounded-xl border border-[#E5E7EB] p-2.5">
            <p className="text-xs text-[#6B7280] flex items-center justify-center gap-1">{r.label} <span title={r.hint}><HelpCircle className="w-3 h-3 text-[#9CA3AF]" /></span></p>
            <p className="text-sm font-bold text-[#111827] mt-0.5">{r.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[#9CA3AF]">Est. Other Fees is a plain 3% estimate, not a measured figure. Everything here is editable.</p>
    </div>
  );
}

function RelatedProductCard({ product }: { product: Product }) {
  const profit = product.cost_price != null ? product.price - product.cost_price : null;
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(!!product.imported_product_id);

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

function ProductDetailContent() {
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
  const [showLightbox, setShowLightbox] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [supportPhotoFailed, setSupportPhotoFailed] = useState(false);
  // Facebook/Instagram ad URLs are real Meta Ad Library snapshot pages —
  // embeddable in an iframe (that's how ad-research tools show them) — so
  // these play inline instead of opening Meta's site in a new tab. TikTok/
  // Pinterest links aren't Meta snapshot pages, so those stay external.
  const [expandedAd, setExpandedAd] = useState<string | null>(null);

  // Live per-country shipping cost, via CJ's freight-calculate API — only
  // available for products with a captured CJ supplier link (see
  // shopping.py: shopping_shipping_estimate). Falls back to the admin's
  // flat shipping_cost estimate when unavailable, so the summary never
  // shows nothing.
  const [shipCountry, setShipCountry] = useState('US');
  const [shipOptions, setShipOptions] = useState<ShippingOption[] | null>(null);
  const [shipLoading, setShipLoading] = useState(false);
  const [shipUnavailable, setShipUnavailable] = useState(false);
  const [shipReason, setShipReason] = useState('');

  const productId = Number(params.id);

  useEffect(() => {
    if (!productId || isNaN(productId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    shoppingApi
      .getProduct(productId)
      .then((p) => { setProduct(p); setActiveImg(0); setImported(p.imported_product_id ? { product_id: p.imported_product_id } : null); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    shoppingApi.getRelatedProducts(productId).then(setRelated).catch(() => setRelated([]));
  }, [productId]);

  useEffect(() => {
    if (!productId || isNaN(productId)) return;
    setShipLoading(true);
    setShipUnavailable(false);
    setShipReason('');
    shoppingApi.getShippingEstimate(productId, shipCountry)
      .then((res) => setShipOptions(res.options))
      .catch((err) => {
        setShipOptions(null);
        setShipUnavailable(true);
        const d = err?.response?.data?.detail;
        setShipReason(typeof d === 'string' ? d : '');
      })
      .finally(() => setShipLoading(false));
  }, [productId, shipCountry]);

  const cheapestShipOption = shipOptions && shipOptions.length > 0
    ? [...shipOptions].sort((a, b) => a.price - b.price)[0]
    : null;

  const handleCopyLink = async () => {
    try {
      // Always this Prodora page's own URL — never the supplier's source link,
      // which would expose who we source from.
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
        <Sidebar />
        <main className="app-main pt-12">
          <div className="bg-white border-b border-[#E5E7EB] px-4 py-3">
            <div className="max-w-[1400px] mx-auto h-5 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 animate-pulse grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 aspect-square bg-gray-100 rounded-2xl" />
            <div className="space-y-4">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-40 bg-gray-100 rounded" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <Sidebar />
        <main className="app-main pt-12 flex flex-col items-center justify-center gap-5 px-4 text-center min-h-screen">
          <Package className="w-16 h-16 text-gray-300" />
          <h1 className="text-2xl font-bold text-[#111827]">Product not found</h1>
          <p className="text-[#6B7280]">This product may have been removed or doesn&apos;t exist.</p>
          <Link href="/browse" className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1E4FC2] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Prodora
          </Link>
        </main>
      </div>
    );
  }

  const { name, price, cost_price, discount_pct, image_url, images, video_url, videos, source_url,
    is_trending, is_featured, category_name, description, sku, variants,
    winning_score, trend_percent, competition_level, saturation_level, orders_count,
    supplier_name, supplier_rating, fulfillment_rate, processing_time, shipping_time,
    warehouse_country, shipping_cost, demand_trend_json, orders_trend_json, top_countries_json,
    ad_facebook_url, ad_tiktok_url, ad_instagram_url, ad_pinterest_url, amazon_url, ebay_url, specs_json, tags, created_at } = product;

  const gallery = images && images.length > 0 ? images : (image_url ? [image_url] : []);
  const activeImage = gallery[activeImg] || gallery[0];

  const tagList = (tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  let specs: [string, string][] = [];
  try { specs = specs_json ? Object.entries(JSON.parse(specs_json)) : []; } catch { specs = []; }
  let demandTrend: { label: string; value: number }[] = [];
  try { demandTrend = demand_trend_json ? JSON.parse(demand_trend_json) : []; } catch { demandTrend = []; }
  let ordersTrend: { label: string; value: number }[] = [];
  try { ordersTrend = orders_trend_json ? JSON.parse(orders_trend_json) : []; } catch { ordersTrend = []; }
  let topCountries: { country: string; code: string; percent: number }[] = [];
  try { topCountries = top_countries_json ? JSON.parse(top_countries_json) : []; } catch { topCountries = []; }

  // Live per-country quote wins when available; otherwise fall back to the
  // admin-entered flat estimate rather than showing nothing.
  const effectiveShippingCost = cheapestShipOption ? cheapestShipOption.price : shipping_cost;
  const totalCost = cost_price != null ? cost_price + (effectiveShippingCost || 0) : null;
  const profit = totalCost != null ? price - totalCost : null;
  const marginPct = profit != null && price > 0 ? Math.round((profit / price) * 100) : null;

  const hasVideo = (videos && videos.length > 0) || !!video_url;
  const hasWinningAnalytics = winning_score != null || trend_percent != null || competition_level || saturation_level || orders_count != null;
  const hasSidebarContent = topCountries.length > 0 || tagList.length > 0;
  const adPlatforms = [
    { key: 'facebook', label: isAdLibrarySearchLink(ad_facebook_url) ? 'All Facebook ads' : 'Facebook ad', url: ad_facebook_url, icon: Facebook },
    { key: 'instagram', label: isAdLibrarySearchLink(ad_instagram_url) ? 'All Instagram ads' : 'Instagram ad', url: ad_instagram_url, icon: Instagram },
    { key: 'tiktok', label: 'TikTok Videos', url: ad_tiktok_url, icon: Music2 },
    { key: 'pinterest', label: 'Pinterest Pins', url: ad_pinterest_url, icon: Tag },
  ].filter((p) => p.url);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <main className="app-main pt-12">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 whitespace-nowrap text-sm text-[#6B7280]">
          <button onClick={() => router.back()} className="flex shrink-0 items-center gap-1.5 hover:text-[#2563EB] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="hidden sm:inline">/</span>
          <Link href="/browse" className="hidden sm:inline hover:text-[#2563EB] transition-colors">Winning Products</Link>
          {category_name && <><span className="hidden md:inline">/</span><span className="hidden md:inline text-gray-400">{category_name}</span></>}
          <span>/</span>
          <span className="min-w-0 flex-1 truncate text-[#111827] sm:max-w-[200px] sm:flex-none">{name}</span>
          {created_at && (
            <span className="hidden sm:inline-flex ml-auto shrink-0 items-center px-2.5 py-1 rounded-full bg-gray-50 border border-[#E5E7EB] text-xs text-[#6B7280]">
              Added to Prodora: {new Date(created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {importError && (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-3">
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{importError}</p>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className={`grid gap-5 items-start ${hasSidebarContent ? 'lg:grid-cols-3' : ''}`}>

          {/* ── Left: main content ── */}
          <div className={`space-y-4 ${hasSidebarContent ? 'lg:col-span-2' : ''}`}>
            {/* Gallery + basic info */}
            <div className="relative bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
              <div className="p-4 md:p-5 pb-16 sm:pb-5 grid lg:grid-cols-2 gap-5 items-start">
                <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="relative bg-gray-50 group rounded-xl overflow-hidden flex-1" style={{ minHeight: '340px' }}>
                    {activeImage ? (
                      <LoadingImage src={activeImage} alt={name} className="object-cover" sizes="(max-width: 1024px) 100vw, 60vw" priority />
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

                    {((videos && videos.length > 0) || video_url) && (
                      <a href="#video" className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-semibold rounded-lg backdrop-blur transition">
                        <Play className="w-3.5 h-3.5" /> Watch Video{videos && videos.length > 1 ? `s (${videos.length})` : ''}
                      </a>
                    )}

                    {activeImage && (
                      <div className="absolute bottom-3 right-3 flex gap-2 z-10">
                        {gallery.length > 1 && (
                          <button type="button" onClick={() => setShowLightbox(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-semibold rounded-lg backdrop-blur transition">
                            <GalleryHorizontal className="w-3.5 h-3.5" /> View all {gallery.length} photos
                          </button>
                        )}
                        <a href={activeImage} download target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-semibold rounded-lg backdrop-blur transition">
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail rail — vertical, to the right of the main image */}
                  {gallery.length > 1 && (
                    <div className="flex flex-col gap-2 w-16 sm:w-20 shrink-0 overflow-y-auto pr-0.5" style={{ maxHeight: '420px' }}>
                      {gallery.slice(0, 5).map((img, i) => (
                        <button key={i} onClick={() => setActiveImg(i)}
                          className={`relative w-full aspect-square rounded-lg overflow-hidden border-2 shrink-0 transition ${i === activeImg ? 'border-[#2563EB]' : 'border-[#E5E7EB]'}`}>
                          <Image src={img} alt="" fill className="object-cover" />
                        </button>
                      ))}
                      {gallery.length > 5 && (
                        <button type="button" onClick={() => setShowLightbox(true)}
                          className="relative w-full aspect-square rounded-lg overflow-hidden border-2 border-[#E5E7EB] shrink-0 transition hover:border-[#2563EB]">
                          <Image src={gallery[5]} alt="" fill className="object-cover" />
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                            +{gallery.length - 5}
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {variants && variants.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-[#6B7280] mb-1.5">Variants</p>
                    <div className="flex flex-wrap gap-2 max-h-[76px] overflow-y-auto pr-1">
                      {variants.map((v, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-[#111827] shrink-0">
                          {v.color_hex && <span className="w-3 h-3 rounded-full border border-[#E5E7EB]" style={{ background: v.color_hex }} />}
                          {v.color}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                </div>

              <div className="space-y-3">
                {category_name && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    <Tag className="w-3 h-3" /> {category_name}
                  </span>
                )}
                <h1 className="text-xl sm:text-2xl font-bold text-[#111827] leading-tight">{name}</h1>

                {description && (
                  <p className="text-sm text-[#6B7280] line-clamp-2">
                    {description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}{' '}
                    <a href="#description" className="font-medium text-[#2563EB] hover:underline whitespace-nowrap">View more</a>
                  </p>
                )}

                {winning_score != null && (
                  <div className="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] text-sm font-semibold">
                    <Trophy className="w-4 h-4" /> Winning Score {winning_score}/100
                  </div>
                )}

                {/* Cost / Price / Profit — no supplier name or outbound links here, just the real numbers */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="rounded-xl border border-[#E5E7EB] p-3">
                    <p className="text-xs text-[#6B7280] flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0"><Wallet className="w-3 h-3" /></span> Product Cost</p>
                    <p className="text-lg font-bold text-[#111827] mt-1">{cost_price != null ? fmt(cost_price) : '—'}</p>
                  </div>
                  <div className="rounded-xl border border-[#E5E7EB] p-3">
                    <p className="text-xs text-[#6B7280] flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0"><Receipt className="w-3 h-3" /></span> Selling Price</p>
                    <p className="text-lg font-bold text-[#111827] mt-1">{fmt(price)}</p>
                  </div>
                  <div className="rounded-xl border border-[#16A34A]/20 bg-[#16A34A]/5 p-3">
                    <p className="text-xs text-[#6B7280] flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center shrink-0"><Coins className="w-3 h-3" /></span> Profit per Sale</p>
                    <p className={`text-lg font-bold mt-1 ${profit != null && profit >= 0 ? 'text-[#16A34A]' : 'text-red-500'}`}>{profit != null ? fmt(profit) : '—'}</p>
                  </div>
                </div>

                {/* Research buttons, always shown: Amazon and eBay (the admin's exact listing when pasted, else a
                    live search for the product's short keyword), Google Trends, TikTok, Facebook Ads, and
                    Product videos (this product's own video, else real videos of it on YouTube). */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {([
                    { key: 'amazon', label: 'Amazon', href: amazon_url || `https://www.amazon.com/s?k=${encodeURIComponent(adLibraryKeyword(name))}`, hover: 'hover:bg-[#FF9900]/10 hover:border-[#FF9900]/40', icon: '/marketplace-icons/amazon-icon.svg' },
                    { key: 'ebay', label: 'eBay', href: ebay_url || `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(adLibraryKeyword(name))}`, hover: 'hover:bg-[#0064D2]/10 hover:border-[#0064D2]/40', icon: '/marketplace-icons/ebay-wordmark.svg', wide: true },
                    { key: 'trends', label: 'Google Trends', href: `https://trends.google.com/trends/explore?date=today%205-y&q=${encodeURIComponent(adLibraryKeyword(name))}`, hover: 'hover:bg-[#4285F4]/10 hover:border-[#4285F4]/40', icon: '/marketplace-icons/google.svg' },
                    { key: 'tiktok', label: 'TikTok videos', href: `https://www.tiktok.com/search?q=${encodeURIComponent(adLibraryKeyword(name))}`, hover: 'hover:bg-[#111827]/[0.06] hover:border-[#111827]/30', icon: '/marketplace-icons/tiktok.svg' },
                    { key: 'facebook', label: 'Facebook Ads', href: adLibrarySearchUrl(adLibraryKeyword(name)), hover: 'hover:bg-[#1877F2]/10 hover:border-[#1877F2]/40', icon: '/marketplace-icons/facebook-2023.svg' },
                    { key: 'video', label: 'Product videos', href: hasVideo ? '#video' : `https://www.youtube.com/results?search_query=${encodeURIComponent(adLibraryKeyword(name) + ' review')}`, hover: 'hover:bg-[#FF0000]/10 hover:border-[#FF0000]/40', icon: '/marketplace-icons/youtube.svg', internal: hasVideo },
                  ] as { key: string; label: string; href: string; hover: string; icon: string; wide?: boolean; internal?: boolean }[]).map((b) => (
                    <a key={b.key} href={b.href} {...(b.internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                      className={`flex items-center gap-2.5 rounded-lg border border-[#E5E7EB] bg-transparent p-1.5 pr-3 text-sm font-semibold text-[#111827] transition ${b.hover}`}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.icon} alt="" className={b.wide ? 'h-3 w-auto max-w-[26px]' : 'h-[18px] w-[18px] object-contain'} />
                      </span>
                      <span className="flex-1 text-left">{b.label}</span>
                      {!b.internal && <ExternalLink className="h-3 w-3 text-[#9CA3AF]" />}
                    </a>
                  ))}
                </div>
              </div>
              </div>

              {/* Import CTA — pinned to the bottom-right corner of the hero section itself, light pill with the
                  logo in its own white badge (same pattern as a "Continue with Google/Facebook" button) */}
              {imported ? (
                <a href={`https://store.exiuscart.com/dashboard/products?edit=${imported.product_id}`} target="_blank" rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 shrink-0 inline-flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-[#16A34A]/10 border border-[#16A34A]/20 text-[#15803D] text-sm font-semibold hover:bg-[#16A34A]/15 transition shadow-sm">
                  <span className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0"><CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" /></span>
                  Imported · Open in store
                </a>
              ) : (
                <button type="button" onClick={handleImport} disabled={importing}
                  className="absolute bottom-3 right-3 shrink-0 inline-flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[#111827] text-sm font-semibold hover:bg-blue-100 transition disabled:opacity-60 shadow-sm">
                  <span className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                    {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Image src="/exiuscart-logo.png" alt="" width={16} height={16} />}
                  </span>
                  {importing ? 'Adding…' : 'Import to ExiusCart'}
                </button>
              )}
            </div>

            {/* Need help? — same real WhatsApp support card as the researcher-help banner on the Prodora AI page
                (src/components/PageIntro.tsx): same photo, same number, same fallback if the photo fails to load. */}
            <a
              href={`https://wa.me/971562393573?text=${encodeURIComponent(`Hi, I'd like help deciding on this Prodora product: ${name}`)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5 hover:border-[#2563EB]/40 transition"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-600">
                {supportPhotoFailed ? (
                  <UserRound className="h-5 w-5" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/support/support_2.jpg" alt="" className="h-full w-full object-cover" onError={() => setSupportPhotoFailed(true)} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#111827]">Need help choosing products?</p>
                <p className="text-sm text-[#6B7280] flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Contact our ecommerce researcher</p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-semibold">
                Chat now
              </span>
            </a>

            {/* Google Trends results on the page (no click needed) and who to target with ads */}
            <TrendsSection productId={productId} />
            <AudienceSection productId={productId} />

            {/* Description — moved out of the hero so it doesn't compete with the buy decision; text on the
                left, gallery photos on the right */}
            {description && (
              <div id="description" className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5 scroll-mt-20">
                <h2 className="text-xl font-semibold text-[#111827] mb-3">Description</h2>
                <div className={`grid gap-4 ${gallery.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                  <div>
                    <div
                      className={`text-[#6B7280] text-[15px] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ${showFullDescription ? '' : 'line-clamp-6'}`}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description) }}
                    />
                    <button type="button" onClick={() => setShowFullDescription((v) => !v)}
                      className="mt-2 text-sm font-medium text-[#2563EB] hover:underline">
                      {showFullDescription ? 'Show less' : 'View more'}
                    </button>
                  </div>
                  {gallery.length > 1 && (
                    <div className="flex flex-col gap-3">
                      {gallery.slice(0, showFullDescription ? gallery.length : 1).map((img, i) => (
                        <button key={i} type="button" onClick={() => { setActiveImg(i); setShowLightbox(true); }}
                          className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-[#E5E7EB] hover:border-[#2563EB] transition bg-gray-50">
                          <Image src={img} alt="" fill className="object-contain" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Supplier & Shipping — kept out of the hero on purpose; this is the one place supplier identity shows */}
            {(supplier_name || effectiveShippingCost != null) && (
              <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
                <h2 className="text-xl font-semibold text-[#111827] mb-4 flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#2563EB]" /> Supplier &amp; Shipping
                </h2>

                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-medium text-[#6B7280] flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Ship to
                  </label>
                  <Select value={shipCountry} onValueChange={setShipCountry}>
                    <SelectTrigger className="h-9 w-56 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIP_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}><span className="inline-flex items-center gap-2"><CountryFlag code={c.code} />{c.name}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {shipLoading ? (
                  <div className="flex items-center gap-2 text-xs text-[#6B7280] py-1 mb-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Getting live shipping rates…</div>
                ) : shipOptions && shipOptions.length > 0 ? (
                  <div className="space-y-1 rounded-lg bg-gray-50 border border-[#E5E7EB] p-2.5 mb-3">
                    {shipOptions.map((opt, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-[#111827]">{opt.logistic_name}{opt.days ? ` · ${opt.days}` : ''}</span>
                        <span className={cheapestShipOption === opt ? 'font-semibold text-[#16A34A]' : 'text-[#6B7280]'}>{fmt(opt.price)}</span>
                      </div>
                    ))}
                  </div>
                ) : shipUnavailable && shipping_cost != null ? (
                  <p className="text-xs text-[#6B7280] mb-3">{shipReason ? `${shipReason} ` : 'Live rates are unavailable for this product. '}Showing the estimated flat shipping cost below.</p>
                ) : shipUnavailable ? (
                  <p className="text-xs text-[#6B7280] mb-3">{shipReason || 'No shipping estimate is available for this product.'}</p>
                ) : null}

                {totalCost != null && (
                  <div className="flex justify-between text-sm font-semibold border-t border-b border-[#E5E7EB] py-2 mb-4">
                    <span className="text-[#111827]">Total Cost (product + shipping)</span><span className="text-[#111827]">{fmt(totalCost)}</span>
                  </div>
                )}

                {supplier_name && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-4">
                      <div><p className="text-xs text-[#6B7280]">Supplier</p><p className="text-[#111827] font-medium mt-0.5">{supplier_name}</p></div>
                      {supplier_rating != null && <div><p className="text-xs text-[#6B7280]">Rating</p><p className="text-[#111827] font-medium mt-0.5">⭐ {supplier_rating}</p></div>}
                      {fulfillment_rate != null && <div><p className="text-xs text-[#6B7280]">Fulfillment Rate</p><p className="text-[#111827] font-medium mt-0.5">{fulfillment_rate}%</p></div>}
                      {processing_time && <div><p className="text-xs text-[#6B7280]">Processing Time</p><p className="text-[#111827] font-medium mt-0.5">{processing_time}</p></div>}
                      {shipping_time && <div><p className="text-xs text-[#6B7280]">Shipping Time</p><p className="text-[#111827] font-medium mt-0.5">{shipping_time}</p></div>}
                      {warehouse_country && <div><p className="text-xs text-[#6B7280]">Warehouse</p><p className="text-[#111827] font-medium mt-0.5">{warehouse_country}</p></div>}
                      {sku && <div><p className="text-xs text-[#6B7280]">SKU</p><p className="text-[#111827] font-medium mt-0.5">{sku}</p></div>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {source_url && (
                        <a href={source_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] border border-[#2563EB]/30 rounded-lg px-3 py-2 hover:bg-[#2563EB]/5 transition">
                          <Store className="w-4 h-4" /> View Supplier Store
                        </a>
                      )}
                      <button type="button" onClick={handleCopyLink}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6B7280] border border-[#E5E7EB] rounded-lg px-3 py-2 hover:text-[#111827] hover:border-gray-300 transition">
                        {copied ? <Check className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Link copied!' : 'Product Link'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Videos */}
            {videos && videos.length > 0 ? (
              <div id="video" className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#2563EB]" />
                  <h2 className="text-xl font-semibold text-[#111827]">Product Video{videos.length > 1 ? 's' : ''}</h2>
                </div>
                <div className={`p-4 grid gap-4 ${videos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                  {videos.map((v, i) => (
                    <div key={i} className="rounded-xl overflow-hidden bg-black">
                      {v.embed_html ? (
                        <div className="aspect-[9/16] max-h-[420px] [&_iframe]:w-full [&_iframe]:h-full"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(v.embed_html, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'] }) }} />
                      ) : (
                        <a href={v.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-40 text-[#2563EB] hover:underline font-semibold bg-gray-50">
                          Open video in new tab →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : video_url && (
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

            {/* Market Saturation gauge — same admin-entered Low/Medium/High as the tile above, as a visual */}
            {saturation_level && (
              <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
                <h2 className="text-xl font-semibold text-[#111827] mb-2">Market Saturation</h2>
                <p className="text-sm text-[#6B7280] mb-3">How many stores already sell something like this, judged by our team — not a measured count.</p>
                <SaturationGauge level={saturation_level} />
              </div>
            )}

            {/* Profit Calculator — plain math, editable, defaults to this listing's real numbers */}
            <ProfitCalculator sellingPrice={price} costPrice={cost_price ?? null} shippingCost={effectiveShippingCost ?? null} />

            {/* Competition: real market prices, true profit and a verdict (Growth and Scale) */}
            <CompetitionSection productId={productId} />

            {/* Trends — Demand on the left, Orders (social proof) on the right */}
            {(demandTrend.length >= 2 || ordersTrend.length >= 2) && (
              <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
                <div className={`grid gap-6 ${demandTrend.length >= 2 && ordersTrend.length >= 2 ? 'sm:grid-cols-2' : ''}`}>
                  {demandTrend.length >= 2 && (
                    <div>
                      <h2 className="text-sm font-semibold text-[#111827] mb-2 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[#2563EB]" /> Demand Trend</h2>
                      <TrendChart data={demandTrend} color="#2563EB" gradientId="demandTrendGrad" />
                    </div>
                  )}
                  {ordersTrend.length >= 2 && (
                    <div className={demandTrend.length >= 2 ? 'sm:border-l sm:border-[#E5E7EB] sm:pl-6' : ''}>
                      <h2 className="text-sm font-semibold text-[#111827] mb-2 flex items-center gap-1.5"><Users className="w-4 h-4 text-[#16A34A]" /> Orders Trend</h2>
                      <TrendChart data={ordersTrend} color="#16A34A" gradientId="ordersTrendGrad" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: sticky sidebar — accompanies just the hero + analytics above; the rest of the page runs full width below ── */}
          <div className="space-y-4 lg:sticky lg:top-20">
            {/* Top Countries */}
            {topCountries.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
                <h2 className="text-sm font-semibold text-[#111827] mb-3 flex items-center gap-1.5"><Globe2 className="w-4 h-4 text-[#2563EB]" /> Top Countries</h2>
                <div className="space-y-2.5">
                  {topCountries.map((c, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="inline-flex items-center gap-2 text-[#111827] font-medium"><CountryFlag code={c.code} />{c.country}</span>
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

        {/* ── Below: full-width content, no sidebar constraint ── */}
        <div className="space-y-4 mt-4">
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

            {/* Social proof */}
            {/* Always shown: the Ad Library search below works for every product */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
              <h2 className="text-xl font-semibold text-[#111827] mb-3">See it in real ads</h2>
              {adPlatforms.length > 0 && <div className="grid sm:grid-cols-2 gap-3">
                {adPlatforms.map((p) => {
                  // Only the Meta API's ad snapshot can be shown inside the page;
                  // facebook.com refuses to load in an iframe, so Ad Library
                  // links open in a new tab.
                  const embeddable = !!p.url && p.url.includes('/ads/archive/render_ad');
                  const isOpen = expandedAd === p.key;
                  if (embeddable) {
                    return (
                      <button key={p.key} type="button" onClick={() => setExpandedAd(isOpen ? null : p.key)}
                        className="flex items-center gap-3 border border-[#E5E7EB] rounded-xl p-3 hover:border-[#2563EB]/40 transition text-left">
                        <div className="w-9 h-9 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0"><p.icon className="w-4 h-4" /></div>
                        <span className="text-sm font-medium text-[#111827] flex-1">{p.label}</span>
                        <Play className="w-4 h-4 text-[#6B7280]" />
                      </button>
                    );
                  }
                  return (
                    <a key={p.key} href={p.url!} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 border border-[#E5E7EB] rounded-xl p-3 hover:border-[#2563EB]/40 transition">
                      <div className="w-9 h-9 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0"><p.icon className="w-4 h-4" /></div>
                      <span className="text-sm font-medium text-[#111827] flex-1">{p.label}</span>
                      <ExternalLink className="w-4 h-4 text-[#6B7280]" />
                    </a>
                  );
                })}
              </div>}

              {expandedAd && (() => {
                const active = adPlatforms.find((p) => p.key === expandedAd);
                if (!active) return null;
                return (
                  <div className="mt-4 rounded-xl border border-[#E5E7EB] overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-[#F8FAFC] border-b border-[#E5E7EB]">
                      <p className="text-xs font-medium text-[#6B7280]">{active.label} — live from Meta</p>
                      <button onClick={() => setExpandedAd(null)} className="text-[#6B7280] hover:text-[#111827]"><X className="w-4 h-4" /></button>
                    </div>
                    <iframe src={active.url!} className="w-full h-[600px]" title={`${active.label} preview`} />
                  </div>
                );
              })()}

              <a href={adLibrarySearchUrl(adLibraryKeyword(name))} target="_blank" rel="noopener noreferrer"
                className={`${adPlatforms.length > 0 ? 'mt-3' : ''} flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#2563EB]/40 bg-[#2563EB]/5 px-3 py-2.5 text-sm font-medium text-[#2563EB] hover:bg-[#2563EB]/10 transition`}>
                <Search className="w-4 h-4" /> Find more ads for &ldquo;{adLibraryKeyword(name)}&rdquo; on Meta Ad Library
              </a>

              <div className="mt-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] p-4">
                <p className="text-sm font-semibold text-[#111827] mb-2">How to read the ads</p>
                <ul className="space-y-1.5 text-sm text-[#4B5563]">
                  <li><span className="font-medium text-[#111827]">&ldquo;Started running on&rdquo; 1–3+ months ago</span> — the ad is still paying for itself, a strong sign.</li>
                  <li><span className="font-medium text-[#111827]">Many different stores</span> selling it — demand is proven.</li>
                  <li><span className="font-medium text-[#111827]">&ldquo;Multiple versions&rdquo;</span> — the seller is testing and scaling it.</li>
                  <li><span className="font-medium text-[#111827]">Only 1–2 ads, all started this week</span> — not proven yet, test carefully.</li>
                </ul>
              </div>
            </div>

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
      </div>

      <footer className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 text-center text-xs text-[#6B7280]">
        © {new Date().getFullYear()} Fairam Private Limited &nbsp;·&nbsp; Prodora by ExiusCart
      </footer>
      </main>

      {/* Photo lightbox — every image, full view with prev/next */}
      {showLightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setShowLightbox(false)}>
          <div className="flex items-center justify-between px-4 py-3 text-white text-sm">
            <span>{activeImg + 1} / {gallery.length}</span>
            <button type="button" onClick={() => setShowLightbox(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative flex-1 flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
            {gallery.length > 1 && (
              <button type="button" onClick={() => setActiveImg((i) => (i - 1 + gallery.length) % gallery.length)}
                className="absolute left-2 sm:left-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-white z-10">
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <div className="relative w-full h-full max-w-4xl">
              <Image src={gallery[activeImg]} alt={name} fill className="object-contain" sizes="100vw" />
            </div>
            {gallery.length > 1 && (
              <button type="button" onClick={() => setActiveImg((i) => (i + 1) % gallery.length)}
                className="absolute right-2 sm:right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-white z-10">
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2 px-4 py-3 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
              {gallery.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition ${i === activeImg ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                  <Image src={img} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={null}>
      <ProductDetailContent />
    </Suspense>
  );
}
