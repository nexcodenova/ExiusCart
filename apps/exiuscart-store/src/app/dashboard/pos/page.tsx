'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Search, Plus, Minus, Trash2, X, CreditCard, Banknote, Percent,
  Receipt, Printer, Check, ShoppingCart, Package,
  User, Download, Scan, Zap, Loader2, Camera, PauseCircle, PlayCircle, Clock,
  Star, RotateCcw, MessageSquare, BarChart2, ArrowLeftRight,
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
  note?: string;
}

interface HeldBill {
  id: string;
  label: string;
  items: CartItem[];
  discount: number;
  discountType: 'percent' | 'fixed';
  serviceCharge: number;
  serviceChargeType: 'percent' | 'fixed';
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  heldAt: number;
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

interface ZReport {
  date: string;
  transactions: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  splitSales: number;
  avgOrder: number;
  totalItems: number;
  returns: number;
}

export default function POSPage() {
  const { sym } = useCurrency();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [serviceCharge, setServiceCharge] = useState(0);
  const [serviceChargeType, setServiceChargeType] = useState<'percent' | 'fixed'>('percent');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash');
  const [splitCashAmount, setSplitCashAmount] = useState(0);
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
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
  const [showZReport, setShowZReport] = useState(false);
  const [zReport, setZReport] = useState<ZReport | null>(null);
  const [zReportLoading, setZReportLoading] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [shopData, setShopData] = useState<ShopData | null>(null);

  const HELD_KEY = 'pos_held_bills';
  const PINNED_KEY = 'pos_pinned_products';

  const [heldBills, setHeldBills] = useState<HeldBill[]>(() => {
    try { return JSON.parse(localStorage.getItem(HELD_KEY) || '[]'); } catch { return []; }
  });
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]'); } catch { return []; }
  });
  const [showHeldPanel, setShowHeldPanel] = useState(false);

  const saveHeld = (bills: HeldBill[]) => {
    setHeldBills(bills);
    localStorage.setItem(HELD_KEY, JSON.stringify(bills));
  };

  const togglePin = (productId: string) => {
    setPinnedIds(prev => {
      const next = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      localStorage.setItem(PINNED_KEY, JSON.stringify(next));
      return next;
    });
  };

  const holdBill = () => {
    if (cart.length === 0) return;
    const bill: HeldBill = {
      id: Date.now().toString(),
      label: customerName || `Bill #${heldBills.length + 1}`,
      items: cart,
      discount,
      discountType,
      serviceCharge,
      serviceChargeType,
      customerName,
      customerPhone,
      customerEmail,
      heldAt: Date.now(),
    };
    saveHeld([...heldBills, bill]);
    clearCart();
  };

  const resumeBill = (id: string) => {
    const bill = heldBills.find(b => b.id === id);
    if (!bill) return;
    setCart(bill.items);
    setDiscount(bill.discount);
    setDiscountType(bill.discountType);
    setServiceCharge(bill.serviceCharge || 0);
    setServiceChargeType(bill.serviceChargeType || 'percent');
    setCustomerName(bill.customerName);
    setCustomerPhone(bill.customerPhone);
    setCustomerEmail(bill.customerEmail);
    saveHeld(heldBills.filter(b => b.id !== id));
    setShowHeldPanel(false);
  };

  const deleteHeldBill = (id: string) => saveHeld(heldBills.filter(b => b.id !== id));

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

        try {
          const subRes = await subscriptionApi.getCurrent(String(shop.id));
          const plan = subRes.data?.plan;
          if (plan?.orders_limit != null && plan?.orders_used != null) {
            setOrderUsage({ used: plan.orders_used, limit: plan.orders_limit });
          }
        } catch { /* non-critical */ }
      } catch (err) {
        console.error('Failed to load POS data:', err);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchData();
  }, []);

  const handleBarcodeScan = useCallback((raw: string) => {
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

  const pinnedProducts = products.filter(p => pinnedIds.includes(p.id));

  const addToCart = (product: POSProduct) => {
    if (!isReturnMode && product.stock === 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (!isReturnMode && existing.quantity >= product.stock) return prev;
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
        .map((item) => {
          if (item.id !== id) return item;
          const max = isReturnMode ? Infinity : item.maxStock;
          return { ...item, quantity: Math.min(max, Math.max(0, item.quantity + delta)) };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((item) => item.id !== id));

  const saveItemNote = (id: string, note: string) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, note: note.trim() || undefined } : item));
    setEditingNoteId(null);
    setNoteInput('');
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setServiceCharge(0);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
  };

  // ── Totals ────────────────────────────────────────────────────────────────────
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = discountType === 'percent' ? (cartTotal * discount) / 100 : discount;
  const afterDiscount = cartTotal - discountAmount;
  const serviceChargeAmount = serviceChargeType === 'percent'
    ? (afterDiscount * serviceCharge) / 100
    : serviceCharge;
  const afterServiceCharge = afterDiscount + serviceChargeAmount;

  let subtotal: number;
  let vatAmount: number;
  let total: number;

  if (!shopVatSettings.vatEnabled || shopVatSettings.vatRate === 0) {
    subtotal = afterServiceCharge;
    vatAmount = 0;
    total = afterServiceCharge;
  } else if (shopVatSettings.pricesIncludeVat) {
    total = afterServiceCharge;
    vatAmount = total - (total / (1 + shopVatSettings.vatRate / 100));
    subtotal = total - vatAmount;
  } else {
    subtotal = afterServiceCharge;
    vatAmount = subtotal * (shopVatSettings.vatRate / 100);
    total = subtotal + vatAmount;
  }

  const grandTotal = total;
  const splitCardAmount = Math.max(0, grandTotal - splitCashAmount);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleCheckout = () => { if (cart.length > 0) setShowCheckout(true); };

  const handlePayment = async () => {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
    if (!shopId) return;
    setProcessingPayment(true);
    try {
      const noteParts: string[] = [];
      if (paymentMethod === 'split') {
        noteParts.push(`Payment: split (cash: ${splitCashAmount.toFixed(2)}, card: ${splitCardAmount.toFixed(2)})`);
      } else {
        noteParts.push(`Payment: ${paymentMethod}`);
      }
      await ordersApi.create(shopId, {
        source: isReturnMode ? 'pos_return' : 'pos',
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        notes: noteParts.join(' | '),
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        items: cart.map((item) => ({
          product_id: Number(item.id),
          quantity: isReturnMode ? -item.quantity : item.quantity,
          unit_price: item.price,
        })),
      });

      const newOrderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      setOrderNumber(newOrderNumber);
      setShowCheckout(false);
      setShowReceipt(true);

      if (!isReturnMode) {
        setProducts((prev) => prev.map((p) => {
          const cartItem = cart.find((c) => c.id === p.id);
          if (!cartItem) return p;
          return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
        }));
        setOrderUsage((prev) => prev ? { ...prev, used: prev.used + 1 } : prev);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.error === 'order_limit_reached') {
        setShowCheckout(false);
        setOrderLimitError({ used: detail.used ?? 25, limit: detail.limit ?? 25 });
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  const fetchZReport = async () => {
    setZReportLoading(true);
    setZReport(null);
    try {
      const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
      const res = await ordersApi.getAll(shopId);
      const today = new Date().toDateString();
      const todayOrders = (res.data || []).filter((o: any) => {
        const isToday = new Date(o.created_at).toDateString() === today;
        return isToday && (o.source === 'pos' || o.source === 'pos_return');
      });

      let totalSales = 0, cashSales = 0, cardSales = 0, splitSales = 0, totalItems = 0, returns = 0;
      for (const o of todayOrders) {
        const amount = parseFloat(o.total || 0);
        totalItems += (o.items || []).reduce((s: number, i: any) => s + Math.abs(i.quantity || 1), 0);
        if (o.source === 'pos_return') {
          returns++;
        } else {
          totalSales += amount;
          const notes = o.notes || '';
          if (notes.includes('Payment: split')) splitSales += amount;
          else if (notes.includes('Payment: card')) cardSales += amount;
          else cashSales += amount;
        }
      }
      const txCount = todayOrders.filter((o: any) => o.source === 'pos').length;
      setZReport({
        date: new Date().toLocaleDateString(),
        transactions: txCount,
        totalSales,
        cashSales,
        cardSales,
        splitSales,
        avgOrder: txCount > 0 ? totalSales / txCount : 0,
        totalItems,
        returns,
      });
    } catch (e) {
      console.error('Z-report fetch failed:', e);
    } finally {
      setZReportLoading(false);
    }
  };

  const getInvoiceData = () => ({
    orderNumber,
    date: new Date(),
    items: cart.map((item) => ({
      name: item.name,
      quantity: isReturnMode ? -item.quantity : item.quantity,
      price: item.price,
    })),
    subtotal,
    discount: discountAmount,
    vat: vatAmount,
    total: grandTotal,
    paymentMethod,
    customer: customerName || customerPhone ? { name: customerName || undefined, phone: customerPhone || undefined } : undefined,
    shop: shopData ?? { name: '', address: '', phone: '', email: '', vatNumber: '', tradeLicense: '' },
  });

  const handleDownloadInvoice = () => generateInvoicePDF(getInvoiceData());
  const handlePrintReceipt = () => generateThermalReceipt(getInvoiceData());
  const handleNewSale = () => {
    clearCart();
    setOrderNumber('');
    setShowReceipt(false);
    setIsReturnMode(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
    {showCameraScanner && (
      <CameraScanner
        onScan={(barcode) => { setShowCameraScanner(false); handleBarcodeScan(barcode); }}
        onClose={() => setShowCameraScanner(false)}
      />
    )}

    {/* Order limit modal */}
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
            This limit applies to TheDersi and other connected channels. POS sales are always unlimited.
          </p>
          <button onClick={() => setOrderLimitError(null)}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition">
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

    {/* Z-Report Modal */}
    {showZReport && (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-foreground">End-of-Day Z-Report</h2>
            </div>
            <button onClick={() => setShowZReport(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {!zReport && !zReportLoading ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">Generate today&apos;s POS sales report</p>
                <button onClick={fetchZReport}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition text-sm">
                  Generate Report
                </button>
              </div>
            ) : zReportLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : zReport ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">{zReport.date}</p>
                <div className="grid grid-cols-2 gap-2">
                  <ZStat label="Transactions" value={String(zReport.transactions)} />
                  <ZStat label="Total Sales" value={`${sym}${zReport.totalSales.toFixed(2)}`} highlight />
                  <ZStat label="Cash" value={`${sym}${zReport.cashSales.toFixed(2)}`} />
                  <ZStat label="Card" value={`${sym}${zReport.cardSales.toFixed(2)}`} />
                  {zReport.splitSales > 0 && <ZStat label="Split" value={`${sym}${zReport.splitSales.toFixed(2)}`} />}
                  <ZStat label="Avg Order" value={`${sym}${zReport.avgOrder.toFixed(2)}`} />
                  <ZStat label="Items Sold" value={String(zReport.totalItems)} />
                  <ZStat label="Returns" value={String(zReport.returns)} />
                </div>
                <button onClick={fetchZReport}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition border border-border rounded-lg mt-2">
                  Refresh
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )}

    <div className="flex flex-col lg:h-[calc(100vh-5rem)] lg:flex-row gap-4">
      {/* ── Products Section ── */}
      <div className="flex flex-col min-h-0 lg:flex-1">
        {/* Search & Filter bar */}
        <div className="bg-card rounded-xl border border-border p-3 mb-4">
          <div className="mb-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
            <Check className="w-4 h-4 shrink-0" />
            <span>Unlimited POS sales — no monthly limit on in-store transactions</span>
          </div>

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
              <button type="button" onClick={() => setShowCameraScanner(true)} title="Scan with camera"
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition">
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button key={cat} type="button" onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Access — pinned products */}
        {pinnedProducts.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">⚡ Quick Access</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pinnedProducts.map(product => (
                <button key={product.id} type="button" onClick={() => addToCart(product)}
                  disabled={!isReturnMode && product.stock === 0}
                  className="flex-shrink-0 flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl px-3 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  {product.image
                    ? <img src={product.image} alt={product.name} className="w-5 h-5 rounded object-cover" />
                    : <Package className="w-4 h-4" />
                  }
                  <span className="max-w-[100px] truncate">{product.name}</span>
                  <span className="text-xs text-indigo-500">{product.sellingPrice} {sym}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
                <div key={product.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={!isReturnMode && product.stock === 0}
                    className={`w-full bg-card border border-border rounded-2xl p-3 text-left shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5 dark:hover:border-indigo-500/40 ${
                      !isReturnMode && product.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''
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
                    <h3 className="font-medium text-foreground text-sm line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-muted-foreground/60 font-mono mb-2">#{product.id}</p>
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
                  {/* Pin / unpin button */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); togglePin(product.id); }}
                    title={pinnedIds.includes(product.id) ? 'Unpin from quick access' : 'Pin to quick access'}
                    className={`absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full transition ${
                      pinnedIds.includes(product.id)
                        ? 'bg-yellow-400 text-white opacity-100'
                        : 'opacity-0 group-hover:opacity-100 bg-muted/80 text-muted-foreground hover:text-yellow-500'
                    }`}
                  >
                    <Star className="w-3 h-3" fill={pinnedIds.includes(product.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Cart Section ── */}
      <div className={`hidden lg:flex lg:w-96 bg-card border rounded-xl flex-col relative overflow-hidden transition-colors ${
        isReturnMode ? 'border-red-400 dark:border-red-500/60' : 'border-border'
      }`}>
        {/* Cart Header */}
        <div className={`p-4 border-b flex items-center justify-between gap-2 ${
          isReturnMode ? 'border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5' : 'border-border'
        }`}>
          <div className="flex items-center gap-2">
            {isReturnMode
              ? <RotateCcw className="w-5 h-5 text-red-500" />
              : <ShoppingCart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            }
            <h2 className={`font-semibold ${isReturnMode ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
              {isReturnMode ? 'Return Mode' : 'Cart'}
            </h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isReturnMode
                ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
            }`}>
              {cart.reduce((sum, item) => sum + item.quantity, 0)} items
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Z-Report */}
            <button type="button" onClick={() => setShowZReport(true)} title="End-of-Day Z-Report"
              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition font-medium">
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            {/* Return mode toggle */}
            <button type="button" onClick={() => setIsReturnMode(r => !r)}
              title={isReturnMode ? 'Exit return mode' : 'Enter return/exchange mode'}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition font-medium ${
                isReturnMode
                  ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-200'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}>
              <RotateCcw className="w-3.5 h-3.5" />
              {isReturnMode ? 'Exit' : 'Return'}
            </button>
            {heldBills.length > 0 && (
              <button type="button" onClick={() => setShowHeldPanel(true)}
                className="relative flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition font-medium">
                <Clock className="w-3.5 h-3.5" />
                Held ({heldBills.length})
              </button>
            )}
            {cart.length > 0 && (
              <>
                <button type="button" onClick={holdBill}
                  className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition font-medium">
                  <PauseCircle className="w-3.5 h-3.5" /> Hold
                </button>
                <button type="button" onClick={clearCart}
                  className="text-xs text-muted-foreground hover:text-destructive transition px-1">
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Held Bills Panel */}
        {showHeldPanel && (
          <div className="absolute inset-0 z-30 bg-card rounded-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-foreground text-sm">Held Bills</h3>
              </div>
              <button type="button" onClick={() => setShowHeldPanel(false)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {heldBills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No held bills</p>
              ) : heldBills.map(bill => (
                <div key={bill.id} className="bg-muted/50 rounded-xl p-3 border border-border">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium text-foreground text-sm">{bill.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {bill.items.length} item{bill.items.length !== 1 ? 's' : ''} · {new Date(bill.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button type="button" onClick={() => deleteHeldBill(bill.id)}
                      className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
                    {bill.items.slice(0, 3).map(item => (
                      <p key={item.id}>• {item.name} ×{item.quantity}</p>
                    ))}
                    {bill.items.length > 3 && <p>+{bill.items.length - 3} more</p>}
                  </div>
                  <button type="button" onClick={() => resumeBill(bill.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition">
                    <PlayCircle className="w-3.5 h-3.5" /> Resume Bill
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              {isReturnMode
                ? <RotateCcw className="w-12 h-12 mb-2 opacity-50 text-red-400" />
                : <ShoppingCart className="w-12 h-12 mb-2 opacity-50" />
              }
              <p className="text-sm">{isReturnMode ? 'No items to return' : 'Cart is empty'}</p>
              <p className="text-xs">{isReturnMode ? 'Tap products to add as returns' : 'Tap products to add'}</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className={`rounded-xl p-3 border ${
                isReturnMode
                  ? 'bg-red-50/50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
                  : 'bg-muted/50 border-transparent'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground text-sm truncate">{item.name}</h4>
                    <p className="text-xs text-muted-foreground/60 font-mono">#{item.id}</p>
                    <p className={`text-sm font-semibold ${isReturnMode ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                      {isReturnMode ? '-' : ''}{item.price} {sym}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => updateQuantity(item.id, -1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                      className="w-8 h-8 flex items-center justify-center bg-muted rounded-lg text-foreground hover:bg-muted/80 transition">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium text-foreground">{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.id, 1)}
                      aria-label={`Increase quantity of ${item.name}`}
                      disabled={!isReturnMode && item.quantity >= item.maxStock}
                      className="w-8 h-8 flex items-center justify-center bg-muted rounded-lg text-foreground hover:bg-muted/80 transition disabled:opacity-40 disabled:cursor-not-allowed">
                      <Plus className="w-4 h-4" />
                    </button>
                    {/* Per-item note */}
                    <button type="button"
                      onClick={() => { setEditingNoteId(editingNoteId === item.id ? null : item.id); setNoteInput(item.note || ''); }}
                      title="Item note"
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition ${
                        item.note
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}>
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => removeFromCart(item.id)}
                      aria-label={`Remove ${item.name}`}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {item.note && editingNoteId !== item.id && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">📝 {item.note}</p>
                )}
                {editingNoteId === item.id && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveItemNote(item.id, noteInput);
                        if (e.key === 'Escape') setEditingNoteId(null);
                      }}
                      placeholder="Note for this item..."
                      autoFocus
                      className="flex-1 px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary outline-none text-foreground"
                    />
                    <button type="button" onClick={() => saveItemNote(item.id, noteInput)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg hover:bg-primary/90 transition">
                      Save
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Discount + Service Charge */}
        {cart.length > 0 && (
          <div className="px-4 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="number" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="Discount" aria-label="Discount amount"
                  className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm" />
              </div>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                aria-label="Discount type"
                className="px-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm">
                <option value="percent">%</option>
                <option value="fixed">{sym}</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-semibold">SC</span>
                <input type="number" value={serviceCharge || ''} onChange={(e) => setServiceCharge(Number(e.target.value))}
                  placeholder="Service charge" aria-label="Service charge"
                  className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm" />
              </div>
              <select value={serviceChargeType} onChange={(e) => setServiceChargeType(e.target.value as 'percent' | 'fixed')}
                aria-label="Service charge type"
                className="px-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm">
                <option value="percent">%</option>
                <option value="fixed">{sym}</option>
              </select>
            </div>
          </div>
        )}

        {/* Cart Summary */}
        <div className="p-4 border-t border-border space-y-2">
          {shopVatSettings.pricesIncludeVat ? (
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
              {serviceChargeAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service Charge</span>
                  <span className="text-foreground">+{serviceChargeAmount.toFixed(2)} {sym}</span>
                </div>
              )}
              {shopVatSettings.showVatBreakdown && shopVatSettings.vatEnabled && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span className="text-xs">(incl. VAT {shopVatSettings.vatRate}%)</span>
                  <span className="text-xs">{vatAmount.toFixed(2)} {sym}</span>
                </div>
              )}
            </>
          ) : (
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
              {serviceChargeAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service Charge</span>
                  <span className="text-foreground">+{serviceChargeAmount.toFixed(2)} {sym}</span>
                </div>
              )}
              {shopVatSettings.vatEnabled && shopVatSettings.vatRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT ({shopVatSettings.vatRate}%)</span>
                  <span className="text-foreground">+{vatAmount.toFixed(2)} {sym}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
            <span className={isReturnMode ? 'text-red-600 dark:text-red-400' : 'text-foreground'}>
              {isReturnMode ? 'Refund' : 'Total'}
            </span>
            <span className={isReturnMode ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}>
              {isReturnMode ? '-' : ''}{total.toFixed(2)} {sym}
            </span>
          </div>
        </div>

        {/* Checkout Button */}
        <div className="p-4 pt-0">
          <button type="button" onClick={handleCheckout} disabled={cart.length === 0}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              isReturnMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-foreground text-background'
            }`}>
            {isReturnMode ? <RotateCcw className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
            {isReturnMode ? 'Process Return' : 'Checkout'}
          </button>
        </div>
      </div>

      {/* Mobile floating cart */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 lg:hidden z-40 flex gap-2">
          <button type="button" onClick={holdBill}
            className="flex items-center gap-2 px-4 py-4 rounded-2xl bg-card border border-border shadow-2xl font-semibold text-sm text-muted-foreground hover:text-foreground transition shrink-0">
            <PauseCircle className="w-5 h-5" />
            Hold
          </button>
          <button type="button" onClick={handleCheckout}
            className={`flex-1 rounded-2xl py-4 px-5 flex items-center justify-between shadow-2xl font-semibold transition ${
              isReturnMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}>
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {cart.reduce((s, i) => s + i.quantity, 0)} item{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''}
            </span>
            <span>{isReturnMode ? 'Return ' : ''}{total.toFixed(2)} {sym} →</span>
          </button>
        </div>
      )}

      {/* ── Checkout Modal ── */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
              <h2 className="text-lg font-semibold text-foreground">
                {isReturnMode ? 'Process Return' : 'Checkout'}
              </h2>
              <button type="button" onClick={() => setShowCheckout(false)} aria-label="Close checkout"
                className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Customer + Table */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer (Optional)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Name" aria-label="Customer name"
                    className="px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm" />
                  <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Phone" aria-label="Customer phone"
                    className="px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm" />
                  <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Email" aria-label="Customer email"
                    className="col-span-2 px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground text-sm" />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Payment Method</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'card', 'split'] as const).map(method => (
                    <button key={method} type="button" onClick={() => setPaymentMethod(method)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition ${
                        paymentMethod === method
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                          : 'border-border hover:border-indigo-300'
                      }`}>
                      {method === 'cash' && <Banknote className={`w-6 h-6 ${paymentMethod === 'cash' ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`} />}
                      {method === 'card' && <CreditCard className={`w-6 h-6 ${paymentMethod === 'card' ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`} />}
                      {method === 'split' && <ArrowLeftRight className={`w-6 h-6 ${paymentMethod === 'split' ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`} />}
                      <span className={`text-xs font-medium capitalize ${paymentMethod === method ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>
                        {method}
                      </span>
                    </button>
                  ))}
                </div>
                {paymentMethod === 'split' && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-muted-foreground shrink-0" />
                      <input type="number" value={splitCashAmount || ''}
                        onChange={(e) => setSplitCashAmount(Number(e.target.value))}
                        placeholder="Cash amount"
                        className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary text-foreground" />
                    </div>
                    <div className="flex items-center justify-between text-sm pl-6">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" /> Card
                      </span>
                      <span className="font-semibold text-foreground">{sym}{splitCardAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="bg-muted/50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {item.name} x{item.quantity}
                        {item.note && <span className="block text-xs text-amber-500 mt-0.5">📝 {item.note}</span>}
                      </span>
                      <span className="text-foreground">{(item.price * item.quantity).toFixed(2)} {sym}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    {shopVatSettings.pricesIncludeVat ? (
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
                        {serviceChargeAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Service Charge</span>
                            <span className="text-foreground">+{serviceChargeAmount.toFixed(2)} {sym}</span>
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
                        {serviceChargeAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Service Charge</span>
                            <span className="text-foreground">+{serviceChargeAmount.toFixed(2)} {sym}</span>
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
                    <div className="flex justify-between font-bold text-base pt-2 border-t border-border mt-1">
                      <span className={isReturnMode ? 'text-red-600 dark:text-red-400' : 'text-foreground'}>
                        {isReturnMode ? 'Refund' : 'Total'}
                      </span>
                      <span className={isReturnMode ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}>
                        {isReturnMode ? '-' : ''}{grandTotal.toFixed(2)} {sym}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm */}
              <button type="button" onClick={handlePayment} disabled={processingPayment}
                className={`w-full py-4 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2 ${
                  isReturnMode ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}>
                {processingPayment ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Processing...</>
                ) : isReturnMode ? (
                  <><RotateCcw className="w-5 h-5" />Confirm Return — {sym}{grandTotal.toFixed(2)}</>
                ) : (
                  <><Check className="w-5 h-5" />Confirm Payment — {sym}{grandTotal.toFixed(2)}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ── */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm">
            <div className="p-6 text-center border-b border-border">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isReturnMode ? 'bg-red-500/10' : 'bg-green-500/10'
              }`}>
                {isReturnMode
                  ? <RotateCcw className="w-8 h-8 text-red-500" />
                  : <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                }
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {isReturnMode ? 'Return Processed!' : 'Payment Successful!'}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Order #{orderNumber}</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className={`text-3xl font-bold ${isReturnMode ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {isReturnMode ? '-' : ''}{grandTotal.toFixed(2)} {sym}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isReturnMode ? 'Refund via ' : 'Paid via '}
                  {paymentMethod === 'split'
                    ? `Split (${sym}${splitCashAmount.toFixed(2)} cash + ${sym}${splitCardAmount.toFixed(2)} card)`
                    : paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)
                  }
                </p>
              </div>

              <button type="button" onClick={handleDownloadInvoice}
                className="w-full py-3 bg-foreground text-background rounded-xl font-semibold transition hover:opacity-90 flex items-center justify-center gap-2">
                <Download className="w-5 h-5" />
                Download A4 Invoice (PDF)
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={handlePrintReceipt}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-muted rounded-lg text-foreground hover:bg-muted/80 transition">
                  <Printer className="w-5 h-5" />
                  <span className="text-sm font-medium">Thermal</span>
                </button>
              </div>

              <button type="button" onClick={handleNewSale}
                className="w-full py-4 bg-muted text-foreground rounded-xl font-semibold hover:bg-muted/80 transition">
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

// ── Z-Report stat box ──────────────────────────────────────────────────────────
function ZStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'bg-muted'}`}>
      <p className={`text-lg font-black ${highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ── Scanned product popup ─────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

interface LiveInfo { stock: number; reserved: number; available: number; }

function ScannedProductModal({
  product, sym, onAddToCart, onClose,
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground text-sm">Scanned Product</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {product.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={product.name} className="w-full h-32 object-contain rounded-xl bg-muted mb-4" />
          )}
          <p className="text-xs text-muted-foreground mb-0.5">{product.category}</p>
          <h2 className="text-lg font-bold text-foreground mb-1">{product.name}</h2>
          <p className="text-2xl font-black text-primary mb-4">{sym}{product.sellingPrice.toFixed(2)}</p>

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

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition">
              Cancel
            </button>
            <button onClick={onAddToCart} disabled={live ? live.available === 0 : false}
              className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 transition">
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
