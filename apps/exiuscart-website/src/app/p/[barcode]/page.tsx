import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Package, AlertCircle, CheckCircle2, Clock, ShoppingBag } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

interface ProductInfo {
  name: string;
  sku: string;
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
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ProductInfoPage({ params }: { params: { barcode: string } }) {
  const product = await getProduct(params.barcode);
  if (!product) notFound();

  const stockStatus =
    product.available === 0
      ? { label: 'Out of Stock', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', icon: AlertCircle }
      : product.available <= 5
      ? { label: 'Low Stock', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20', icon: AlertCircle }
      : { label: 'In Stock', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20', icon: CheckCircle2 };

  const StatusIcon = stockStatus.icon;

  return (
    <div className="min-h-screen bg-[#0B1121] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-gray-500 text-xs mb-1">Product Information</p>
          <p className="text-gray-400 text-xs">{product.shop_name}</p>
        </div>

        {/* Product Card */}
        <div className="bg-[#151F32] border border-gray-800 rounded-2xl overflow-hidden">
          {/* Image */}
          {product.image_url ? (
            <div className="w-full aspect-square bg-[#0D1526] relative">
              <Image src={product.image_url} alt={product.name} fill className="object-contain p-4" />
            </div>
          ) : (
            <div className="w-full aspect-square bg-[#0D1526] flex items-center justify-center">
              <Package className="w-16 h-16 text-gray-700" />
            </div>
          )}

          {/* Details */}
          <div className="p-5">
            {product.category && (
              <p className="text-xs text-[#7B4FE9] font-medium mb-1">{product.category}</p>
            )}
            <h1 className="text-xl font-bold text-white mb-1">{product.name}</h1>
            {product.sku && (
              <p className="text-xs text-gray-500 mb-3">SKU: {product.sku}</p>
            )}

            {/* Price */}
            <p className="text-3xl font-black text-white mb-4">
              {product.currency} {product.price.toFixed(2)}
            </p>

            {/* Stock status badge */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium mb-4 ${stockStatus.bg} ${stockStatus.color}`}>
              <StatusIcon className="w-4 h-4 flex-shrink-0" />
              {stockStatus.label}
            </div>

            {/* Stock breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between py-2.5 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400 text-sm">Total Stock</span>
                </div>
                <span className="text-white font-semibold">{product.stock}</span>
              </div>

              <div className="flex items-center justify-between py-2.5 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className="text-gray-400 text-sm">Reserved</span>
                </div>
                <span className={`font-semibold ${product.reserved > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {product.reserved}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-gray-400 text-sm">Available</span>
                </div>
                <span className={`font-semibold text-lg ${product.available > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {product.available}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Barcode */}
        <p className="text-center text-gray-700 text-xs mt-4 font-mono">{product.barcode}</p>
        <p className="text-center text-gray-700 text-xs mt-1">Powered by ExiusCart</p>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { barcode: string } }) {
  const product = await getProduct(params.barcode);
  return {
    title: product ? `${product.name} — ${product.shop_name}` : 'Product Info',
  };
}
