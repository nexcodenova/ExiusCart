'use client';

import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import {
  Plus, Search, Edit, Trash2, Package, X, ChevronDown,
  Star, Upload, ImageIcon, ToggleLeft, ToggleRight, Loader2,
  FileSpreadsheet, Download, CheckCircle, AlertCircle, Barcode,
  Printer, Lock, Flame, TrendingUp, Snowflake, ArrowUpDown, RefreshCw,
  Store, Globe, ShoppingBag, Tag, PlayCircle, Info,
} from 'lucide-react';
import { productsApi, fieldsApi, attributesApi, imagesApi, channelsApi, shopifyApi, variantsApi, usageApi, bundlesApi, suppliersApi, reportsApi, noonApi, ebayApi, customProductFieldsApi, CustomProductField, videosApi, ProductVideo as ProductVideoType } from '@/lib/api';
import { UsageBanner } from '@/components/usage-banner';
import { colorNameToHex } from '@/lib/color-utils';
import { DarazListingFields } from '@/components/daraz-listing-fields';
import { EbayListingFields } from '@/components/ebay-listing-fields';
import { NoonListingFields, NoonAttributeValues } from '@/components/noon-listing-fields';
import { BundleBuilder, BundleComponent } from '@/components/bundle-builder';
import { DropshipSupplierSection } from '@/components/dropship-supplier-section';
import { RichTextEditor } from '@/components/rich-text-editor';
import { BarcodeDisplay, generateBarcode } from '@/components/ui/barcode';
import { useCurrency } from '@/components/providers/currency-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const CHANNEL_LABELS: Record<string, string> = {
  thedersi: 'TheDersi',
  daraz: 'Daraz',
  ebay: 'eBay',
  noon: 'Noon',
  shopify: 'Shopify',
  custom: 'Custom Website',
};
function channelLabel(channelType: string): string {
  return CHANNEL_LABELS[channelType] ?? channelType;
}

// Same format the backend auto-assigns to products saved with a blank SKU
// (SKU{id:06d}) isn't usable here since there's no id yet before saving —
// this gives a human-readable placeholder instead, editable before save.
function generateSku(name: string): string {
  const prefix = (name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'PRD';
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${suffix}`;
}

// Live word count for the description editor — strips HTML tags first so
// markup (from headings/images/lists) never inflates the count.
function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string | { id: number; name: string } | null;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockAlert: number;
  vatPercent: number;
  image?: string | null;
  supplier_id?: number | null;
  supplier?: { id: number; name: string } | null;
  is_dropship_imported?: boolean;
}

interface ShopField {
  id: number;
  label: string;
  field_key: string;
  field_type: string;
  options?: string[] | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

interface ProductImage {
  id: number;
  url: string;
  alt_text?: string | null;
  sort_order: number;
  is_primary: boolean;
}

interface ProductCategory { id: number; name: string; }
const DEFAULT_CATEGORIES: ProductCategory[] = [{ id: -1, name: 'General' }, { id: -2, name: 'Other' }];

// One row of a "quantity_tiers" custom field's value on a specific product.
// `price` is the TOTAL for buying exactly `quantity` (e.g. "3 for $25"),
// not a per-unit rate — matches checkout.py's _tiered_unit_price(). label/
// badge/badge_type/recommended are purely for the storefront's own display.
interface QuantityTierValue {
  quantity: number;
  price: number;
  label?: string;
  badge?: string;
  badge_type?: 'save' | 'popular' | 'value';
  recommended?: boolean;
}

export default function ProductsPage() {
  const { fmt, fmtBase } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvError, setCsvError] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  // Channel status map: { product_id: { thedersi: { status, rejection_reason } } }
  const [channelStatuses, setChannelStatuses] = useState<Record<string, Record<string, { status: string; rejection_reason?: string }>>>({});
  // Channel category map: { product_id: { connection_id: { channel_type, channel_category_id, channel_category_name } } }
  const [channelCategories, setChannelCategories] = useState<Record<string, Record<string, { channel_type: string; is_listed: boolean; channel_category_id: string; channel_category_name: string }>>>({});

  useEffect(() => {
    if (!shopId) return;
    channelsApi.getAllChannelStatuses(shopId)
      .then((r) => setChannelStatuses(r.data ?? {}))
      .catch(() => {});
    channelsApi.getAllProductChannelCategories(shopId)
      .then((r) => setChannelCategories(r.data ?? {}))
      .catch(() => {});
  }, [shopId]);

  const fetchProducts = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await productsApi.getAll(shopId, {
        search: searchQuery || undefined,
      });
      setProducts(res.data.map((p: any) => ({
        ...p,
        costPrice: p.cost_price ?? p.costPrice ?? 0,
        sellingPrice: p.price ?? p.sellingPrice ?? 0,
        stock: p.quantity ?? p.stock ?? 0,
        lowStockAlert: p.low_stock_threshold ?? p.lowStockAlert ?? 5,
      })));
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, searchQuery]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    if (!shopId) return;
    productsApi.getCategories(shopId)
      .then((res) => setCategories(res.data?.length ? res.data.map((c: any) => ({ id: c.id, name: c.name })) : DEFAULT_CATEGORIES))
      .catch(() => {});
  }, [shopId]);

  const handleDelete = async (productId: string) => {
    try {
      await productsApi.delete(shopId, productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setShowDeleteConfirm(null);
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? 'Failed to delete product. Please try again.');
    }
  };

  const downloadTemplate = () => {
    const headers = 'name,sku,price,cost_price,quantity,low_stock_threshold,description,category';
    const example = 'iPhone 15 Case,IPH15-CASE-BLK,49.99,25.00,100,10,Black silicone case for iPhone 15,Phone Accessories';
    const blob = new Blob([headers + '\n' + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFile = (e: ChangeEvent<HTMLInputElement>) => {
    setCsvError('');
    setCsvResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) { setCsvError('CSV must have at least one data row'); return; }
        const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
        const rows = lines.slice(1).map((line, idx) => {
          const vals = line.split(',');
          const obj: any = {};
          rawHeaders.forEach((h, i) => { obj[h] = vals[i]?.trim() || ''; });
          if (!obj.name) return null;
          return {
            row: idx + 2,
            name: obj.name,
            sku: obj.sku || undefined,
            price: parseFloat(obj.price) || 0,
            cost_price: parseFloat(obj.cost_price) || undefined,
            quantity: parseInt(obj.quantity) || 0,
            low_stock_threshold: parseInt(obj.low_stock_threshold) || 5,
            description: obj.description || undefined,
            category: obj.category || undefined,
          };
        }).filter(Boolean);
        if (!rows.length) { setCsvError('No valid rows found'); return; }
        setCsvRows(rows);
      } catch {
        setCsvError('Failed to parse CSV. Check the format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCsvImport = async () => {
    if (!csvRows.length || !shopId) return;
    setCsvImporting(true);
    try {
      const res = await productsApi.bulkImport(shopId, csvRows);
      setCsvResult(res.data);
      if (res.data.created > 0) fetchProducts();
    } catch (err: any) {
      setCsvError(err.response?.data?.detail || 'Import failed');
    } finally {
      setCsvImporting(false);
    }
  };

  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockAlert).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const missingSkuCount = products.filter((p) => !p.sku).length;
  const [generatingSkus, setGeneratingSkus] = useState(false);

  const handleGenerateSkus = async () => {
    if (!shopId) return;
    setGeneratingSkus(true);
    try {
      await productsApi.backfillSkus(shopId);
      await fetchProducts();
    } catch {}
    setGeneratingSkus(false);
  };
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'thedersi' | 'daraz' | 'ebay' | 'unlisted'>('all');
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set());
  const [planType, setPlanType] = useState<string>('');
  const [perfData, setPerfData] = useState<Record<string, { revenue: number; revenue_30d: number; units_sold: number; heat: string; margin_pct: number; days_since_sale: number }>>({});
  const [sortBy, setSortBy] = useState<'default' | 'revenue' | 'margin' | 'stock'>('default');

  useEffect(() => {
    if (!shopId) return;
    reportsApi.getProductPerformance(shopId).then(r => setPerfData(r.data ?? {})).catch(() => {});
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    import('@/lib/api').then(({ subscriptionApi }) => {
      subscriptionApi.getCurrent(shopId)
        .then((res) => setPlanType(res.data?.plan?.plan_type ?? ''))
        .catch(() => {});
    });
  }, [shopId]);

  const isTheDersiBasic = planType === 'thedersi_basic';
  const canBulkUpload = planType === 'premium' || planType === 'thedersi_pro';
  const isTheDersiBasicUser = planType === 'thedersi_basic';

  const togglePrintSelect = (id: string) => {
    setSelectedForPrint(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkPrint = () => {
    const items = displayedProducts
      .filter(p => selectedForPrint.has(p.id) && (p as any).barcode)
      .map(p => ({
        name: p.name,
        sku: p.sku,
        barcode: (p as any).barcode,
        // Barcode price tag — real charged amount, not a display conversion.
        price: fmtBase(p.sellingPrice),
      }));
    if (!items.length) return;
    const data = encodeURIComponent(JSON.stringify(items));
    window.open(`/dashboard/products/barcode?data=${data}`, '_blank');
    setSelectedForPrint(new Set());
  };

  const stockFiltered = stockFilter === 'low'
    ? products.filter(p => p.stock > 0 && p.stock <= p.lowStockAlert)
    : stockFilter === 'out'
    ? products.filter(p => p.stock === 0)
    : products;

  const filteredProducts = channelFilter === 'unlisted'
    ? stockFiltered.filter(p => !channelStatuses[p.id] || Object.keys(channelStatuses[p.id]).length === 0)
    : channelFilter !== 'all'
    ? stockFiltered.filter(p => !!channelStatuses[p.id]?.[channelFilter])
    : stockFiltered;

  const displayedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'revenue') return (perfData[b.id]?.revenue ?? 0) - (perfData[a.id]?.revenue ?? 0);
    if (sortBy === 'margin') return (perfData[b.id]?.margin_pct ?? 0) - (perfData[a.id]?.margin_pct ?? 0);
    if (sortBy === 'stock') return a.stock - b.stock;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground text-sm">Manage your product catalog</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fetchProducts()}
            className="inline-flex items-center gap-2 border border-border px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="Refresh products"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {selectedForPrint.size > 0 && (
            isTheDersiBasic ? (
              <div className="inline-flex items-center gap-2 border border-border text-muted-foreground px-4 py-2.5 rounded-lg text-sm cursor-not-allowed select-none" title="Upgrade to TheDersi Pro to bulk print">
                <Lock className="w-4 h-4" />
                Bulk Print ({selectedForPrint.size}) — Pro only
              </div>
            ) : (
              <button
                type="button"
                onClick={handleBulkPrint}
                className="inline-flex items-center gap-2 border border-primary text-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/10 transition text-sm"
              >
                <Printer className="w-4 h-4" />
                Print {selectedForPrint.size} Barcode{selectedForPrint.size !== 1 ? 's' : ''}
              </button>
            )
          )}
          {canBulkUpload ? (
            <button
              type="button"
              onClick={() => { setCsvRows([]); setCsvError(''); setCsvResult(null); setShowCsvModal(true); }}
              className="inline-flex items-center justify-center gap-2 border border-border text-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-muted transition"
            >
              <FileSpreadsheet className="w-5 h-5" /> Bulk Upload
            </button>
          ) : (
            <div className="relative group/bulk">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 border border-border text-muted-foreground/50 px-4 py-2.5 rounded-lg font-medium cursor-not-allowed select-none"
              >
                <Lock className="w-4 h-4" />
                <FileSpreadsheet className="w-5 h-5" /> Bulk Upload
              </button>
              <div className="absolute right-0 top-full mt-1.5 z-20 hidden group-hover/bulk:block pointer-events-none">
                <div className="bg-foreground text-background text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                  {isTheDersiBasicUser ? 'Only for TheDersi Pro' : 'Only for Premium plan'}
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => { setEditingProduct(null); setShowAddModal(true); }}
            className="inline-flex items-center justify-center gap-2 bg-foreground text-background px-4 py-2.5 rounded-lg font-semibold hover:opacity-90 transition text-sm"
          >
            <Plus className="w-5 h-5" /> Add Product
          </button>
        </div>
      </div>

      <UsageBanner shopId={shopId} show={['products', 'orders']} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total products', icon: Package, value: loading ? '—' : String(products.length), color: '' },
          { label: 'Categories', icon: Star, value: String(categories.length), color: '' },
          { label: 'Low stock', icon: AlertCircle, value: loading ? '—' : String(lowStockCount), color: lowStockCount > 0 ? 'text-orange-600 dark:text-orange-400' : '' },
          { label: 'Out of stock', icon: AlertCircle, value: loading ? '—' : String(outOfStockCount), color: outOfStockCount > 0 ? 'text-red-600 dark:text-red-400' : '' },
        ].map(({ label, icon: Icon, value, color }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="h-4 w-4 text-foreground/70" /></div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className={`text-lg font-bold leading-tight tracking-tight tabular-nums ${color || 'text-foreground'}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Missing SKU banner */}
      {!loading && missingSkuCount > 0 && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-orange-600 dark:text-orange-400">
            <span className="font-semibold">{missingSkuCount}</span> product{missingSkuCount !== 1 ? 's' : ''} {missingSkuCount !== 1 ? "don't" : "doesn't"} have a SKU yet.
          </p>
          <button
            type="button"
            onClick={handleGenerateSkus}
            disabled={generatingSkus}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-500/25 transition font-medium disabled:opacity-50"
          >
            {generatingSkus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Generate missing SKUs
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/10 outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="relative">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as typeof channelFilter)}
              aria-label="Filter by channel"
              className="appearance-none w-full sm:w-48 px-4 py-2.5 pr-10 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/10 outline-none text-foreground"
            >
              <option value="all">All Channels</option>
              <option value="thedersi">TheDersi</option>
              <option value="daraz">Daraz</option>
              <option value="ebay">eBay</option>
              <option value="unlisted">Not listed anywhere</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          </div>
          {/* Sort + Stock quick-filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                className="appearance-none pl-8 pr-8 py-1.5 bg-muted border border-border rounded-lg text-xs font-medium text-foreground focus:ring-2 focus:ring-foreground/10 outline-none cursor-pointer">
                <option value="default">Sort: Default</option>
                <option value="revenue">Sort: Revenue ↓</option>
                <option value="margin">Sort: Margin ↓</option>
                <option value="stock">Sort: Stock ↑</option>
              </select>
              <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <button
              onClick={() => setStockFilter('all')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${stockFilter === 'all' ? 'bg-foreground text-background border-foreground' : 'bg-muted text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'}`}
            >All</button>
            {outOfStockCount > 0 && (
              <button
                onClick={() => setStockFilter('out')}
                className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${stockFilter === 'out' ? 'bg-red-500 text-white border-red-500' : 'bg-muted text-red-500 border-red-500/30 hover:border-red-500'}`}
              >Out of stock ({outOfStockCount})</button>
            )}
            {lowStockCount > 0 && (
              <button
                onClick={() => setStockFilter('low')}
                className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${stockFilter === 'low' ? 'bg-orange-500 text-white border-orange-500' : 'bg-muted text-orange-500 border-orange-500/30 hover:border-orange-500'}`}
              >Low stock ({lowStockCount})</button>
            )}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="p-16 text-center">
            <Package className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">
              {searchQuery || stockFilter !== 'all' || channelFilter !== 'all' ? 'No products found' : 'No products yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {stockFilter !== 'all'
                ? 'No products match this stock filter'
                : channelFilter !== 'all'
                ? 'No products match this channel filter'
                : searchQuery
                ? 'Try adjusting your search or filters'
                : 'Add your first product to start selling'}
            </p>
            {stockFilter !== 'all' ? (
              <button type="button" onClick={() => setStockFilter('all')} className="inline-flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition">
                Clear filter
              </button>
            ) : channelFilter !== 'all' ? (
              <button type="button" onClick={() => setChannelFilter('all')} className="inline-flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition">
                Clear filter
              </button>
            ) : !searchQuery && (
              <button
                type="button"
                onClick={() => { setEditingProduct(null); setShowAddModal(true); }}
                className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                <Plus className="w-4 h-4" /> Add First Product
              </button>
            )}
          </div>
        ) : (
          <>
            {(() => {
              const noBarcodeCount = displayedProducts.filter(p => !(p as any).barcode).length;
              return noBarcodeCount > 0 ? (
                <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b border-border flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Checkboxes select products for barcode printing — {noBarcodeCount} product{noBarcodeCount !== 1 ? 's' : ''} below {noBarcodeCount !== 1 ? "don't" : "doesn't"} have a barcode yet, so {noBarcodeCount !== 1 ? "they're" : "it's"} not selectable. Generate one from the product's edit page first.
                </div>
              ) : null;
            })()}
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-4 w-10">
                      {(() => {
                        const withBarcode = displayedProducts.filter(p => (p as any).barcode);
                        const allSelected = withBarcode.length > 0 && withBarcode.every(p => selectedForPrint.has(p.id));
                        return (
                          <input
                            type="checkbox"
                            title="Select all with barcodes"
                            checked={allSelected}
                            onChange={() => {
                              if (allSelected) {
                                setSelectedForPrint(new Set());
                              } else {
                                setSelectedForPrint(new Set(withBarcode.map(p => p.id)));
                              }
                            }}
                            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                          />
                        );
                      })()}
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Product</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">SKU</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Cost</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Price</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Revenue</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Margin</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Stock</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedProducts.map((product) => (
                    <tr key={product.id} className={`hover:bg-muted/30 transition ${selectedForPrint.has(product.id) ? 'bg-primary/5' : ''}`}>
                      <td className="p-4 w-10">
                        {(product as any).barcode ? (
                          <input
                            type="checkbox"
                            checked={selectedForPrint.has(product.id)}
                            onChange={() => togglePrintSelect(product.id)}
                            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                          />
                        ) : (
                          // This checkbox is for bulk barcode printing — a
                          // product with no barcode has nothing to print, so
                          // selecting it wouldn't do anything. Shown disabled
                          // with a reason instead of just vanishing, which
                          // read as broken rather than intentional.
                          <input
                            type="checkbox"
                            disabled
                            title="Generate a barcode for this product first to select it for printing"
                            className="w-4 h-4 rounded border-border cursor-not-allowed opacity-30"
                          />
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                            {((product as any).image_url || product.image)
                              ? <img src={(product as any).image_url || product.image!} alt={product.name} className="w-full h-full object-cover" />
                              : <Package className="w-6 h-6 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0 max-w-[280px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium text-foreground truncate" title={product.name}>{product.name}</span>
                              {perfData[product.id]?.heat === 'hot' && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                              {perfData[product.id]?.heat === 'moving' && <TrendingUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              {perfData[product.id] && perfData[product.id].heat === 'slow' && <Snowflake className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground/60 font-mono">#{product.id}</p>
                            {channelStatuses[product.id]?.thedersi && (() => {
                              const s = channelStatuses[product.id].thedersi;
                              const badge = s.status === 'approved'
                                ? { label: '✅ Live on TheDersi', cls: 'text-green-600 dark:text-green-400' }
                                : s.status === 'rejected'
                                ? { label: '❌ Rejected', cls: 'text-red-500' }
                                : s.status === 'sync_failed'
                                ? { label: '⚠️ Failed to send to TheDersi', cls: 'text-red-500' }
                                : { label: '🟡 Pending Review', cls: 'text-yellow-600 dark:text-yellow-400' };
                              return (
                                <>
                                  <p className={`text-xs mt-0.5 ${badge.cls}`}>{badge.label}</p>
                                  {(s.status === 'rejected' || s.status === 'sync_failed') && s.rejection_reason && (
                                    <p className="text-xs mt-0.5 text-red-500 bg-red-500/10 rounded px-1.5 py-0.5 max-w-[220px] leading-snug">{s.rejection_reason}</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {product.sku
                          ? <span className="text-sm text-muted-foreground font-mono">{product.sku}</span>
                          : <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Missing</span>}
                      </td>
                      <td className="p-4">
                        {(() => {
                          // Just the channels this product is actually listed
                          // on — the full category breadcrumb (e.g. "Jewelry
                          // & Watches > Fashion Jewelry > Bracelets & Charms")
                          // is editing detail, not list-scanning detail, and
                          // was pushing rows to 3 lines tall.
                          // A ProductChannelCategory row exists as soon as a
                          // category is picked for that channel — is_listed
                          // is the actual "seller turned this on" flag, so a
                          // channel the seller never enabled (or unlisted
                          // again) must not show a badge here.
                          const catEntries = channelCategories[product.id]
                            ? Object.values(channelCategories[product.id]).filter((e) => e.is_listed)
                            : [];
                          if (catEntries.length === 0) {
                            return <span className="text-sm text-muted-foreground/40">—</span>;
                          }
                          return (
                            <div className="flex flex-wrap gap-1">
                              {catEntries.map((entry, i) => (
                                <span key={i} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                                  {channelLabel(entry.channel_type)}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-4 text-right"><span className="text-sm text-muted-foreground">{fmt(product.costPrice)}</span></td>
                      <td className="p-4 text-right"><span className="text-sm font-medium text-foreground">{fmt(product.sellingPrice)}</span></td>
                      <td className="p-4 text-right">
                        {perfData[product.id] ? (
                          <div>
                            <span className="text-sm font-medium text-foreground">{fmt(perfData[product.id].revenue, 0)}</span>
                            {perfData[product.id].revenue_30d > 0 && <p className="text-xs text-muted-foreground">{fmt(perfData[product.id].revenue_30d, 0)} /30d</p>}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="p-4 text-right">
                        {perfData[product.id]?.margin_pct ? (
                          <span className={`text-sm font-semibold ${perfData[product.id].margin_pct >= 40 ? 'text-green-600 dark:text-green-400' : perfData[product.id].margin_pct >= 20 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                            {perfData[product.id].margin_pct}%
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                          product.stock === 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : product.stock <= product.lowStockAlert ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                          : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(product as any).barcode && (
                            <button
                              type="button"
                              title="Print barcode label"
                              onClick={() => {
                                const data = encodeURIComponent(JSON.stringify([{
                                  name: product.name,
                                  sku: product.sku,
                                  barcode: (product as any).barcode,
                                  // A printed barcode tag is a real price sticker — it must show
                                  // the actual charged amount, not a currency-preview conversion.
                                  price: fmtBase(product.sellingPrice),
                                }]));
                                window.open(`/dashboard/products/barcode?data=${data}`, '_blank');
                              }}
                              className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"
                            >
                              <Barcode className="w-4 h-4" />
                            </button>
                          )}
                          <button type="button" onClick={() => { setEditingProduct(product); setShowAddModal(true); }} aria-label={`Edit ${product.name}`} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setShowDeleteConfirm(product.id)} aria-label={`Delete ${product.name}`} className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {displayedProducts.map((product) => (
                <div key={product.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {((product as any).image_url || product.image)
                        ? <img src={(product as any).image_url || product.image!} alt={product.name} className="w-full h-full object-cover" />
                        : <Package className="w-8 h-8 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-medium text-foreground truncate">{product.name}</h3>
                        {perfData[product.id]?.heat === 'hot' && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        {perfData[product.id]?.heat === 'moving' && <TrendingUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {product.sku || <span className="text-orange-600 dark:text-orange-400 font-sans font-medium">Missing SKU</span>}
                        <span className="text-muted-foreground/50"> · #{product.id}</span>
                      </p>
                      {channelStatuses[product.id]?.thedersi && (() => {
                        const s = channelStatuses[product.id].thedersi;
                        const badge = s.status === 'approved'
                          ? { label: '✅ Live on TheDersi', cls: 'text-green-600 dark:text-green-400' }
                          : s.status === 'rejected'
                          ? { label: '❌ Rejected', cls: 'text-red-500' }
                          : s.status === 'sync_failed'
                          ? { label: '⚠️ Failed to send to TheDersi', cls: 'text-red-500' }
                          : { label: '🟡 Pending Review', cls: 'text-yellow-600 dark:text-yellow-400' };
                        return (
                          <>
                            <p className={`text-xs mt-0.5 ${badge.cls}`}>{badge.label}</p>
                            {(s.status === 'rejected' || s.status === 'sync_failed') && s.rejection_reason && (
                              <p className="text-xs mt-0.5 text-red-500 bg-red-500/10 rounded px-1.5 py-0.5 leading-snug">{s.rejection_reason}</p>
                            )}
                          </>
                        );
                      })()}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{fmt(product.sellingPrice)}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${product.stock === 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : product.stock <= product.lowStockAlert ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                          {product.stock} in stock
                        </span>
                        {perfData[product.id]?.revenue > 0 && (
                          <span className="text-xs text-muted-foreground">{fmt(perfData[product.id].revenue, 0)} earned</span>
                        )}
                        {perfData[product.id]?.margin_pct > 0 && (
                          <span className={`text-xs font-semibold ${perfData[product.id].margin_pct >= 40 ? 'text-green-600 dark:text-green-400' : 'text-amber-500'}`}>{perfData[product.id].margin_pct}% margin</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setEditingProduct(product); setShowAddModal(true); }} aria-label={`Edit ${product.name}`} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"><Edit className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setShowDeleteConfirm(product.id)} aria-label={`Delete ${product.name}`} className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <ProductModal
          product={editingProduct}
          shopId={shopId}
          categories={categories}
          allProducts={products}
          channelStatus={editingProduct ? channelStatuses[editingProduct.id]?.thedersi : undefined}
          onClose={() => { setShowAddModal(false); setEditingProduct(null); }}
          onSaved={() => { setShowAddModal(false); setEditingProduct(null); fetchProducts(); }}
        />
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Product?</h3>
            <p className="text-sm text-muted-foreground mb-6">This action cannot be undone. The product will be permanently removed.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Import Products from CSV</h2>
              <button type="button" onClick={() => setShowCsvModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Template download */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-1">CSV Format</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Columns: <code className="bg-muted px-1 rounded">name, sku, price, cost_price, quantity, low_stock_threshold, description, category</code>
                </p>
                <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <Download className="w-4 h-4" /> Download Template
                </button>
              </div>

              {/* Upload area */}
              {!csvResult && (
                <div
                  onClick={() => csvInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-foreground/40 transition"
                >
                  <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium">Click to upload CSV file</p>
                  <p className="text-muted-foreground text-sm mt-1">.csv files only</p>
                  <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
                </div>
              )}

              {csvError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{csvError}</p>
                </div>
              )}

              {/* Preview table */}
              {csvRows.length > 0 && !csvResult && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">{csvRows.length} rows ready to import</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {['Name', 'SKU', 'Price', 'Qty', 'Category'].map(h => (
                            <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {csvRows.slice(0, 10).map((row, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-foreground">{row.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.sku || '—'}</td>
                            <td className="px-3 py-2 text-foreground">{fmtBase(row.price)}</td>
                            <td className="px-3 py-2 text-foreground">{row.quantity}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.category || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvRows.length > 10 && (
                      <p className="text-xs text-muted-foreground p-3 border-t border-border">...and {csvRows.length - 10} more rows</p>
                    )}
                  </div>
                </div>
              )}

              {/* Result */}
              {csvResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <p className="font-medium">{csvResult.created} products imported successfully</p>
                  </div>
                  {csvResult.skipped > 0 && (
                    <p className="text-sm text-muted-foreground">{csvResult.skipped} rows skipped</p>
                  )}
                  {csvResult.errors.length > 0 && (
                    <div className="bg-red-500/10 rounded-lg p-3 space-y-1">
                      {csvResult.errors.map((e, i) => (
                        <p key={i} className="text-red-400 text-xs">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setShowCsvModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">
                {csvResult ? 'Close' : 'Cancel'}
              </button>
              {csvRows.length > 0 && !csvResult && (
                <button
                  type="button"
                  onClick={handleCsvImport}
                  disabled={csvImporting}
                  className="flex-1 py-2.5 bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {csvImporting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Import {csvRows.length} Products
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Product Modal ────────────────────────────────────────────────────────────

interface PendingImage {
  file: File;
  preview: string;
}

function ProductModal({
  product, shopId, categories, allProducts, channelStatus, onClose, onSaved,
}: {
  product: Product | null;
  shopId: string;
  categories: ProductCategory[];
  allProducts: Product[];
  channelStatus?: { status: string; rejection_reason?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  // Price ENTRY always happens in the shop's fixed base currency (baseSym)
  // — never the freely-changeable display currency (sym) — so what a
  // seller types is never ambiguous about which currency it's actually in.
  const { baseSym } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const p = product as any;
  const [formData, setFormData] = useState({
    name: p?.name ?? '',
    sku: p?.sku ?? '',
    barcode: p?.barcode ?? '',
    description: p?.description ?? '',
    category: p?.category?.name ?? (typeof p?.category === 'string' ? p?.category : '') ?? categories[0]?.name ?? '',
    costPrice: p?.cost_price ?? p?.costPrice ?? 0,
    sellingPrice: p?.price ?? p?.sellingPrice ?? 0,
    compareAtPrice: p?.compare_at_price ?? p?.compareAtPrice ?? 0,
    stock: p?.quantity ?? p?.stock ?? 0,
    lowStockAlert: p?.low_stock_threshold ?? p?.lowStockAlert ?? 5,
    vatPercent: p?.vat_percent ?? p?.vatPercent ?? 5,
    listOnMarketplace: p?.list_on_marketplace ?? true,
    isGift: p?.is_gift ?? false,
    supplierId: p?.supplier_id ?? null as number | null,
    isDropshipImported: p?.is_dropship_imported ?? false,
  });

  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);

  // Custom fields state
  const [customFields, setCustomFields] = useState<ShopField[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});

  // Images state
  const [savedImages, setSavedImages] = useState<ProductImage[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  // Videos — YouTube/TikTok links only, no upload. Thumbnail/title come
  // back from the server (oEmbed), not entered by the seller.
  const [savedVideos, setSavedVideos] = useState<ProductVideoType[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [addingVideo, setAddingVideo] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [deletingVideoId, setDeletingVideoId] = useState<number | null>(null);

  // Size chart — one optional image, separate from the product photo gallery
  const [sizeChartUrl, setSizeChartUrl] = useState(p?.size_chart_url ?? '');
  const [uploadingSizeChart, setUploadingSizeChart] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Variants state
  interface Variant { id?: number; size: string; color: string; color_hex: string; sku: string; quantity: number; price: string; image_url: string; _pendingFile?: File; _previewUrl?: string; }
  const emptyVariant = (): Variant => ({ size: '', color: '', color_hex: '', sku: '', quantity: 0, price: '', image_url: '' });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [uploadingVariantIdx, setUploadingVariantIdx] = useState<number | null>(null);
  const [variantImageError, setVariantImageError] = useState<string>('');

  // Bundle state
  const [isBundleEnabled, setIsBundleEnabled] = useState(p?.is_bundle ?? false);
  const [bundleComponents, setBundleComponents] = useState<BundleComponent[]>([]);

  // TheDersi channel category state
  const [theDersiConnection, setTheDersiConnection] = useState<{ id: number } | null>(null);
  const [theDersiCategories, setTheDersiCategories] = useState<{ id: string; name: string; parent_id?: string | null }[]>([]);
  const [theDersiCategoryId, setTheDersiCategoryId] = useState('');
  const [theDersiCategoryName, setTheDersiCategoryName] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);
  // Dynamic product-fields spec fetched live from TheDersi's own API
  // (Material, Metal Type, Gemstone, etc — never hardcoded here, see
  // channelsApi.getProductFields). One text input per {key,label}; blank
  // ones just don't send that key.
  const [theDersiFieldDefs, setTheDersiFieldDefs] = useState<{ key: string; label: string }[]>([]);
  const [theDersiFieldValues, setTheDersiFieldValues] = useState<Record<string, string>>({});
  const [loadingFieldDefs, setLoadingFieldDefs] = useState(false);

  // Other-channel state (Daraz / Shopify / Custom Website) — kept fully
  // separate from TheDersi's state above so TheDersi's existing behavior
  // is never touched. Phase 1 (this): UI + toggle interaction only.
  // Phase 2 (backend, not yet built): actually wiring these toggles to
  // control what gets pushed where — see delightful-spinning-wadler.md.
  const [darazConnection, setDarazConnection] = useState<{ id: number } | null>(null);
  const [darazCategories, setDarazCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingDarazCategories, setLoadingDarazCategories] = useState(false);
  // Every channel's category field opens the same full-size, searchable
  // picker (same width/height as the whole modal) instead of a tiny
  // dropdown — one shared overlay, keyed by which channel triggered it.
  const [activeCategoryPicker, setActiveCategoryPicker] = useState<'thedersi' | 'daraz' | 'ebay' | null>(null);
  const [categoryPickerSearch, setCategoryPickerSearch] = useState('');
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [customWebsiteConnection, setCustomWebsiteConnection] = useState<{ id: number } | null>(null);

  // Daraz — actually creating the listing (separate from just toggling it on)
  const [darazAttributeValues, setDarazAttributeValues] = useState<Record<string, string>>({});
  const [darazBrand, setDarazBrand] = useState('');
  const [darazListingStatus, setDarazListingStatus] = useState<{ item_id: string; status: string } | null>(null);
  const [listingDaraz, setListingDaraz] = useState(false);
  const [darazListingError, setDarazListingError] = useState('');

  // eBay channel category state — mirrors Daraz's split-out state exactly.
  // eBay's publish is synchronous (unlike Daraz's pending-review flow), so
  // ebayListingStatus only ever needs a plain "listed" flag, no QC polling.
  const [ebayConnection, setEbayConnection] = useState<{ id: number } | null>(null);
  const [ebayCategories, setEbayCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingEbayCategories, setLoadingEbayCategories] = useState(false);
  const [ebayAspectValues, setEbayAspectValues] = useState<Record<string, string>>({});
  const [ebayCondition, setEbayCondition] = useState('NEW');
  const [ebayListingStatus, setEbayListingStatus] = useState<{ listing_ids: string[] } | null>(null);
  const [listingEbay, setListingEbay] = useState(false);
  const [ebayListingError, setEbayListingError] = useState('');

  // Noon — separate from otherChannels (Noon's category is a flat searched
  // code, not a tree pick, and creation is synchronous — no pending-review
  // step like Daraz, Noon's response is a direct success/fail).
  const [noonConnection, setNoonConnection] = useState<{ id: number } | null>(null);
  const [noonEnabled, setNoonEnabled] = useState(false);
  const [noonCategoryCode, setNoonCategoryCode] = useState('');
  const [noonBrand, setNoonBrand] = useState('');
  const [noonCountry, setNoonCountry] = useState<'ae' | 'sa' | 'eg'>('ae');
  const [noonAttributeValues, setNoonAttributeValues] = useState<NoonAttributeValues>({});
  const [noonListingStatus, setNoonListingStatus] = useState<{ skuParent: string } | null>(null);
  const [listingNoon, setListingNoon] = useState(false);
  const [noonListingError, setNoonListingError] = useState('');

  interface OtherChannelToggle { enabled: boolean; isGift: boolean; categoryId: string; categoryName: string }
  const [otherChannels, setOtherChannels] = useState<Record<'daraz' | 'shopify' | 'custom' | 'ebay', OtherChannelToggle>>({
    daraz: { enabled: false, isGift: false, categoryId: '', categoryName: '' },
    shopify: { enabled: false, isGift: false, categoryId: '', categoryName: '' },
    custom: { enabled: false, isGift: false, categoryId: '', categoryName: '' },
    ebay: { enabled: false, isGift: false, categoryId: '', categoryName: '' },
  });
  const setOtherChannelEnabled = (key: 'daraz' | 'shopify' | 'custom' | 'ebay', enabled: boolean) =>
    setOtherChannels((prev) => ({ ...prev, [key]: { ...prev[key], enabled } }));
  const setOtherChannelGift = (key: 'daraz' | 'shopify' | 'custom' | 'ebay', isGift: boolean) =>
    setOtherChannels((prev) => ({ ...prev, [key]: { ...prev[key], isGift } }));

  // Custom Website — storefront category tree (flattened, indented) +
  // seller-defined extra fields (custom-website-fields page). Both scoped
  // to this one channel, same reasoning as everywhere else in this file:
  // eBay/Daraz/Noon each only make sense for their own channel's section.
  const [customCategories, setCustomCategories] = useState<{ id: number; name: string; parent_id: number | null }[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomProductField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(p?.custom_field_values ?? {});

  const customCategoryOptions = (() => {
    const byParent = new Map<number | null, typeof customCategories>();
    customCategories.forEach((c) => {
      const list = byParent.get(c.parent_id) ?? [];
      list.push(c);
      byParent.set(c.parent_id, list);
    });
    const out: { id: number; label: string }[] = [];
    const walk = (parentId: number | null, depth: number) => {
      (byParent.get(parentId) ?? []).forEach((c) => {
        out.push({ id: c.id, label: `${'— '.repeat(depth)}${c.name}` });
        walk(c.id, depth + 1);
      });
    };
    walk(null, 0);
    return out;
  })();

  // POS — real per-product toggle (defaults on, seller can turn it off) +
  // its own independent gift toggle, same nested pattern as every channel.
  const [posEnabled, setPosEnabled] = useState(p?.pos_enabled ?? true);
  const [posIsGift, setPosIsGift] = useState(p?.pos_is_gift ?? false);

  const [imageLimit, setImageLimit] = useState(6);
  const [descriptionWordLimit, setDescriptionWordLimit] = useState(200);
  const [descriptionImageLimit, setDescriptionImageLimit] = useState(5);
  const variantImageCount = variants.filter(v => v.image_url && v.image_url !== '').length;
  const totalImages = savedImages.length + pendingImages.length + variantImageCount;
  const descriptionWordCount = countWords(formData.description);

  // Category → controls which custom fields (Material, Pattern, etc.) and
  // the size chart upload show up. Applies to every seller, TheDersi
  // included — TheDersi's own platform is fashion-only, but TheDersi
  // sellers also get a Daraz connection (a general marketplace), so a
  // TheDersi shop can easily have non-fashion products too.
  // The generic ExiusCart-only category (separate from each channel's own
  // real category, e.g. TheDersi's/Daraz's/eBay's own pickers below) was
  // removed from this form — each channel already has its own specific
  // category, so forcing a second, unrelated one here was pure overhead.
  // Existing products keep whatever category they already had (not
  // touched by this form anymore); Settings → Product Fields still
  // manages the underlying field definitions.

  // Load existing product data and TheDersi categories on mount
  useEffect(() => {
    if (!shopId) return;

    suppliersApi.getAll(shopId)
      .then((res) => setSuppliers((res.data ?? []).map((s: any) => ({ id: s.id, name: s.name }))))
      .catch(() => {});

    imagesApi.getLimit(shopId)
      .then((res) => {
        setImageLimit(res.data?.limit ?? 6);
        setDescriptionWordLimit(res.data?.description_word_limit ?? 200);
        setDescriptionImageLimit(res.data?.description_image_limit ?? 5);
      })
      .catch(() => {});

    if (product?.id) {
      attributesApi.get(shopId, product.id)
        .then((res) => setAttrValues(res.data ?? {}))
        .catch(() => {});

      imagesApi.getAll(shopId, product.id)
        .then((res) => setSavedImages(res.data ?? []))
        .catch(() => {});

      videosApi.getAll(shopId, product.id)
        .then((res) => setSavedVideos(res.data ?? []))
        .catch(() => {});

      variantsApi.getAll(shopId, product.id)
        .then((res) => setVariants((res.data ?? []).map((v: any) => ({
          id: v.id, size: v.size ?? '', color: v.color ?? '', color_hex: v.color_hex ?? '',
          sku: v.sku ?? '', quantity: v.quantity ?? 0,
          price: v.price != null ? String(v.price) : '',
          image_url: v.image_url ?? '',
        }))))
        .catch(() => {});

      if (p?.is_bundle) {
        bundlesApi.getComponents(shopId, String(product.id))
          .then(res => setBundleComponents((res.data ?? []).map((c: any) => ({
            component_product_id: c.component_product_id,
            component_product_name: c.component_product_name,
            allowed_variant_ids: c.allowed_variant_ids ?? [],
            quantity: c.quantity,
          }))))
          .catch(() => {});
      }
    }

    // Auto-refresh TheDersi categories every time form opens
    channelsApi.getConnections(shopId)
      .then((res) => {
        const dersi = (res.data ?? []).find((c: any) => c.channel_type === 'thedersi');
        if (!dersi) return;
        setTheDersiConnection({ id: dersi.id });
        setLoadingCategories(true);
        // Sync from TheDersi (fire-and-forget), then fetch cached list
        channelsApi.syncCategories(shopId, dersi.id)
          .catch(() => {})
          .finally(() => {
            channelsApi.getCategories(shopId, dersi.id)
              .then((r) => setTheDersiCategories(r.data ?? []))
              .catch(() => {})
              .finally(() => setLoadingCategories(false));
          });

        // Product-fields spec — live from TheDersi's own API (server caches
        // it ~1hr), never hardcoded here. Empty result just means no extra
        // fields for this connection right now.
        setLoadingFieldDefs(true);
        channelsApi.getProductFields(shopId, dersi.id)
          .then((r) => setTheDersiFieldDefs(r.data ?? []))
          .catch(() => {})
          .finally(() => setLoadingFieldDefs(false));

        // If editing, load already-saved TheDersi category + field values for this product
        if (product?.id) {
          channelsApi.getProductChannelCategories(shopId, product.id)
            .then((r) => {
              const entry = (r.data ?? []).find((s: any) => s.channel_connection_id === dersi.id);
              if (entry) {
                setTheDersiCategoryId(entry.channel_category_id);
                setTheDersiCategoryName(entry.channel_category_name);
                setTheDersiFieldValues(entry.channel_field_values ?? {});
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [shopId, product?.id]);

  // Other-channel connection status (Daraz / Shopify / Custom Website) — a
  // separate effect from TheDersi's above, on purpose, so TheDersi's logic
  // stays untouched.
  useEffect(() => {
    if (!shopId) return;

    channelsApi.getConnections(shopId)
      .then((res) => {
        const data = res.data ?? [];
        const daraz = data.find((c: any) => c.channel_type === 'daraz');
        const custom = data.find((c: any) => c.channel_type === 'custom');
        if (daraz) {
          setDarazConnection({ id: daraz.id });
          if (product?.id) {
            channelsApi.getDarazListingStatus(shopId, product.id)
              .then((r) => setDarazListingStatus({ item_id: r.data?.item_id, status: r.data?.qc_status?.status ?? 'pending_review' }))
              .catch(() => {}); // 404 = not listed yet, fine
          }
          setLoadingDarazCategories(true);
          // Daraz's tree is arbitrarily deep, so the backend flattens it to
          // leaf-only breadcrumb names (e.g. "Bags > Kids Bags > Backpacks")
          // — same cache-then-fetch pattern as TheDersi above.
          channelsApi.syncCategories(shopId, daraz.id)
            .catch(() => {})
            .finally(() => {
              channelsApi.getCategories(shopId, daraz.id)
                .then((r) => setDarazCategories(r.data ?? []))
                .catch(() => {})
                .finally(() => setLoadingDarazCategories(false));
            });
        }
        if (custom) {
          setCustomWebsiteConnection({ id: custom.id });
          channelsApi.listStorefrontCategories(shopId, 'custom')
            .then((r) => setCustomCategories(r.data ?? []))
            .catch(() => {});
          customProductFieldsApi.get(shopId)
            .then((r) => setCustomFieldDefs(r.data?.fields ?? []))
            .catch(() => {});
        }

        const noon = data.find((c: any) => c.channel_type === 'noon');
        if (noon) setNoonConnection({ id: noon.id });

        const ebay = data.find((c: any) => c.channel_type === 'ebay');
        if (ebay) {
          setEbayConnection({ id: ebay.id });
          if (product?.id) {
            ebayApi.getListingStatus(shopId, product.id)
              .then((r) => setEbayListingStatus({ listing_ids: [r.data?.listing_id].filter(Boolean) }))
              .catch(() => {}); // 404 = not listed yet, fine
          }
          setLoadingEbayCategories(true);
          // eBay's tree is arbitrarily deep too — same cache-then-fetch
          // pattern as Daraz above, just via the Taxonomy API.
          channelsApi.syncCategories(shopId, ebay.id)
            .catch(() => {})
            .finally(() => {
              channelsApi.getCategories(shopId, ebay.id)
                .then((r) => setEbayCategories(r.data ?? []))
                .catch(() => {})
                .finally(() => setLoadingEbayCategories(false));
            });
        }

        if (product?.id) {
          channelsApi.getProductChannelCategories(shopId, product.id)
            .then((r) => {
              const entries = r.data ?? [];
              if (daraz) {
                const entry = entries.find((s: any) => s.channel_connection_id === daraz.id);
                if (entry) {
                  setOtherChannels((prev) => ({
                    ...prev,
                    daraz: {
                      ...prev.daraz,
                      enabled: entry.is_listed ?? true,
                      isGift: entry.is_gift ?? false,
                      categoryId: entry.channel_category_id ?? '',
                      categoryName: entry.channel_category_name ?? '',
                    },
                  }));
                }
              }
              if (custom) {
                const entry = entries.find((s: any) => s.channel_connection_id === custom.id);
                if (entry) {
                  setOtherChannels((prev) => ({
                    ...prev,
                    custom: {
                      ...prev.custom,
                      enabled: entry.is_listed ?? true,
                      isGift: entry.is_gift ?? false,
                      categoryId: entry.channel_category_id ?? '',
                      categoryName: entry.channel_category_name ?? '',
                    },
                  }));
                }
              }
              if (ebay) {
                const entry = entries.find((s: any) => s.channel_connection_id === ebay.id);
                if (entry) {
                  setOtherChannels((prev) => ({
                    ...prev,
                    ebay: {
                      ...prev.ebay,
                      enabled: entry.is_listed ?? true,
                      categoryId: entry.channel_category_id ?? '',
                      categoryName: entry.channel_category_name ?? '',
                    },
                  }));
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    shopifyApi.getStatus(shopId)
      .then((res) => setShopifyConnected(res.data?.connected ?? false))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, product?.id]);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingImages.forEach((img) => URL.revokeObjectURL(img.preview));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const MAX_FILE_MB = 5;
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = imageLimit - totalImages;
    const oversized = files.filter(f => f.size > MAX_FILE_BYTES);
    if (oversized.length > 0) {
      setError(`Image must be under ${MAX_FILE_MB}MB. "${oversized[0].name}" is too large.`);
      e.target.value = '';
      return;
    }
    const toAdd = files.slice(0, remaining);
    const newPending: PendingImage[] = toAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingImages((prev) => [...prev, ...newPending]);
    e.target.value = '';
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const deleteSavedImage = async (imageId: number) => {
    if (!product?.id) return;
    setDeletingImageId(imageId);
    try {
      await imagesApi.delete(shopId, product.id, String(imageId));
      setSavedImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch {/* no-op */}
    setDeletingImageId(null);
  };

  const setPrimaryImage = async (imageId: number) => {
    if (!product?.id) return;
    try {
      await imagesApi.setPrimary(shopId, product.id, String(imageId));
      setSavedImages((prev) =>
        prev.map((img) => ({ ...img, is_primary: img.id === imageId }))
      );
    } catch {/* no-op */}
  };

  const handleAddVideo = async () => {
    if (!product?.id || !newVideoUrl.trim()) return;
    setAddingVideo(true);
    setVideoError('');
    try {
      const res = await videosApi.add(shopId, product.id, newVideoUrl.trim());
      setSavedVideos((prev) => [...prev, res.data]);
      setNewVideoUrl('');
    } catch (err: any) {
      setVideoError(err?.response?.data?.detail ?? "Couldn't add that video — check the link and try again.");
    } finally {
      setAddingVideo(false);
    }
  };

  const handleDeleteVideo = async (videoId: number) => {
    if (!product?.id) return;
    setDeletingVideoId(videoId);
    try {
      await videosApi.delete(shopId, product.id, videoId);
      setSavedVideos((prev) => prev.filter((v) => v.id !== videoId));
    } catch {/* no-op */}
    setDeletingVideoId(null);
  };

  const setAttr = (key: string, value: string) => {
    setAttrValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMultiselect = (key: string, option: string) => {
    const current = attrValues[key] ? attrValues[key].split(',').filter(Boolean) : [];
    const updated = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    setAttrValues((prev) => ({ ...prev, [key]: updated.join(',') }));
  };

  const handleListOnDaraz = async () => {
    if (!product?.id || !otherChannels.daraz.categoryId) return;
    setListingDaraz(true);
    setDarazListingError('');
    try {
      const res = await channelsApi.createDarazListing(shopId, product.id, {
        category_id: otherChannels.daraz.categoryId,
        attribute_values: darazAttributeValues,
        brand: darazBrand,
      });
      setDarazListingStatus({ item_id: res.data?.item_id, status: res.data?.status ?? 'pending_review' });
    } catch (err: any) {
      setDarazListingError(err?.response?.data?.detail ?? 'Could not create the Daraz listing. Try again.');
    } finally {
      setListingDaraz(false);
    }
  };

  const handleListOnEbay = async () => {
    if (!product?.id || !otherChannels.ebay.categoryId) return;
    setListingEbay(true);
    setEbayListingError('');
    try {
      const res = await ebayApi.createListing(shopId, product.id, {
        category_id: otherChannels.ebay.categoryId,
        aspect_values: Object.fromEntries(Object.entries(ebayAspectValues).map(([k, v]) => [k, [v]])),
        condition: ebayCondition,
      });
      setEbayListingStatus({ listing_ids: res.data?.listing_ids ?? [] });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setEbayListingError(typeof detail === 'string' ? detail : detail?.message ?? 'Could not create the eBay listing. Try again.');
    } finally {
      setListingEbay(false);
    }
  };

  const handleListOnNoon = async () => {
    if (!product?.id || !noonCategoryCode || !noonBrand) return;
    setListingNoon(true);
    setNoonListingError('');
    try {
      const res = await noonApi.createListing(shopId, product.id, {
        category_code: noonCategoryCode,
        brand: noonBrand,
        attributes: noonAttributeValues,
      });
      if (res.data?.status?.status_code && res.data.status.status_code !== 'OK') {
        setNoonListingError(res.data.status.message || 'Noon rejected this listing.');
      } else {
        setNoonListingStatus({ skuParent: res.data?.sku_parent });
        // Product content alone has no sale price — set it for every SKU
        // Noon just created, same price ExiusCart already has per variant.
        const createdSkus: { partner_sku: string }[] = res.data?.variants ?? [];
        if (createdSkus.length > 0) {
          const priceItems = createdSkus.map((s) => {
            const variant = variants.find((v) => (v.sku || `${formData.sku || product.id}-${v.id}`) === s.partner_sku);
            const price = variant?.price ? Number(variant.price) : formData.sellingPrice;
            return { partner_sku: s.partner_sku, price, country_code: noonCountry };
          });
          noonApi.setPricing(shopId, priceItems).catch(() => {});
        }
      }
    } catch (err: any) {
      setNoonListingError(err?.response?.data?.detail ?? 'Could not create the Noon listing. Try again.');
    } finally {
      setListingNoon(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    if (descriptionWordCount > descriptionWordLimit) {
      setError(`Description is too long — max ${descriptionWordLimit} words for your plan (currently ${descriptionWordCount}).`);
      return;
    }
    setSaving(true);
    setError('');

    try {
      let productId: string;

      // Map camelCase form state to snake_case API fields
      // When variants exist, total stock = sum of variant quantities
      const totalStock = variants.length > 0
        ? variants.reduce((sum, v) => sum + v.quantity, 0)
        : formData.stock;
      const apiData = {
        name: formData.name,
        description: formData.description || null,
        sku: formData.sku || null,
        barcode: formData.barcode || null,
        price: formData.sellingPrice,
        compare_at_price: formData.compareAtPrice > 0 ? formData.compareAtPrice : null,
        cost_price: formData.costPrice > 0 ? formData.costPrice : null,
        quantity: totalStock,
        low_stock_threshold: formData.lowStockAlert,
        // No category_id here anymore — the generic ExiusCart-only
        // category picker was removed from this form (each channel has
        // its own real category instead). Existing products keep
        // whatever category they already had; new ones simply get none.
        list_on_marketplace: formData.listOnMarketplace,
        is_gift: formData.isGift,
        pos_enabled: posEnabled,
        pos_is_gift: posEnabled ? posIsGift : false,
        supplier_id: formData.supplierId ?? null,
        custom_field_values: Object.keys(customFieldValues).length > 0 ? customFieldValues : null,
      };

      if (product?.id) {
        await productsApi.update(shopId, product.id, apiData);
        productId = product.id;
      } else {
        const res = await productsApi.create(shopId, apiData);
        productId = res.data.id ?? String(res.data.id);
      }

      // Everything below only needs productId and is independent — run in parallel
      const tasks: Promise<any>[] = [];

      // Images: upload sequentially (first one becomes primary)
      if (pendingImages.length > 0) {
        for (const pending of pendingImages) {
          await imagesApi.upload(shopId, productId, pending.file).catch(() => {});
        }
      }

      // Save custom attributes
      const attrsPayload = Object.entries(attrValues)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([field_key, value]) => ({ field_key, value }));
      if (attrsPayload.length > 0 || customFields.length > 0) {
        tasks.push(attributesApi.save(shopId, productId, attrsPayload).catch(() => {}));
      }

      // Save variants — upload any pending images first (Add Product mode)
      if (variants.length > 0) {
        const resolvedVariants = await Promise.all(variants.map(async (v) => {
          if (v._pendingFile && productId) {
            try {
              const res = await variantsApi.uploadImage(shopId, productId, v._pendingFile);
              return { ...v, image_url: res.data?.url || v.image_url };
            } catch { return v; }
          }
          return v;
        }));
        tasks.push(variantsApi.save(shopId, productId, resolvedVariants.map((v) => ({
          size: v.size || undefined,
          color: v.color || undefined,
          color_hex: v.color_hex || undefined,
          sku: v.sku || undefined,
          quantity: v.quantity,
          price: v.price !== '' ? Number(v.price) : undefined,
          image_url: v.image_url || undefined,
        }))).catch(() => {}));
      }

      // Per-channel listing state — one call per connected channel, so
      // toggling one channel off only unlists that one, not the others.
      // TheDersi: unchanged connection, now sends real is_listed/is_gift
      // instead of only firing when a category happened to be picked.
      if (theDersiConnection) {
        tasks.push(channelsApi.setProductCategory(shopId, productId, {
          channel_connection_id: theDersiConnection.id,
          is_listed: formData.listOnMarketplace,
          is_gift: formData.isGift,
          channel_category_id: theDersiCategoryId || undefined,
          channel_category_name: theDersiCategoryName || undefined,
          field_values: theDersiFieldValues,
        }).catch(() => {}));
      }

      // Daraz — real ChannelConnection, real is_listed/is_gift now work.
      // Category stays empty until Daraz's real category list is wired up.
      if (darazConnection) {
        tasks.push(channelsApi.setProductCategory(shopId, productId, {
          channel_connection_id: darazConnection.id,
          is_listed: otherChannels.daraz.enabled,
          is_gift: otherChannels.daraz.isGift,
          channel_category_id: otherChannels.daraz.categoryId || undefined,
          channel_category_name: otherChannels.daraz.categoryName || undefined,
        }).catch(() => {}));
      }

      // eBay — real ChannelConnection, real is_listed now works. Category
      // stays whatever the seller picked in the eBay category picker.
      if (ebayConnection) {
        tasks.push(channelsApi.setProductCategory(shopId, productId, {
          channel_connection_id: ebayConnection.id,
          is_listed: otherChannels.ebay.enabled,
          channel_category_id: otherChannels.ebay.categoryId || undefined,
          channel_category_name: otherChannels.ebay.categoryName || undefined,
        }).catch(() => {}));
      }

      // Custom Website — real ChannelConnection, category is the seller's
      // own Storefront Categories tree (channel_category_id holds a
      // StorefrontCategory id, as a string, same field other channels
      // use for their own category ids).
      if (customWebsiteConnection) {
        tasks.push(channelsApi.setProductCategory(shopId, productId, {
          channel_connection_id: customWebsiteConnection.id,
          is_listed: otherChannels.custom.enabled,
          is_gift: otherChannels.custom.isGift,
          channel_category_id: otherChannels.custom.categoryId || undefined,
          channel_category_name: otherChannels.custom.categoryName || undefined,
        }).catch(() => {}));
      }

      // Shopify is NOT wired here on purpose — it doesn't live in the same
      // ChannelConnection table as every other channel (separate ShopifyStore
      // model), so there's no channel_connection_id to save this against yet.
      // Its toggle stays visual-only until that's addressed separately.

      // Save bundle components if bundle is enabled
      if (isBundleEnabled && bundleComponents.length > 0) {
        const validComponents = bundleComponents.filter(c => c.component_product_id > 0);
        tasks.push(bundlesApi.saveComponents(shopId, productId, validComponents).catch(() => {}));
      } else if (!isBundleEnabled && p?.is_bundle) {
        tasks.push(bundlesApi.saveComponents(shopId, productId, []).catch(() => {}));
      }

      await Promise.all(tasks);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to save product. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl max-h-[94vh] p-0 flex flex-col" showCloseButton={false}>

        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between px-6 py-4 space-y-0">
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_460px] flex-1 min-h-0">

            {/* ── LEFT: Content — scrolls independently from the channels panel ── */}
            <div className="p-6 space-y-6 border-r border-border overflow-y-auto min-h-0">

              {/* Alerts */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}
              {channelStatus?.status === 'rejected' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">Rejected on TheDersi</p>
                    {channelStatus.rejection_reason && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{channelStatus.rejection_reason}</p>
                    )}
                    <p className="text-xs text-red-500/80 mt-1">Fix the issue and save — it will be re-submitted for review.</p>
                  </div>
                </div>
              )}

              {/* Product Name */}
              <div>
                <Label className="font-medium text-foreground mb-1.5 block">Product Name *</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. iPhone 15 Pro Max"
                  className="text-base"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Description</Label>
                  <span className={`text-xs ${descriptionWordCount > descriptionWordLimit ? 'text-destructive font-medium' : 'text-muted-foreground/70'}`}>
                    {descriptionWordCount}/{descriptionWordLimit} words
                  </span>
                </div>
                <RichTextEditor
                  value={formData.description}
                  onChange={(html) => setFormData({ ...formData, description: html })}
                  placeholder="Describe the product — material, style, occasion..."
                  rows={3}
                  maxImages={descriptionImageLimit}
                  onUploadImage={(file) => imagesApi.uploadDescriptionImage(shopId, file)}
                />
              </div>

              {/* Images */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>
                    Product Images
                    <span className="ml-1.5 text-xs font-normal">({totalImages}/{imageLimit} total incl. variants)</span>
                  </Label>
                  {totalImages < imageLimit && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="h-auto p-0 text-xs text-primary hover:text-primary/80 hover:bg-transparent">
                      <Upload className="w-3.5 h-3.5" /> Upload
                    </Button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleFileSelect} />
                <div className="grid grid-cols-6 gap-2">
                  {savedImages.map((img) => (
                    <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                      <img src={img.url} alt={img.alt_text ?? ''} className="w-full h-full object-cover" />
                      {img.is_primary && (
                        <div className="absolute top-1 left-1 bg-yellow-400 rounded-full p-0.5">
                          <Star className="w-2.5 h-2.5 text-yellow-900 fill-yellow-900" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                        {!img.is_primary && (
                          <button type="button" onClick={() => setPrimaryImage(img.id)} title="Set as primary" className="p-1 bg-yellow-400 rounded-full hover:bg-yellow-300 transition">
                            <Star className="w-3 h-3 text-yellow-900" />
                          </button>
                        )}
                        <button type="button" onClick={() => deleteSavedImage(img.id)} disabled={deletingImageId === img.id} title="Delete" className="p-1 bg-destructive rounded-full hover:bg-destructive/80 transition">
                          {deletingImageId === img.id ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <X className="w-3 h-3 text-white" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-primary/40 bg-muted">
                      <img src={img.preview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 bg-primary/80 rounded-full px-1 py-0.5">
                        <span className="text-[10px] text-white font-medium">New</span>
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <button type="button" onClick={() => removePendingImage(idx)} className="p-1 bg-destructive rounded-full hover:bg-destructive/80 transition">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {totalImages < imageLimit && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition">
                      <ImageIcon className="w-5 h-5 mb-1" />
                      <span className="text-xs">Add</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Up to {imageLimit} images total (main + variants) · Max 5MB each · First image is primary.</p>
              </div>

              {/* Size Chart — one optional image, available for any saved product
                  (no longer tied to the removed generic category picker) */}
              {product?.id && (
                <div>
                  <Label className="font-medium text-foreground mb-1.5 block">Size Chart <span className="text-muted-foreground/60">(optional)</span></Label>
                  <div className="flex items-center gap-3">
                    {sizeChartUrl ? (
                      <img src={sizeChartUrl} alt="Size chart" className="w-20 h-20 rounded-lg object-cover border border-border shrink-0" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                    <label className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition">
                      {uploadingSizeChart ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploadingSizeChart ? 'Uploading…' : 'Upload'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingSizeChart}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f || !product?.id) return;
                          setUploadingSizeChart(true);
                          try {
                            const res = await imagesApi.uploadSizeChart(shopId, String(product.id), f);
                            const url = res.data?.url || '';
                            setSizeChartUrl(url);
                            await productsApi.update(shopId, String(product.id), { size_chart_url: url });
                          } catch {}
                          finally { setUploadingSizeChart(false); }
                        }} />
                    </label>
                    {sizeChartUrl && (
                      <button type="button" onClick={async () => {
                        setSizeChartUrl('');
                        if (product?.id) await productsApi.update(shopId, String(product.id), { size_chart_url: '' }).catch(() => {});
                      }} className="text-xs text-muted-foreground hover:text-destructive transition">Remove</button>
                    )}
                  </div>
                </div>
              )}

              {/* Videos — YouTube/TikTok links only, no file upload. Paste a
                  link, we resolve the thumbnail server-side (oEmbed) so the
                  seller never has to find/upload one themselves. Clicking
                  through on the storefront plays the real video on YouTube/
                  TikTok, so views count there. */}
              {product?.id && (
                <div>
                  <Label className="font-medium text-foreground mb-1.5 block">
                    Videos <span className="text-muted-foreground/60">(optional — YouTube or TikTok links, up to 6)</span>
                  </Label>
                  {savedVideos.length > 0 && (
                    <div className="grid grid-cols-6 gap-2 mb-2">
                      {savedVideos.map((v) => (
                        <div key={v.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                          {v.thumbnail_url ? (
                            <img src={v.thumbnail_url} alt={v.title ?? ''} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <PlayCircle className="w-6 h-6" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <PlayCircle className="w-6 h-6 text-white drop-shadow" />
                          </div>
                          <span className="absolute bottom-1 left-1 text-[9px] font-medium text-white bg-black/60 px-1 rounded">
                            {v.platform === 'tiktok' ? 'TikTok' : 'YouTube'}
                          </span>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <button type="button" onClick={() => handleDeleteVideo(v.id)} disabled={deletingVideoId === v.id} title="Remove" className="p-1 bg-destructive rounded-full hover:bg-destructive/80 transition">
                              {deletingVideoId === v.id ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <X className="w-3 h-3 text-white" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {savedVideos.length < 6 && (
                    <div className="flex gap-2">
                      <Input type="text" value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)}
                        placeholder="Paste a YouTube or TikTok video link" className="flex-1" />
                      <Button type="button" variant="outline" onClick={handleAddVideo} disabled={addingVideo || !newVideoUrl.trim()}
                        className="whitespace-nowrap">
                        {addingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Add
                      </Button>
                    </div>
                  )}
                  {videoError && <p className="text-xs text-destructive mt-1.5">{videoError}</p>}
                  <p className="text-xs text-muted-foreground mt-1.5">No upload — we fetch the thumbnail automatically. Playback happens on YouTube/TikTok, so views count there.</p>
                </div>
              )}

              {/* SKU + Barcode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">SKU</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="IPH15PM-256"
                      disabled={formData.isDropshipImported}
                      title={formData.isDropshipImported ? "Imported from a supplier — locked to keep the link back to the source" : undefined}
                      className="flex-1"
                    />
                    {/* Imported (CJ/Prodora) products keep their supplier SKU —
                        generating a new one here would sever the traceability
                        back to the source, so the button stays visible (so it
                        doesn't look missing) but disabled rather than hidden. */}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={generatingSku || formData.isDropshipImported}
                      title={formData.isDropshipImported ? "Locked — this SKU came from the supplier import" : undefined}
                      onClick={async () => {
                        setGeneratingSku(true);
                        try {
                          const res = await productsApi.getNextSku(shopId);
                          setFormData((prev) => ({ ...prev, sku: res.data?.sku ?? generateSku(prev.name) }));
                        } catch {
                          // Server unreachable — fall back to the old client-side
                          // generator rather than leaving the seller stuck.
                          setFormData((prev) => ({ ...prev, sku: generateSku(prev.name) }));
                        } finally {
                          setGeneratingSku(false);
                        }
                      }}
                      className="whitespace-nowrap"
                    >
                      {generatingSku && <Loader2 className="w-3 h-3 animate-spin" />}
                      Generate
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formData.isDropshipImported
                      ? 'Imported from a supplier — SKU is locked to preserve the source link.'
                      : formData.sku.trim() ? 'Clear this field to generate a new one.' : 'Leave blank to auto-generate one when you save.'}
                  </p>
                </div>
                <div>
                  <Label className="mb-1.5 block">Barcode</Label>
                  <div className="flex gap-2">
                    <Input type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or type" className="flex-1" />
                    <Button type="button" variant="outline" onClick={() => setFormData({ ...formData, barcode: generateBarcode() })} className="whitespace-nowrap">
                      Generate
                    </Button>
                  </div>
                  {formData.barcode && (
                    <div className="mt-2 bg-white rounded-lg p-2 border border-border">
                      <BarcodeDisplay value={formData.barcode} height={45} fontSize={11} />
                    </div>
                  )}
                </div>
              </div>

              {/* Variants */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Sizes & Colors</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Variants with individual stock counts</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setVariants((v) => [...v, emptyVariant()])} className="h-auto p-0 text-xs text-primary hover:text-primary/80 hover:bg-transparent font-medium">
                    <Plus className="w-3.5 h-3.5" /> Add Variant
                  </Button>
                </div>
                {variants.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">No variants — click "Add Variant" to add sizes and colors.</p>
                ) : (
                  <>
                    {variants.map((v, i) => (
                      <div key={i} className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-3">
                            {i === 0 && <label className="text-xs text-muted-foreground mb-1 block">Size</label>}
                            <input type="text" value={v.size} onChange={(e) => setVariants((arr) => arr.map((r, j) => j === i ? { ...r, size: e.target.value } : r))} placeholder="S / M / XL" className="w-full px-2.5 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
                          </div>
                          <div className="col-span-3">
                            {i === 0 && <label className="text-xs text-muted-foreground mb-1 block">Color</label>}
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={v.color_hex || colorNameToHex(v.color) || '#cccccc'}
                                onChange={(e) => setVariants((arr) => arr.map((r, j) => j === i ? { ...r, color_hex: e.target.value } : r))}
                                title="Pick the exact shade — only needed if the name alone doesn't say enough (e.g. 'Rose Gold')"
                                className="w-8 h-8 shrink-0 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
                              />
                              <input type="text" value={v.color} onChange={(e) => setVariants((arr) => arr.map((r, j) => j === i ? { ...r, color: e.target.value } : r))} placeholder="Red / Blue" className="w-full px-2.5 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                          </div>
                          <div className="col-span-2">
                            {i === 0 && <label className="text-xs text-muted-foreground mb-1 block">Stock</label>}
                            <input type="number" value={v.quantity} min={0} onChange={(e) => setVariants((arr) => arr.map((r, j) => j === i ? { ...r, quantity: Number(e.target.value) } : r))} className="w-full px-2.5 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
                          </div>
                          <div className="col-span-3">
                            {i === 0 && <label className="text-xs text-muted-foreground mb-1 block">Price (blank = default)</label>}
                            <input type="number" step="0.01" value={v.price} min={0} onChange={(e) => setVariants((arr) => arr.map((r, j) => j === i ? { ...r, price: e.target.value } : r))} placeholder={String(formData.sellingPrice)} className="w-full px-2.5 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            {i === 0 && <div className="mb-1 h-4" />}
                            <button type="button" onClick={() => setVariants((arr) => arr.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-destructive transition rounded-lg hover:bg-destructive/10">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(v.image_url || v._previewUrl)
                            ? <img src={v._previewUrl || v.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border flex-shrink-0 cursor-pointer" onClick={() => document.getElementById(`variant-img-input-${i}`)?.click()} />
                            : <button type="button"
                                disabled={totalImages >= imageLimit}
                                onClick={() => document.getElementById(`variant-img-input-${i}`)?.click()}
                                title={totalImages >= imageLimit ? `Image limit reached (${imageLimit} total)` : 'Add variant image'}
                                className="w-10 h-10 rounded-lg border-2 border-dashed border-border hover:border-primary flex items-center justify-center text-muted-foreground hover:text-primary transition flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground">
                                <ImageIcon className="w-4 h-4" />
                              </button>
                          }
                          <input
                            id={`variant-img-input-${i}`}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setVariantImageError('');
                              if (file.size > MAX_FILE_BYTES) {
                                setVariantImageError(`Image must be under ${MAX_FILE_MB}MB.`);
                                e.target.value = '';
                                return;
                              }
                              if (product?.id) {
                                // Edit mode — upload to R2 immediately, save URL on Update Product
                                setUploadingVariantIdx(i);
                                try {
                                  const res = await variantsApi.uploadImage(shopId, product.id, file);
                                  const url = res.data?.url;
                                  if (url) {
                                    setVariants((arr) => arr.map((r, j) =>
                                      j === i ? { ...r, image_url: url, _pendingFile: undefined, _previewUrl: undefined } : r
                                    ));
                                  }
                                } catch (err: any) {
                                  const detail = err?.response?.data?.detail ?? 'Image upload failed — check your connection and try again.';
                                  setVariantImageError(detail);
                                }
                                setUploadingVariantIdx(null);
                              } else {
                                // Add mode — store locally, upload after product is created
                                const previewUrl = URL.createObjectURL(file);
                                setVariants((arr) => arr.map((r, j) => j === i ? { ...r, _pendingFile: file, _previewUrl: previewUrl } : r));
                              }
                              e.target.value = '';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            {uploadingVariantIdx === i
                              ? <p className="text-xs text-muted-foreground animate-pulse">Uploading...</p>
                              : variantImageError && uploadingVariantIdx === null
                              ? <p className="text-xs text-red-500">{variantImageError}</p>
                              : v.image_url
                              ? <p className="text-xs text-green-600 dark:text-green-400 truncate">Image saved</p>
                              : v._previewUrl
                              ? <p className="text-xs text-blue-600 dark:text-blue-400 truncate">Image selected — will upload on save</p>
                              : <p className="text-xs text-muted-foreground">Click icon to add variant image</p>
                            }
                          </div>
                          {v.image_url && (
                            <button type="button" onClick={() => setVariants((arr) => arr.map((r, j) => j === i ? { ...r, image_url: '' } : r))} className="text-xs text-muted-foreground hover:text-destructive transition">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">Total stock: <strong>{variants.reduce((s, v) => s + v.quantity, 0)}</strong></p>
                  </>
                )}
              </section>

              <div className="border-t border-border" />

              {/* Pricing */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Pricing</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">Cost Price ({baseSym}) *</Label>
                    <Input type="number" step="0.01" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })} required min="0" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Selling Price ({baseSym}) *</Label>
                    <Input type="number" step="0.01" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })} required min="0" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">
                      Original Price ({baseSym})
                      <span className="ml-1 font-normal opacity-60">— if on offer</span>
                    </Label>
                    <Input type="number" step="0.01" value={formData.compareAtPrice || ''} onChange={(e) => setFormData({ ...formData, compareAtPrice: Number(e.target.value) })} min="0" placeholder={formData.sellingPrice > 0 ? String(Math.round(formData.sellingPrice * 1.3)) : ''} />
                  </div>
                </div>

                {/* Profit preview */}
                {formData.costPrice > 0 && formData.sellingPrice > 0 && (
                  <div className="bg-muted rounded-lg p-3 flex gap-6">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Profit</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {formData.sellingPrice - formData.costPrice} {baseSym} ({Math.round(((formData.sellingPrice - formData.costPrice) / formData.costPrice) * 100)}%)
                      </span>
                    </div>
                    {formData.compareAtPrice > formData.sellingPrice && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-semibold text-red-500">
                          {Math.round((1 - formData.sellingPrice / formData.compareAtPrice) * 100)}% OFF
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-border" />

              {/* Stock */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Inventory</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">
                      Stock Quantity
                      {variants.length > 0 && <span className="ml-2 text-primary font-semibold">= {variants.reduce((s, v) => s + v.quantity, 0)} (from variants)</span>}
                    </Label>
                    <Input
                      type="number"
                      value={variants.length > 0 ? variants.reduce((s, v) => s + v.quantity, 0) : formData.stock}
                      onChange={(e) => { if (variants.length === 0) setFormData({ ...formData, stock: Number(e.target.value) }); }}
                      readOnly={variants.length > 0}
                      min="0"
                      className={variants.length > 0 ? 'opacity-60 cursor-not-allowed' : ''}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Low Stock Alert</Label>
                    <Input type="number" value={formData.lowStockAlert} onChange={(e) => setFormData({ ...formData, lowStockAlert: Number(e.target.value) })} min="0" />
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Supplier */}
              <div>
                <Label className="font-medium text-foreground mb-1.5 block">Supplier</Label>
                <Select
                  value={formData.supplierId != null ? String(formData.supplierId) : '__none'}
                  onValueChange={(v) => setFormData({ ...formData, supplierId: v === '__none' ? null : Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No supplier</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {suppliers.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">No suppliers yet — add them in <strong>Suppliers</strong>.</p>
                )}
              </div>

              {/* ── Bundle / Kit ── */}
              <div className="border-t border-border -mx-6 px-6 pt-6">
                <BundleBuilder
                  shopId={shopId}
                  enabled={isBundleEnabled}
                  onToggle={setIsBundleEnabled}
                  components={bundleComponents}
                  onChange={setBundleComponents}
                  availableProducts={allProducts.map(p => ({ id: p.id, name: p.name, sku: p.sku }))}
                  currentProductId={product?.id}
                />
              </div>

              {/* ── Dropship Supplier — only for existing (saved) products ── */}
              {product?.id && (
                <div className="border-t border-border -mx-6 px-6 pt-6">
                  <DropshipSupplierSection shopId={shopId} productId={product.id} />
                </div>
              )}
            </div>

            {/* ── RIGHT: Sidebar — scrolls independently from the content on the left ── */}
            <div className="p-6 space-y-6 bg-muted/20 overflow-y-auto min-h-0">

              {/* ── Sales Channels ───────────────────────────────────── */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sales Channels</p>

                {/* Connected channels float to the top (order via flex), each
                    block's own JSX/logic below is completely untouched —
                    this is a display-file container change (flex flex-col),
                    so space-y-2.5's margins still apply the same way. */}
                <div className="flex flex-col gap-2.5">

                {/* POS — real toggle, defaults on. Nested gift toggle, same pattern as every other channel. Always available, so it stays at the top. */}
                <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ order: 0 }}>
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">POS</p>
                        <p className="text-xs text-muted-foreground">{posEnabled ? 'Available in-store' : 'Not available in-store'}</p>
                      </div>
                    </div>
                    <Switch checked={posEnabled} onCheckedChange={setPosEnabled} aria-label="Toggle POS availability" className="shrink-0" />
                  </div>
                  {posEnabled && (
                    <div className="border-t border-border p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Is this a gift item?</p>
                        <p className="text-xs text-muted-foreground">{posIsGift ? 'Given as a free gift in-store' : 'Off — this is a regular product'}</p>
                      </div>
                      <Switch checked={posIsGift} onCheckedChange={setPosIsGift} aria-label="Toggle POS gift item" className="shrink-0" />
                    </div>
                  )}
                </div>

                {/* TheDersi — existing toggle/gift/category logic is untouched below, just restyled */}
                <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ order: theDersiConnection ? 0 : 10 }}>
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">TheDersi</p>
                        <p className="text-xs text-muted-foreground">
                          {theDersiConnection ? (formData.listOnMarketplace ? 'Listed on the marketplace' : 'POS / in-store only') : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {theDersiConnection ? (
                      <Switch
                        checked={formData.listOnMarketplace}
                        onCheckedChange={(v) => setFormData({ ...formData, listOnMarketplace: v })}
                        aria-label="Toggle TheDersi listing"
                        className="shrink-0"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">Not connected</span>
                    )}
                  </div>

                  {/* Free Gift item — only relevant for TheDersi-listed products */}
                  {theDersiConnection && formData.listOnMarketplace && (
                    <div className="border-t border-border p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Is this a free gift item?</p>
                        <p className="text-xs text-muted-foreground">
                          {formData.isGift
                            ? 'Offered as a free gift option at TheDersi checkout — not shown as a normal listing'
                            : 'Off — this is a regular product'}
                        </p>
                      </div>
                      <Switch
                        checked={formData.isGift}
                        onCheckedChange={(v) => setFormData({ ...formData, isGift: v })}
                        aria-label="Toggle TheDersi free gift item"
                        className="shrink-0"
                      />
                    </div>
                  )}

                  {/* TheDersi Category — only when listed */}
                  {theDersiConnection && formData.listOnMarketplace && (
                    <div className="border-t border-border p-3">
                      <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                        TheDersi Category
                        {loadingCategories && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveCategoryPicker('thedersi')}
                        disabled={loadingCategories}
                        className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-left flex items-center justify-between gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:border-primary/50 transition"
                      >
                        <span className={theDersiCategoryName ? 'text-foreground' : 'text-muted-foreground'}>
                          {loadingCategories ? 'Loading TheDersi categories…' : theDersiCategoryName || 'Select TheDersi category'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                      <p className="text-xs text-muted-foreground mt-1.5">Listed under this category on TheDersi.</p>
                    </div>
                  )}

                  {/* Product Details — TheDersi's own dynamic spec fields
                      (Material, Metal Type, Gemstone, etc). Fetched live from
                      their API, not hardcoded — the exact set shown here can
                      change on their end without any change on ours. */}
                  {theDersiConnection && formData.listOnMarketplace && (loadingFieldDefs || theDersiFieldDefs.length > 0) && (
                    <div className="border-t border-border p-3">
                      <Label className="font-medium text-foreground mb-2 flex items-center gap-2">
                        Product Details
                        {loadingFieldDefs && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      </Label>
                      {!loadingFieldDefs && (
                        <>
                          <p className="text-xs text-muted-foreground mb-2.5">
                            Fill in whatever applies — leave the rest blank. Shown on the live TheDersi product page.
                          </p>
                          <div className="grid grid-cols-2 gap-2.5">
                            {theDersiFieldDefs.map((f) => (
                              <div key={f.key}>
                                <Label className="text-xs mb-1 block">{f.label}</Label>
                                <Input
                                  type="text"
                                  value={theDersiFieldValues[f.key] ?? ''}
                                  onChange={(e) => setTheDersiFieldValues({ ...theDersiFieldValues, [f.key]: e.target.value })}
                                  placeholder={f.label}
                                />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Daraz — toggle + real category tree from Daraz's own API */}
                <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ order: darazConnection ? 0 : 10 }}>
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Daraz</p>
                        <p className="text-xs text-muted-foreground">
                          {darazConnection ? (otherChannels.daraz.enabled ? 'Listed on Daraz' : 'Not listed') : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {darazConnection ? (
                      <Switch
                        checked={otherChannels.daraz.enabled}
                        onCheckedChange={(v) => setOtherChannelEnabled('daraz', v)}
                        aria-label="Toggle Daraz listing"
                        className="shrink-0"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">Not connected</span>
                    )}
                  </div>
                  {darazConnection && otherChannels.daraz.enabled && (
                    <div className="border-t border-border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Is this a gift item?</p>
                          <p className="text-xs text-muted-foreground">{otherChannels.daraz.isGift ? 'Listed as a gift on Daraz' : 'Off — this is a regular product'}</p>
                        </div>
                        <Switch
                          checked={otherChannels.daraz.isGift}
                          onCheckedChange={(v) => setOtherChannelGift('daraz', v)}
                          aria-label="Toggle Daraz gift item"
                          className="shrink-0"
                        />
                      </div>
                      <div>
                        <Label className="font-medium text-foreground mb-1.5 flex items-center gap-2">
                          Daraz Category
                          {loadingDarazCategories && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                        </Label>
                        <button
                          type="button"
                          onClick={() => setActiveCategoryPicker('daraz')}
                          disabled={loadingDarazCategories || darazCategories.length === 0}
                          className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-left flex items-center justify-between gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:border-primary/50 transition"
                        >
                          <span className={otherChannels.daraz.categoryName ? 'text-foreground' : 'text-muted-foreground'}>
                            {loadingDarazCategories
                              ? 'Loading Daraz categories…'
                              : darazCategories.length === 0
                                ? 'Could not load Daraz categories'
                                : otherChannels.daraz.categoryName || 'Select Daraz category'}
                          </span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        </button>
                        <p className="text-xs text-muted-foreground mt-1.5">Daraz's own category tree — pick the most specific match.</p>
                      </div>

                      {product?.id && otherChannels.daraz.categoryId && (
                        <DarazListingFields
                          shopId={shopId}
                          categoryId={otherChannels.daraz.categoryId}
                          values={darazAttributeValues}
                          brand={darazBrand}
                          onChange={(vals, b) => { setDarazAttributeValues(vals); setDarazBrand(b); }}
                        />
                      )}

                      {product?.id && otherChannels.daraz.categoryId && (
                        <div className="border-t border-border pt-3">
                          {darazListingStatus ? (
                            <div className={`flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2 ${
                              darazListingStatus.status === 'approved' ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : darazListingStatus.status === 'rejected' ? 'bg-red-500/10 text-destructive'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}>
                              {darazListingStatus.status === 'approved' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                              {darazListingStatus.status === 'approved' ? 'Live on Daraz'
                                : darazListingStatus.status === 'rejected' ? 'Rejected by Daraz — check Daraz seller center for the reason'
                                : "Submitted — waiting for Daraz's review"}
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={handleListOnDaraz}
                                disabled={listingDaraz || !darazBrand}
                                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
                              >
                                {listingDaraz && <Loader2 className="w-4 h-4 animate-spin" />}
                                {listingDaraz ? 'Creating listing on Daraz…' : 'List on Daraz'}
                              </button>
                              {!darazBrand && <p className="text-xs text-muted-foreground mt-1.5 text-center">Pick a brand above first.</p>}
                              {darazListingError && <p className="text-xs text-destructive mt-1.5">{darazListingError}</p>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* eBay — toggle + real category tree from eBay's Taxonomy API.
                    eBay's publish is synchronous (no pending-review step like
                    Daraz), so success here means the listing is already live. */}
                <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ order: ebayConnection ? 0 : 10 }}>
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#E53238]/10 flex items-center justify-center shrink-0">
                        <Tag className="w-4 h-4 text-[#E53238]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">eBay</p>
                        <p className="text-xs text-muted-foreground">
                          {ebayConnection ? (otherChannels.ebay.enabled ? 'Listed on eBay' : 'Not listed') : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {ebayConnection ? (
                      <Switch
                        checked={otherChannels.ebay.enabled}
                        onCheckedChange={(v) => setOtherChannelEnabled('ebay', v)}
                        aria-label="Toggle eBay listing"
                        className="shrink-0"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">Not connected</span>
                    )}
                  </div>
                  {ebayConnection && otherChannels.ebay.enabled && (
                    <div className="border-t border-border p-3 space-y-3">
                      <div>
                        <Label className="font-medium text-foreground mb-1.5 flex items-center gap-2">
                          eBay Category
                          {loadingEbayCategories && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                        </Label>
                        <button
                          type="button"
                          onClick={() => setActiveCategoryPicker('ebay')}
                          disabled={loadingEbayCategories || ebayCategories.length === 0}
                          className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-left flex items-center justify-between gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:border-primary/50 transition"
                        >
                          <span className={otherChannels.ebay.categoryName ? 'text-foreground' : 'text-muted-foreground'}>
                            {loadingEbayCategories
                              ? 'Loading eBay categories…'
                              : ebayCategories.length === 0
                                ? 'Could not load eBay categories'
                                : otherChannels.ebay.categoryName || 'Select eBay category'}
                          </span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        </button>
                        <p className="text-xs text-muted-foreground mt-1.5">eBay's own category tree — pick the most specific match.</p>
                      </div>

                      {product?.id && otherChannels.ebay.categoryId && (
                        <EbayListingFields
                          shopId={shopId}
                          categoryId={otherChannels.ebay.categoryId}
                          values={ebayAspectValues}
                          condition={ebayCondition}
                          onChange={(vals, cond) => { setEbayAspectValues(vals); setEbayCondition(cond); }}
                        />
                      )}

                      {product?.id && otherChannels.ebay.categoryId && (
                        <div className="border-t border-border pt-3">
                          {ebayListingStatus?.listing_ids?.length ? (
                            <div className="flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2 bg-green-500/10 text-green-600 dark:text-green-400">
                              <CheckCircle className="w-3.5 h-3.5" /> Live on eBay
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={handleListOnEbay}
                                disabled={listingEbay}
                                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
                              >
                                {listingEbay && <Loader2 className="w-4 h-4 animate-spin" />}
                                {listingEbay ? 'Creating listing on eBay…' : 'List on eBay'}
                              </button>
                              {ebayListingError && <p className="text-xs text-destructive mt-1.5">{ebayListingError}</p>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Noon — toggle + searched flat category (no OAuth connect yet,
                    seller pastes their own key from the Channels page) */}
                <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ order: noonConnection ? 0 : 10 }}>
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4 text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Noon</p>
                        <p className="text-xs text-muted-foreground">
                          {noonConnection ? (noonEnabled ? 'Listed on Noon' : 'Not listed') : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {noonConnection ? (
                      <Switch
                        checked={noonEnabled}
                        onCheckedChange={setNoonEnabled}
                        aria-label="Toggle Noon listing"
                        className="shrink-0"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">Not connected</span>
                    )}
                  </div>
                  {noonConnection && noonEnabled && (
                    <div className="border-t border-border p-3 space-y-3">
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div>
                          <Label className="text-xs font-medium text-foreground mb-1 block">Brand *</Label>
                          <Input type="text" value={noonBrand} onChange={(e) => setNoonBrand(e.target.value)}
                            placeholder="Brand name shown on Noon" />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-foreground mb-1 block">Country</Label>
                          <Select value={noonCountry} onValueChange={(v) => setNoonCountry(v as 'ae' | 'sa' | 'eg')}>
                            <SelectTrigger className="w-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ae">UAE</SelectItem>
                              <SelectItem value="sa">Saudi Arabia</SelectItem>
                              <SelectItem value="eg">Egypt</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {product?.id && (
                        <NoonListingFields
                          shopId={shopId}
                          categoryCode={noonCategoryCode}
                          onCategorySelect={setNoonCategoryCode}
                          values={noonAttributeValues}
                          onChange={setNoonAttributeValues}
                        />
                      )}

                      {product?.id && noonCategoryCode && (
                        <div className="border-t border-border pt-3">
                          {noonListingStatus ? (
                            <div className="flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2 bg-green-500/10 text-green-600 dark:text-green-400">
                              <CheckCircle className="w-3.5 h-3.5" /> Live on Noon
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={handleListOnNoon}
                                disabled={listingNoon || !noonBrand}
                                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
                              >
                                {listingNoon && <Loader2 className="w-4 h-4 animate-spin" />}
                                {listingNoon ? 'Creating listing on Noon…' : 'List on Noon'}
                              </button>
                              {!noonBrand && <p className="text-xs text-muted-foreground mt-1.5 text-center">Enter a brand above first.</p>}
                              {noonListingError && <p className="text-xs text-destructive mt-1.5">{noonListingError}</p>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Shopify — toggle + nested gift toggle, no category concept */}
                <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ order: shopifyConnected ? 0 : 10 }}>
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Shopify</p>
                        <p className="text-xs text-muted-foreground">
                          {shopifyConnected ? (otherChannels.shopify.enabled ? 'Synced to Shopify' : 'Not synced') : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {shopifyConnected ? (
                      <Switch
                        checked={otherChannels.shopify.enabled}
                        onCheckedChange={(v) => setOtherChannelEnabled('shopify', v)}
                        aria-label="Toggle Shopify listing"
                        className="shrink-0"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">Not connected</span>
                    )}
                  </div>
                  {shopifyConnected && otherChannels.shopify.enabled && (
                    <div className="border-t border-border p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Is this a gift item?</p>
                        <p className="text-xs text-muted-foreground">{otherChannels.shopify.isGift ? 'Listed as a gift on Shopify' : 'Off — this is a regular product'}</p>
                      </div>
                      <Switch
                        checked={otherChannels.shopify.isGift}
                        onCheckedChange={(v) => setOtherChannelGift('shopify', v)}
                        aria-label="Toggle Shopify gift item"
                        className="shrink-0"
                      />
                    </div>
                  )}
                </div>

                {/* Custom Website — toggle + gift toggle + storefront category + seller-defined fields */}
                <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ order: customWebsiteConnection ? 0 : 10 }}>
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-sky-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Custom Website</p>
                        <p className="text-xs text-muted-foreground">
                          {customWebsiteConnection ? (otherChannels.custom.enabled ? 'Shown on your website' : 'Not shown') : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {customWebsiteConnection ? (
                      <Switch
                        checked={otherChannels.custom.enabled}
                        onCheckedChange={(v) => setOtherChannelEnabled('custom', v)}
                        aria-label="Toggle Custom Website listing"
                        className="shrink-0"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">Not connected</span>
                    )}
                  </div>
                  {customWebsiteConnection && otherChannels.custom.enabled && (
                    <div className="border-t border-border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Is this a gift item?</p>
                          <p className="text-xs text-muted-foreground">{otherChannels.custom.isGift ? 'Listed as a gift on your website' : 'Off — this is a regular product'}</p>
                        </div>
                        <Switch
                          checked={otherChannels.custom.isGift}
                          onCheckedChange={(v) => setOtherChannelGift('custom', v)}
                          aria-label="Toggle Custom Website gift item"
                          className="shrink-0"
                        />
                      </div>

                      {customCategoryOptions.length > 0 && (
                        <div>
                          <Label className="text-xs mb-1 block">Category on your website</Label>
                          <Select
                            value={otherChannels.custom.categoryId || '__none'}
                            onValueChange={(v) => {
                              const opt = customCategoryOptions.find((c) => String(c.id) === v);
                              setOtherChannels((prev) => ({
                                ...prev,
                                custom: { ...prev.custom, categoryId: v === '__none' ? '' : v, categoryName: opt?.label.replace(/— /g, '') ?? '' },
                              }));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">No category</SelectItem>
                              {customCategoryOptions.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {customFieldDefs.map((f) => (
                        <div key={f.id}>
                          <label className="text-xs text-muted-foreground mb-1 block">{f.label}{f.required && ' *'}</label>
                          {f.type === 'text' && (
                            <input type="text" value={customFieldValues[f.id] ?? ''}
                              onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                              className="w-full px-2.5 py-1.5 bg-muted border border-border rounded-lg text-xs" />
                          )}
                          {f.type === 'number' && (
                            <input type="number" value={customFieldValues[f.id] ?? ''}
                              onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                              className="w-full px-2.5 py-1.5 bg-muted border border-border rounded-lg text-xs" />
                          )}
                          {f.type === 'checkbox' && (
                            <label className="flex items-center gap-2 text-xs text-foreground">
                              <input type="checkbox" checked={!!customFieldValues[f.id]}
                                onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [f.id]: e.target.checked }))} />
                              Yes
                            </label>
                          )}
                          {f.type === 'dropdown' && (
                            <select value={customFieldValues[f.id] ?? ''}
                              onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                              className="w-full px-2.5 py-1.5 bg-muted border border-border rounded-lg text-xs">
                              <option value="">Select...</option>
                              {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          )}
                          {f.type === 'quantity_tiers' && (
                            <div className="space-y-2">
                              {((customFieldValues[f.id] ?? []) as QuantityTierValue[]).map((tier, ti) => {
                                const updateTier = (patch: Partial<QuantityTierValue>) => setCustomFieldValues((prev) => {
                                  const rows = [...(prev[f.id] ?? [])];
                                  rows[ti] = { ...rows[ti], ...patch };
                                  return { ...prev, [f.id]: rows };
                                });
                                return (
                                  <div key={ti} className="border border-border rounded-lg p-2 bg-card space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <input type="number" min={1} placeholder="Qty" value={tier.quantity}
                                        onChange={(e) => updateTier({ quantity: Number(e.target.value) || 0 })}
                                        className="w-16 px-2 py-1.5 bg-muted border border-border rounded-lg text-xs" />
                                      <span className="text-xs text-muted-foreground">for a total of $</span>
                                      <input type="number" min={0} step="0.01" placeholder="Total price" value={tier.price}
                                        onChange={(e) => updateTier({ price: Number(e.target.value) || 0 })}
                                        className="flex-1 px-2 py-1.5 bg-muted border border-border rounded-lg text-xs" />
                                      <button type="button"
                                        onClick={() => setCustomFieldValues((prev) => ({ ...prev, [f.id]: (prev[f.id] ?? []).filter((_: any, idx: number) => idx !== ti) }))}
                                        className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <input type="text" placeholder="Label, e.g. Best Value" value={tier.label ?? ''}
                                        onChange={(e) => updateTier({ label: e.target.value })}
                                        className="flex-1 min-w-0 px-2 py-1.5 bg-muted border border-border rounded-lg text-xs" />
                                      <input type="text" placeholder="Badge, e.g. Save $15" value={tier.badge ?? ''}
                                        onChange={(e) => updateTier({ badge: e.target.value })}
                                        className="flex-1 min-w-0 px-2 py-1.5 bg-muted border border-border rounded-lg text-xs" />
                                      <select value={tier.badge_type ?? ''}
                                        onChange={(e) => updateTier({ badge_type: (e.target.value || undefined) as QuantityTierValue['badge_type'] })}
                                        className="px-1.5 py-1.5 bg-muted border border-border rounded-lg text-xs shrink-0">
                                        <option value="">No style</option>
                                        <option value="save">Save</option>
                                        <option value="popular">Popular</option>
                                        <option value="value">Value</option>
                                      </select>
                                      <label className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                                        <input type="checkbox" checked={!!tier.recommended}
                                          onChange={(e) => updateTier({ recommended: e.target.checked })} />
                                        Pre-selected
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                              <button type="button"
                                onClick={() => setCustomFieldValues((prev) => ({ ...prev, [f.id]: [...(prev[f.id] ?? []), { quantity: 1, price: Number(formData.sellingPrice) || 0 }] }))}
                                className="text-xs text-primary hover:text-primary/80 font-medium">
                                + Add tier
                              </button>
                              <p className="text-xs text-muted-foreground">Total price for that quantity, once someone buys this many or more — actually applied at checkout.</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Not connectable yet — honest placeholders, not fake toggles.
                    eBay and Noon removed from this list — they're real,
                    connectable channels with their own cards above now, so
                    having them here too was a leftover duplicate that showed
                    two contradictory statuses for the same channel. */}
                {[
                  { name: 'Amazon' },
                  { name: 'WooCommerce' },
                  { name: 'TikTok Shop' },
                  { name: 'Instagram Shopping' },
                ].map((ch) => (
                  <div key={ch.name} className="bg-muted/40 border border-border rounded-lg p-3 flex items-center justify-between gap-3 opacity-60" style={{ order: 20 }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{ch.name}</p>
                        <p className="text-xs text-muted-foreground">Connect this channel first</p>
                      </div>
                    </div>
                    <ToggleLeft className="w-9 h-9 text-muted-foreground shrink-0" />
                  </div>
                ))}
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Save */}
              <div className="flex flex-col gap-2">
                <Button type="submit" disabled={saving} className="w-full bg-foreground text-background hover:opacity-90 hover:bg-foreground">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="w-full">
                  Cancel
                </Button>
              </div>

            </div>
          </div>
        </form>

        {/* Category picker — same for every channel that has categories.
            Expands to the full modal size (same height/width as the Add
            Product page) with a search box, instead of a cramped sidebar
            dropdown — TheDersi's list is short, Daraz's can run to
            thousands, but both use the same UI. Same chevron reused to
            open (▼) and close (▲). */}
        {activeCategoryPicker && (() => {
          const closePicker = () => { setActiveCategoryPicker(null); setCategoryPickerSearch(''); };

          const items: { id: string; name: string }[] = activeCategoryPicker === 'daraz'
            ? darazCategories
            : activeCategoryPicker === 'ebay'
            ? ebayCategories
            : (() => {
                // TheDersi's categories are 2 levels (parent/child) — turn
                // them into the same flat breadcrumb style Daraz uses.
                const parents = theDersiCategories.filter((c) => !c.parent_id);
                const children = (parentId: string) => theDersiCategories.filter((c) => c.parent_id === parentId);
                const flat: { id: string; name: string }[] = [];
                parents.forEach((parent) => {
                  const subs = children(parent.id);
                  if (subs.length > 0) {
                    flat.push({ id: parent.id, name: `${parent.name} — All` });
                    subs.forEach((sub) => flat.push({ id: sub.id, name: `${parent.name} > ${sub.name}` }));
                  } else {
                    flat.push({ id: parent.id, name: parent.name });
                  }
                });
                return flat;
              })();

          const selectedId = activeCategoryPicker === 'daraz' ? otherChannels.daraz.categoryId
            : activeCategoryPicker === 'ebay' ? otherChannels.ebay.categoryId
            : theDersiCategoryId;
          const title = activeCategoryPicker === 'daraz' ? 'Select Daraz Category'
            : activeCategoryPicker === 'ebay' ? 'Select eBay Category'
            : 'Select TheDersi Category';
          const placeholder = activeCategoryPicker === 'daraz' ? 'Search Daraz categories…'
            : activeCategoryPicker === 'ebay' ? 'Search eBay categories…'
            : 'Search TheDersi categories…';

          const selectItem = (item: { id: string; name: string }) => {
            if (activeCategoryPicker === 'daraz') {
              setOtherChannels((prev) => ({
                ...prev,
                daraz: { ...prev.daraz, categoryId: item.id, categoryName: item.name },
              }));
            } else if (activeCategoryPicker === 'ebay') {
              setOtherChannels((prev) => ({
                ...prev,
                ebay: { ...prev.ebay, categoryId: item.id, categoryName: item.name },
              }));
            } else {
              setTheDersiCategoryId(item.id);
              setTheDersiCategoryName(item.name);
            }
            closePicker();
          };

          const q = categoryPickerSearch.trim().toLowerCase();
          const filtered = q ? items.filter((c) => c.name.toLowerCase().includes(q)) : items;

          return (
            <div className="absolute inset-0 z-10 bg-card rounded-xl flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <button
                  type="button"
                  onClick={closePicker}
                  aria-label="Close category picker"
                  className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"
                >
                  <ChevronDown className="w-5 h-5 rotate-180" />
                </button>
              </div>
              <div className="px-6 py-4 border-b border-border shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={categoryPickerSearch}
                    onChange={(e) => setCategoryPickerSearch(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No categories match "{categoryPickerSearch}"</p>
                ) : (
                  filtered.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => selectItem(cat)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${
                        selectedId === cat.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
