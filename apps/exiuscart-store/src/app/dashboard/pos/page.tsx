'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Search, Plus, Minus, Trash2, X, CreditCard, Banknote, Percent,
  Receipt, Printer, Check, ShoppingCart, Package,
  User, Download, Scan, Zap, Loader2, Camera,
} from 'lucide-react';
import { generateInvoicePDF, generateThermalReceipt } from '@/lib/invoice-generator';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { CameraScanner } from '@/components/ui/camera-scanner';
import { productsApi, shopApi, ordersApi, subscriptionApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface POSProduct {
  id: string;
  name: string;
  sellingPrice: number;
  stock: number;
  category: string;
  barcode?: string;
  sku: string;
  image?: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  maxStock: number;
}

interface ShopData {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  vatNumber: string;
  tradeLicense: string;
  vatEnabled: boolean;
  vatRate: number;
  pricesIncludeVat: boolean;
  showVatBreakdown: boolean;
}

export default function POSPage() {
  const { sym, currency } = useCurrency();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [barcodeFlash, setBarcodeFlash] = useState<string | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<POSProduct | null>(null);
  const [orderLimitError, setOrderLimitError] = useState<{ used: number; limit: number } | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [orderUsage, setOrderUsage] = useState<{ used: number; limit: number } | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [shopData, setShopData] = useState<ShopData | null>(null);

  const shopVatSettings = shopData
    ? {
        vatEnabled: shopData.vatEnabled,
        vatRate: shopData.vatRate,
        pricesIncludeVat: shopData.pricesIncludeVat,
        showVatBreakdown: shopData.showVatBreakdown,
      }
    : { vatEnabled: false, vatRate: 0, pricesIncludeVat: false, showVatBreakdown: false };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const shopRes = await shopApi.getMyShop();
        const shop = shopRes.data;
        setShopData({
          id: String(shop.id),
          name: shop.name || '',
          address: shop.address || '',
          phone: shop.phone || '',
          email: shop.email || '',
          vatNumber: shop.vat_number || '',
          tradeLicense: shop.trade_license || '',
          vatEnabled: shop.vat_enabled ?? false,
          vatRate: shop.vat_rate ?? 0,
          pricesIncludeVat: shop.prices_include_vat ?? false,
          showVatBreakdown: shop.show_vat_breakdown ?? false,
        });
        const productsRes = await productsApi.getAll(String(shop.id));
        const rawProducts: POSProduct[] = (productsRes.data || []).map((p: any) => ({
          id: String(p.id),
          name: p.name,
          sellingPrice: p.selling_price ?? Number(p.price) ?? 0,
          stock: p.quantity ?? p.stock ?? 0,
          category: p.category?.name || p.category || 'General',
          barcode: p.barcode || undefined,
          sku: p.sku || String(p.id),
          image: p.image_url || undefined,
        }));
        setProducts(rawProducts);
        const cats = ['All', ...Array.from(new Set(rawProducts.map((p) => p.category)))];
        setCategories(cats);

        // Check order usage for free-tier sellers
        try {
          const subRes = await subscriptionApi.getCurrent(String(shop.id));
          const plan = subRes.data?.plan;
          if (plan?.orders_limit != null && plan?.orders_used != null) {
            setOrderUsage({ used: plan.orders_used, limit: plan.orders_limit });
          }
        } catch { /* subscription fetch is non-critical */ }
      } catch (err) {
        console.error('Failed to load POS data:', err);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchData();
  }, []);

  // Handle barcode scan — extract code from QR URL if needed, then show product popup
  const handleBarcodeScan = useCallback((raw: string) => {
    // If QR code was scanned (contains a URL), extract the barcode from /p/{code}
    const urlMatch = raw.match(/\/p\/([A-Za-z0-9]+)/);
    const barcode = urlMatch ? urlMatch[1] : raw.trim();

    const product = products.find(
      (p) => p.barcode === barcode || p.sku.toLowerCase() === barcode.toLowerCase()
    );
    if (product) {
      setScannedProduct(product);
    } else {
      setBarcodeFlash(`Not found: ${barcode}`);
      setTimeout(() => setBarcodeFlash(null), 2500);
    }
  }, [products]);

  // Global keyboard barcode scanner listener (works even when no input is focused)
  useBarcodeScanner({ onScan: handleBarcodeScan, enabled: !showCheckout && !showReceipt });

  const filteredProducts = products.filter((product) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      product.name.toLowerCase().includes(q) ||
      (product.barcode || '').includes(q) ||
      product.sku.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: POSProduct) => {
    if (product.stock === 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { id: product.id, name: product.name, price: product.sellingPrice, quantity: 1, maxStock: product.stock }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.min(item.maxStock, Math.max(0, item.quantity + delta)) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
  };

  // Calculate totals based on VAT settings
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = discountType === 'percent' ? (cartTotal * discount) / 100 : discount;
  const afterDiscount = cartTotal - discountAmount;

  // VAT calculation depends on whether prices include VAT or not
  let subtotal: number;
  let vatAmount: number;
  let total: number;

  if (!shopVatSettings.vatEnabled || shopVatSettings.vatRate === 0) {
    // No VAT
    subtotal = afterDiscount;
    vatAmount = 0;
    total = afterDiscount;
  } else if (shopVatSettings.pricesIncludeVat) {
    // Prices INCLUDE VAT (most common in UAE retail)
    // Price shown = Final price (VAT already inside)
    // We need to extract VAT from the total for display purposes
    // Formula: VAT = Total - (Total / 1.05)
    total = afterDiscount; // Customer pays this amount (no extra VAT added)
    vatAmount = total - (total / (1 + shopVatSettings.vatRate / 100));
    subtotal = total - vatAmount; // Net amount before VAT
  } else {
    // Prices EXCLUDE VAT (VAT added on top)
    subtotal = afterDiscount;
    vatAmount = subtotal * (shopVatSettings.vatRate / 100);
    total = subtotal + vatAmount;
  }

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowCheckout(true);
  };

  const handlePayment = async () => {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
    if (!shopId) return;

    setProcessingPayment(true);
    try {
      await ordersApi.create(shopId, {
        source: 'pos',
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        notes: paymentMethod ? `Payment: ${paymentMethod}` : undefined,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        items: cart.map((item) => ({
          product_id: Number(item.id),
          quantity: item.quantity,
          unit_price: item.price,
        })),
      });

      // Success — show receipt and update local stock
      const newOrderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      setOrderNumber(newOrderNumber);
      setShowCheckout(false);
      setShowReceipt(true);

      setProducts((prev) => prev.map((p) => {
        const cartItem = cart.find((c) => c.id === p.id);
        if (!cartItem) return p;
        return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
      }));

      // Increment local order counter for free-tier sellers
      setOrderUsage((prev) => prev ? { ...prev, used: prev.used + 1 } : prev);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.error === 'order_limit_reached') {
        setShowCheckout(false);
        setOrderLimitError({ used: detail.used ?? 25, limit: detail.limit ?? 25 });
      }
      // Other errors: silent (POS offline tolerance)
    } finally {
      setProcessingPayment(false);
    }
  };

  const getInvoiceData = () => ({
    orderNumber,
    date: new Date(),
    items: cart.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    subtotal,
    discount: discountAmount,
    vat: vatAmount,
    total,
    paymentMethod,
    customer: customerName || customerPhone ? {
      name: customerName || undefined,
      phone: customerPhone || undefined,
    } : undefined,
    shop: shopData ?? { name: '', address: '', phone: '', email: '', vatNumber: '', tradeLicense: '' },
  });

  const handleDownloadInvoice = () => {
    generateInvoicePDF(getInvoiceData());
  };

  const handlePrintReceipt = () => {
    generateThermalReceipt(getInvoiceData());
  };

  const handleNewSale = () => {
    clearCart();
    setOrderNumber('');
    setShowReceipt(false);
  };

  return (
    <>
    {showCameraScanner && (
      <CameraScanner
        onScan={(barcode) => { setShowCameraScanner(false); handleBarcodeScan(barcode); }}
        onClose={() => setShowCameraScanner(false)}
      />
    )}

    {/* Order limit reached modal */}
    {orderLimitError && (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-7 h-7 text-orange-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Channel Order Limit Reached</h2>
          <p className="text-muted-foreground text-sm mb-1">
            You have used <span className="text-foreground font-bold">{orderLimitError.used}</span> of your{' '}
            <span className="text-foreground font-bold">{orderLimitError.limit}</span> channel orders this month.
          </p>
          <p className="text-muted-foreground text-sm mb-5">
            This limit applies to TheDersi and other connected channels. Upgrade your plan for more. POS sales are always unlimited.
          </p>
          <button
            onClick={() => setOrderLimitError(null)}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
          >
            OK, Got it
          </button>
        </div>
      </div>
    )}

    {/* Scanned product popup */}
    {scannedProduct && (
      <ScannedProductModal
        product={scannedProduct}
        sym={sym}
        onAddToCart={() => { addToCart(scannedProduct); setBarcodeFlash(`Added: ${scannedProduct.name}`); setTimeout(() => setBarcodeFlash(null), 2000); setScannedProduct(null); }}
        onClose={() => setScannedProduct(null)}
      />
    )}

    <div className="flex flex-col lg:h-[calc(100vh-5rem)] lg:flex-row gap-4">
      {/* Products Section */}
      <div className="flex flex-col min-h-0 lg:flex-1">
        {/* Search & Filter */}
        <div className="bg-card rounded-xl border border-border p-3 mb-4">
          {/* POS unlimited sales badge */}
          <div className="mb-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
            <Check className="w-4 h-4 shrink-0" />
            <span>Unlimited POS sales — no monthly limit on in-store transactions</span>
          </div>

          {/* Barcode Scanner Status Banner */}
          {barcodeFlash && (
            <div className={`mb-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              barcodeFlash.startsWith('Not found')
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
            }`}>
              <Zap className="w-4 h-4" />
              {barcodeFlash}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, barcode, or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground placeholder:text-muted-foreground text-base"
              />
            </div>
            {/* Barcode manual input + camera button */}
            <div className="flex gap-2 sm:w-60">
              <div className="relative flex-1">
                <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  data-barcode-input
                  placeholder="Scan barcode..."
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground placeholder:text-muted-foreground text-base"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) { handleBarcodeScan(val); (e.target as HTMLInputElement).value = ''; }
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCameraScanner(true)}
                title="Scan with camera"
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Category Pills */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="lg:flex-1 lg:overflow-y-auto">
          {loadingProducts ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Package className="w-12 h-12 mb-2 opacity-40" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0}
                  className={`group bg-card border border-border rounded-2xl p-3 text-left shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5 dark:hover:border-indigo-500/40 ${
                    product.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="w-full aspect-square bg-muted rounded-xl overflow-hidden mb-2">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-foreground text-sm line-clamp-2 mb-2">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{product.sellingPrice} {sym}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      product.stock === 0
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : product.stock <= 5
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                        : 'bg-green-500/10 text-green-600 dark:text-green-400'
                    }`}>
                      {product.stock}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Section - Desktop only sidebar */}
      <div className="hidden lg:flex lg:w-96 bg-card border border-border rounded-xl flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-foreground">Cart</h2>
            <span className="text-xs bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} items
            </span>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-sm text-muted-foreground hover:text-destructive transition"
            >
              Clear
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Tap products to add</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground text-sm truncate">{item.name}</h4>
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold">{item.price} {sym}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, -1)}
                    aria-label={`Decrease quantity of ${item.name}`}
                    className="w-8 h-8 flex items-center justify-center bg-muted rounded-lg text-foreground hover:bg-muted/80 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium text-foreground">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, 1)}
                    aria-label={`Increase quantity of ${item.name}`}
                    disabled={item.quantity >= item.maxStock}
                    className="w-8 h-8 flex items-center justify-center bg-muted rounded-lg text-foreground hover:bg-muted/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Remove ${item.name} from cart`}
                    className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Discount */}
        {cart.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  id="discount-amount"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="Discount"
                  aria-label="Discount amount"
                  className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm"
                />
              </div>
              <select
                id="discount-type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                aria-label="Discount type"
                className="px-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm"
              >
                <option value="percent">%</option>
                <option value="fixed">{sym}</option>
              </select>
            </div>
          </div>
        )}

        {/* Cart Summary */}
        <div className="p-4 border-t border-border space-y-2">
          {shopVatSettings.pricesIncludeVat ? (
            // Prices INCLUDE VAT - show total first, then breakdown
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Total</span>
                <span className="text-foreground">{cartTotal.toFixed(2)} {sym}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-600 dark:text-green-400">-{discountAmount.toFixed(2)} {sym}</span>
                </div>
              )}
              {shopVatSettings.showVatBreakdown && shopVatSettings.vatEnabled && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span className="text-xs">(incl. VAT {shopVatSettings.vatRate}%)</span>
                  <span className="text-xs">{vatAmount.toFixed(2)} {sym}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span className="text-foreground">Total</span>
                <span className="text-indigo-600 dark:text-indigo-400">{total.toFixed(2)} {sym}</span>
              </div>
            </>
          ) : (
            // Prices EXCLUDE VAT - show subtotal, then add VAT
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">{cartTotal.toFixed(2)} {sym}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-600 dark:text-green-400">-{discountAmount.toFixed(2)} {sym}</span>
                </div>
              )}
              {shopVatSettings.vatEnabled && shopVatSettings.vatRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT ({shopVatSettings.vatRate}%)</span>
                  <span className="text-foreground">+{vatAmount.toFixed(2)} {sym}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span className="text-foreground">Total</span>
                <span className="text-indigo-600 dark:text-indigo-400">{total.toFixed(2)} {sym}</span>
              </div>
            </>
          )}
        </div>

        {/* Checkout Button */}
        <div className="p-4 pt-0">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-4 bg-foreground text-background rounded-xl font-semibold text-lg transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Receipt className="w-5 h-5" />
            Checkout
          </button>
        </div>
      </div>

      {/* Mobile floating cart button */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 lg:hidden z-40">
          <button
            type="button"
            onClick={handleCheckout}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 px-5 flex items-center justify-between shadow-2xl font-semibold transition"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {cart.reduce((s, i) => s + i.quantity, 0)} item{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''}
            </span>
            <span>{total.toFixed(2)} {sym} →</span>
          </button>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
              <h2 className="text-lg font-semibold text-foreground">Checkout</h2>
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                aria-label="Close checkout"
                className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Customer Info (Optional) */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer (Optional)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    id="customer-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Name"
                    aria-label="Customer name"
                    className="px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm"
                  />
                  <input
                    type="tel"
                    id="customer-phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Phone"
                    aria-label="Customer phone"
                    className="px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm"
                  />
                  <input
                    type="email"
                    id="customer-email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Email"
                    aria-label="Customer email"
                    className="col-span-2 px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Payment Method</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                      paymentMethod === 'cash'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-border hover:border-indigo-300'
                    }`}
                  >
                    <Banknote className={`w-8 h-8 ${paymentMethod === 'cash' ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${paymentMethod === 'cash' ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                      paymentMethod === 'card'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-border hover:border-indigo-300'
                    }`}
                  >
                    <CreditCard className={`w-8 h-8 ${paymentMethod === 'card' ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${paymentMethod === 'card' ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>Card</span>
                  </button>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-muted/50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-muted-foreground">{item.name} x{item.quantity}</span>
                      <span className="text-foreground">{(item.price * item.quantity).toFixed(2)} {sym}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 mt-2">
                    {shopVatSettings.pricesIncludeVat ? (
                      // Prices INCLUDE VAT
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Items Total</span>
                          <span className="text-foreground">{cartTotal.toFixed(2)} {sym}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Discount</span>
                            <span className="text-green-600 dark:text-green-400">-{discountAmount.toFixed(2)} {sym}</span>
                          </div>
                        )}
                        {shopVatSettings.showVatBreakdown && shopVatSettings.vatEnabled && (
                          <div className="flex justify-between text-muted-foreground">
                            <span className="text-xs">(incl. VAT {shopVatSettings.vatRate}%)</span>
                            <span className="text-xs">{vatAmount.toFixed(2)} {sym}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      // Prices EXCLUDE VAT
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="text-foreground">{cartTotal.toFixed(2)} {sym}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Discount</span>
                            <span className="text-green-600 dark:text-green-400">-{discountAmount.toFixed(2)} {sym}</span>
                          </div>
                        )}
                        {shopVatSettings.vatEnabled && shopVatSettings.vatRate > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">VAT ({shopVatSettings.vatRate}%)</span>
                            <span className="text-foreground">+{vatAmount.toFixed(2)} {sym}</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex justify-between font-bold text-base pt-2 border-t border-border mt-2">
                      <span className="text-foreground">Total</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{total.toFixed(2)} {sym}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm Button */}
              <button
                type="button"
                onClick={handlePayment}
                disabled={processingPayment}
                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2"
              >
                {processingPayment ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Processing...</>
                ) : (
                  <><Check className="w-5 h-5" />Confirm Payment - {total.toFixed(2)} {sym}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm">
            {/* Receipt Header */}
            <div className="p-6 text-center border-b border-border">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Payment Successful!</h2>
              <p className="text-muted-foreground text-sm mt-1">Order #{orderNumber}</p>
            </div>

            {/* Receipt Details */}
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{total.toFixed(2)} {sym}</p>
                <p className="text-sm text-muted-foreground">
                  Paid via {paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}
                </p>
              </div>

              {/* Download A4 Invoice - Primary Action */}
              <button
                type="button"
                onClick={handleDownloadInvoice}
                className="w-full py-3 bg-foreground text-background rounded-xl font-semibold transition hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download A4 Invoice (PDF)
              </button>

              {/* Other Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-muted rounded-lg text-foreground hover:bg-muted/80 transition"
                >
                  <Printer className="w-5 h-5" />
                  <span className="text-sm font-medium">Thermal</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleNewSale}
                className="w-full py-4 bg-muted text-foreground rounded-xl font-semibold hover:bg-muted/80 transition"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// ── Scanned product popup ─────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

interface LiveInfo { stock: number; reserved: number; available: number; }

function ScannedProductModal({
  product,
  sym,
  onAddToCart,
  onClose,
}: {
  product: POSProduct;
  sym: string;
  onAddToCart: () => void;
  onClose: () => void;
}) {
  const [live, setLive] = useState<LiveInfo | null>(null);

  useEffect(() => {
    if (!product.barcode) {
      setLive({ stock: product.stock, reserved: 0, available: product.stock });
      return;
    }
    fetch(`${API_BASE}/api/v1/public/product/${product.barcode}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setLive({ stock: data.stock, reserved: data.reserved, available: data.available });
        else setLive({ stock: product.stock, reserved: 0, available: product.stock });
      })
      .catch(() => setLive({ stock: product.stock, reserved: 0, available: product.stock }));
  }, [product]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground text-sm">Scanned Product</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product info */}
        <div className="p-5">
          {product.image && (
            <img src={product.image} alt={product.name} className="w-full h-32 object-contain rounded-xl bg-muted mb-4" />
          )}
          <p className="text-xs text-muted-foreground mb-0.5">{product.category}</p>
          <h2 className="text-lg font-bold text-foreground mb-1">{product.name}</h2>
          <p className="text-2xl font-black text-primary mb-4">{sym}{product.sellingPrice.toFixed(2)}</p>

          {/* Stock live data */}
          {live ? (
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-xl font-black text-foreground">{live.stock}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total Stock</p>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-xl font-black text-yellow-500">{live.reserved}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Reserved</p>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className={`text-xl font-black ${live.available > 0 ? 'text-green-500' : 'text-red-500'}`}>{live.available}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Available</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-16 mb-5">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              onClick={onAddToCart}
              disabled={live ? live.available === 0 : false}
              className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
