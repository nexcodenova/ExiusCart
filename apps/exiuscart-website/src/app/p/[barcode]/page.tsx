import { notFound } from 'next/navigation';
import { Package, Tag, BarChart3, BookmarkCheck, CheckCircle2, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

interface ProductInfo {
  name: string;
  sku: string | null;
  barcode: string;
  price: number;
  currency: string;
  stock: number;
  reserved: number;
  available: number;
  shop_name: string;
  image_url: string | null;
  category: string | null;
}

async function getProduct(barcode: string): Promise<ProductInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/product/${barcode}`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ProductPublicPage({ params }: { params: { barcode: string } }) {
  const p = await getProduct(params.barcode);
  if (!p) notFound();

  const stockPct = p.stock > 0 ? Math.round((p.available / p.stock) * 100) : 0;
  const isLow = p.available > 0 && p.available <= 3;
  const isOut = p.available === 0;

  return (
    <div className="min-h-screen bg-[#0B1121] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-gray-500 text-xs mb-1">{p.shop_name}</p>
          <p className="text-gray-600 text-[10px] font-mono">{p.barcode}</p>
        </div>

        {/* Product card */}
        <div className="bg-[#151F32] border border-gray-800 rounded-2xl overflow-hidden">

          {/* Image or icon */}
          {p.image_url ? (
            <div className="w-full aspect-square bg-[#0D1526] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-full h-32 bg-[#0D1526] flex items-center justify-center">
              <Package className="w-10 h-10 text-gray-700" />
            </div>
          )}

          <div className="p-5">
            {/* Category */}
            {p.category && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#7B4FE9] mb-1">{p.category}</p>
            )}

            {/* Name + price */}
            <h1 className="text-white font-black text-xl leading-tight mb-1">{p.name}</h1>
            <p className="text-2xl font-black text-[#7B4FE9] mb-1">
              {p.currency} {p.price.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
            </p>
            {p.sku && (
              <div className="flex items-center gap-1 mb-4">
                <Tag className="w-3 h-3 text-gray-600" />
                <p className="text-[11px] text-gray-500 font-mono">SKU: {p.sku}</p>
              </div>
            )}

            <div className="border-t border-gray-800 pt-4">

              {/* Availability badge */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-4 ${
                isOut  ? 'bg-red-500/10 border border-red-500/20' :
                isLow  ? 'bg-orange-500/10 border border-orange-500/20' :
                         'bg-green-500/10 border border-green-500/20'
              }`}>
                {isOut
                  ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  : <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${isLow ? 'text-orange-400' : 'text-green-400'}`} />
                }
                <p className={`text-sm font-semibold ${
                  isOut ? 'text-red-400' : isLow ? 'text-orange-400' : 'text-green-400'
                }`}>
                  {isOut ? 'Out of Stock' : isLow ? `Only ${p.available} left` : 'In Stock'}
                </p>
              </div>

              {/* Stock breakdown */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-[#0D1526] rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-white">{p.stock}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Total Stock</p>
                </div>
                <div className="bg-[#0D1526] rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-yellow-400">{p.reserved}</p>
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    <BookmarkCheck className="w-2.5 h-2.5 text-yellow-500" />
                    <p className="text-[10px] text-gray-500">Reserved</p>
                  </div>
                </div>
                <div className="bg-[#0D1526] rounded-xl p-3 text-center">
                  <p className={`text-xl font-black ${isOut ? 'text-red-400' : isLow ? 'text-orange-400' : 'text-green-400'}`}>
                    {p.available}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Available</p>
                </div>
              </div>

              {/* Stock bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3 text-gray-600" />
                    <p className="text-[10px] text-gray-500">Stock level</p>
                  </div>
                  <p className="text-[10px] text-gray-500">{stockPct}% available</p>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  {p.reserved > 0 && (
                    <div
                      className="h-full bg-yellow-500/60 float-left"
                      style={{ width: `${Math.round((p.reserved / p.stock) * 100)}%` }}
                    />
                  )}
                  <div
                    className={`h-full float-left ${isOut ? 'bg-red-500' : isLow ? 'bg-orange-400' : 'bg-green-500'}`}
                    style={{ width: `${stockPct}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  {p.reserved > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                      <p className="text-[9px] text-gray-600">Reserved</p>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${isOut ? 'bg-red-500' : isLow ? 'bg-orange-400' : 'bg-green-500'}`} />
                    <p className="text-[9px] text-gray-600">Available</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-700 text-xs mt-4">Powered by ExiusCart</p>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { barcode: string } }) {
  const p = await getProduct(params.barcode);
  return {
    title: p ? `${p.name} — ${p.shop_name}` : 'Product Info',
  };
}
